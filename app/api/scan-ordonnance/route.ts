import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { prisma } from "@/lib/prisma";
import type { PropositionOrdonnance } from "@/lib/ordonnance-types";
import { normaliserAnalyseOrdonnance, type MedicamentCandidat } from "@/lib/ordonnance-extraction";
import { chargerCandidatsOrdonnance } from "@/lib/ordonnance-medication-candidates";
import { appliquerTranscriptionParBlocs } from "@/lib/ordonnance-transcription";
import {
  logOrdonnanceScanFailure,
  ordonnanceScanUserMessage,
  type OrdonnanceScanStage,
} from "@/lib/ordonnance-scan-diagnostics";

export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const PROMPT_VERSION = "ordonnance-v7-transcription-par-blocs";

interface OrdonnanceResult extends PropositionOrdonnance {
  raw: string;
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

const SYSTEM_PROMPT = `Tu analyses une ordonnance veterinaire francaise pour bovins.
Les photos fournies forment une seule ordonnance. Combine toutes les pages.
Reponds uniquement en JSON valide, sans markdown, avec cette structure :
{
  "transcription": {
    "entete": {
      "lignes": ["chaque ligne utile de l'en-tete, fidele et dans l'ordre"]
    },
    "medicaments": [{
      "identification": ["nom commercial et identification, sans reformulation"],
      "presentation": ["presentation, volume et quantite delivree, sans reformulation"],
      "posologie": ["chaque expression de dose complete, sur une ligne separee"],
      "renouvellement": ["seconde administration, intervalle et condition uniquement"],
      "delaisAttente": ["viande, abats et lait, avec valeurs et unites exactes"],
      "instructionsPrecautions": ["consignes pratiques et precautions"],
      "autres": ["autres lignes utiles non classees"]
    }]
  },
  "dates": {
    "prescriptionDate": "YYYY-MM-DD ou null",
    "lastVisitDate": "YYYY-MM-DD ou null",
    "deliveryDate": "YYYY-MM-DD ou null"
  },
  "dateCandidates": [
    { "value": "YYYY-MM-DD", "sourceText": "libelle et date proches", "zone": "en-tete ou corps" }
  ],
  "ordonnanceNumero": "string ou null",
  "veterinaire": "string ou null",
  "motif": "string ou null",
  "evidence": {
    "prescriptionDate": { "value": "YYYY-MM-DD", "sourceText": "texte exact", "confidence": 0.95, "zone": "en-tete" }
  },
  "medicaments": [{
    "medicamentNom": "nom commercial complet ou null",
    "numeroLot": "string ou null",
    "substanceActive": "string ou null",
    "concentration": "concentration de la substance active ou null",
    "categorie": "string ou null",
    "familleTherapeutique": "string ou null",
    "formePharmaceutique": "string ou null",
    "conditionnement": "presentation exacte avec quantite delivree si elle est explicite, par exemple 1 flacon de 100 ml, ou null",
    "presentation": {
      "containerType": "flacon, aerosol, ampoule, boite ou null",
      "volumeValue": "number ou null",
      "volumeUnit": "ml, cl, l ou null",
      "deliveredQuantity": "nombre d'unites delivrees ou null",
      "sourceText": "expression exacte complete ou null"
    },
    "voie": "IM, SC, IV, PO ou texte exact, ou null",
    "dose": {
      "doseValue": "number ou null",
      "doseUnit": "ml, mg, g, cp ou null",
      "referenceValue": "number ou null",
      "referenceUnit": "kg ou null",
      "referenceType": "live_weight, animal ou null",
      "normalizedDoseValue": "number ou null",
      "normalizedDoseUnit": "ml/kg, mg/kg ou null"
    },
    "dosePratique": {
      "doseValue": "number ou null",
      "doseUnit": "ml, g, cp, bolus ou null",
      "referenceValue": "number ou null",
      "referenceUnit": "kg ou null",
      "referenceType": "live_weight, animal ou null",
      "sourceText": "expression exacte complète ou null"
    },
    "dosePharmacologique": {
      "doseValue": "number ou null",
      "doseUnit": "mg, mcg ou null",
      "referenceValue": "number ou null",
      "referenceUnit": "kg ou null",
      "referenceType": "live_weight ou null",
      "sourceText": "expression exacte complète ou null"
    },
    "administrationProtocol": {
      "administrationCount": "number ou null",
      "administrationIntervalHours": "number ou null",
      "treatmentDurationDays": "number ou null",
      "repeatCondition": "string ou null",
      "administrationInstructions": "string ou null"
    },
    "withdrawalPeriods": {
      "meatDays": "number ou null",
      "offalDays": "number ou null",
      "milkDays": "number ou null"
    },
    "precautions": "string ou null",
    "evidence": {
      "dose": { "value": "texte interprete", "sourceText": "texte exact complet", "confidence": 0.95, "zone": "prescription" },
      "concentration": { "value": "concentrations interpretees", "sourceText": "chaque substance et sa concentration exacte en mg/ml", "confidence": 0.95, "zone": "composition" },
      "administrationProtocol": { "value": "texte interprete", "sourceText": "protocole exact complet", "confidence": 0.95, "zone": "prescription" },
      "withdrawalPeriods": { "value": "delais interpretes", "sourceText": "texte exact complet viande, abats et lait", "confidence": 0.95, "zone": "prescription" },
      "conditionnement": { "value": "texte interprete", "sourceText": "nom, presentation et quantite exacts", "confidence": 0.95, "zone": "delivrance" }
    }
  }]
}

Regles obligatoires :
- Commence par transcrire les lignes utiles fidelement dans transcription, dans leur ordre de lecture.
- Ne reformule, ne corrige et ne normalise aucune valeur, date ou unite dans transcription.
- Une ligne appartient a un seul bloc metier. Ne place jamais un delai d'attente dans renouvellement,
  ni une dose dans delaisAttente ou presentation.
- Dans posologie, conserve chaque expression complete. Si une phrase contient 20 mg/kg et 1 ml/10 kg,
  transcris les deux expressions sans en supprimer ni en recomposer une.
- Associe chaque date a son libelle proche. La date pres de "derniere visite" est lastVisitDate et jamais prescriptionDate.
- La date de l'ordonnance est exclusivement celle du bloc "ordonnance n ..." suivi de "le JJ/MM/AAAA".
  evidence.prescriptionDate.sourceText doit conserver ensemble le numero d'ordonnance et cette date.
- Si ce bloc complet n'est pas lisible, prescriptionDate reste null : n'utilise aucune autre date par defaut.
- Ne corrige jamais le mois d'une date lisible : "01/06/2026" signifie le 1er juin, pas le 1er avril.
- Une date isolee sans libelle ni proximite semantique certaine reste non classee.
- deliveryDate reste null sauf si la date est explicitement associee a une mention de delivrance
  ("delivre le", "date de delivrance", "delivrance" ou formulation non ambigue equivalente).
- Une date isolee, ancienne ou rattachee a un autre contenu ne doit jamais alimenter deliveryDate.
- Si deliveryDate est renseignee, evidence.deliveryDate doit contenir le libelle exact qui la justifie.
- Si le document indique "delivre ce jour", utilise la date de l'ordonnance comme deliveryDate et conserve
  cette mention exacte dans evidence.deliveryDate.sourceText.
- Pour le conditionnement, conserve distinctement dans la meme phrase le nombre d'unites delivrees et la
  presentation, par exemple "1 flacon de 100 ml". N'invente jamais une quantite absente du document.
- "100 ml" est un volume unitaire et jamais une quantite de 100 unites. Une mention separee "Qte : 1"
  signifie deliveredQuantity=1. "FL." signifie flacon uniquement lorsqu'il est bien present dans le texte source.
- Une dose "1 ml pour 10 kg" est ponderale : doseValue=1, referenceValue=10, referenceType=live_weight, normalizedDoseValue=0.1. Ce n'est pas une dose fixe de 1 ml.
- Conserve séparément dosePratique et dosePharmacologique. Chaque valeur, unité et référence doit provenir de la même
  expression exacte conservée dans son sourceText. Ne combine jamais une valeur en mg avec la référence d'une expression en ml.
- Pour chaque substance active, conserve sa concentration en mg/ml dans evidence.concentration.sourceText.
  Ne regroupe jamais la concentration d'une substance avec la dose pharmacologique d'une autre.
- Le bloc dose principal reprend la dose pratique lorsqu'elle existe, sinon la dose pharmacologique. N'invente aucune conversion
  entre mg et ml et conserve le passage complet dans evidence.dose.sourceText.
- Si dose pratique et dose pharmacologique figurent dans une meme phrase, evidence.dose.sourceText doit conserver la phrase
  entiere contenant les deux expressions, sans en supprimer une. Chaque bloc sourceText conserve sa propre expression complete.
- Accepte aussi les doses fixes par animal et les doses en mg/kg.
- Separe une injection initiale, un rappel conditionnel et la duree du traitement.
- administrationCount contient le nombre d'administrations. repeatCondition contient uniquement la condition
  de renouvellement. administrationInstructions contient uniquement les consignes pratiques (agiter,
  nettoyer, position du flacon, parage, seringue, ponctions), jamais la frequence.
- repeatCondition ne contient jamais la dose, la substance active ni la description complète de la seconde administration.
- Une seconde administration seulement possible ou conditionnelle ne compte pas dans administrationCount : une injection
  certaine puis une repetition eventuelle apres 72 h donne administrationCount=1 et repeatCondition renseigne.
- Les nombres des delais viande, abats ou lait ne sont jamais une duree de traitement.
- Recherche et conserve separement les trois delais meatDays, offalDays et milkDays lorsqu'ils sont ecrits.
  "viande et abats : 21 jours, lait : 7 jours" signifie meatDays=21, offalDays=21 et milkDays=7.
- Pour chaque champ important, fournis le texte source et une confiance entre 0 et 1.
- Si une information n'est pas lisible, mets null.`;

interface ImageEntree {
  data: string;
  mimeType: string;
}

function failureResponse(stage: OrdonnanceScanStage, status = 500) {
  return NextResponse.json(
    { error: ordonnanceScanUserMessage(stage), stage },
    { status },
  );
}

function construireResultat(
  parsed: Record<string, unknown> | null | undefined,
  raw: string,
  candidats: MedicamentCandidat[],
): OrdonnanceResult {
  const proposition = normaliserAnalyseOrdonnance(appliquerTranscriptionParBlocs(parsed), candidats);
  const premier = proposition.medicaments?.[0];
  return {
    ...proposition,
    // Miroir de compatibilite pour la reanalyse de l'ancien ecran de detail.
    dateDebut: proposition.prescriptionDate,
    medicamentNom: premier?.medicamentNom ?? null,
    voie: premier?.voie ?? null,
    dose: premier?.doseValue ?? null,
    uniteDosage: premier?.doseUnit ?? null,
    frequence: premier?.administrationInstructions ?? null,
    dureeJours: premier?.treatmentDurationDays ?? null,
    delaiAttenteViandeJ: premier?.withdrawalPeriods.meatDays ?? null,
    delaiAttenteLaitJ: premier?.withdrawalPeriods.milkDays ?? null,
    precautions: premier?.precautions ?? null,
    rappels: premier?.repeatCondition ?? null,
    raw,
    modele: MODEL,
    versionPrompt: PROMPT_VERSION,
    analyseLe: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!(await getAuthorizedEmail(req.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY non configuree" }, { status: 500 });
  }

  let body: { images?: ImageEntree[]; image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch (error) {
    logOrdonnanceScanFailure("document", error);
    return failureResponse("document", 400);
  }
  const images: ImageEntree[] = Array.isArray(body.images) && body.images.length > 0
    ? body.images.filter((image) => image && typeof image.data === "string" && image.data.length > 0)
    : body.image
      ? [{ data: body.image, mimeType: body.mimeType ?? "image/jpeg" }]
      : [];
  if (images.length === 0) {
    logOrdonnanceScanFailure("document", new Error("Aucune image fournie"));
    return failureResponse("document", 400);
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 5000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              ...images.map((image) => ({
                type: "image_url" as const,
                image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: "auto" as const },
              })),
              { type: "text", text: "Analyse toutes les pages de cette ordonnance." },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    logOrdonnanceScanFailure("openai_call", error);
    return failureResponse("openai_call", 502);
  }

  if (!response.ok) {
    logOrdonnanceScanFailure("openai_response", new Error(`Réponse HTTP ${response.status}`), {
      httpStatus: response.status,
    });
    return failureResponse("openai_response", 502);
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch (error) {
    logOrdonnanceScanFailure("openai_response", error);
    return failureResponse("openai_response", 502);
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const premierChoix = choices[0] && typeof choices[0] === "object"
    ? choices[0] as Record<string, unknown> : {};
  const message = premierChoix.message && typeof premierChoix.message === "object"
    ? premierChoix.message as Record<string, unknown> : {};
  const raw = typeof message.content === "string" ? message.content : "";
  if (!raw) {
    logOrdonnanceScanFailure("openai_response", new Error("Réponse OpenAI sans contenu"));
    return failureResponse("openai_response", 502);
  }

  let candidats: MedicamentCandidat[];
  try {
    candidats = await chargerCandidatsOrdonnance((args) => prisma.medicament.findMany(args));
  } catch (error) {
    logOrdonnanceScanFailure("pharmacy_candidates", error);
    return failureResponse("pharmacy_candidates");
  }

  let parsed: Record<string, unknown> = {};
  let jsonParseFailed = false;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    jsonParseFailed = true;
  }
  try {
    return NextResponse.json(construireResultat(parsed, raw, candidats));
  } catch (error) {
    logOrdonnanceScanFailure("transcription", error, { jsonParseFailed });
    return failureResponse("transcription");
  }
}
