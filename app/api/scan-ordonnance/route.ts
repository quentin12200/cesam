import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { prisma } from "@/lib/prisma";
import type { PropositionOrdonnance } from "@/lib/ordonnance-types";
import { normaliserAnalyseOrdonnance, type MedicamentCandidat } from "@/lib/ordonnance-extraction";

export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const PROMPT_VERSION = "ordonnance-v3-structuree";

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
      "dose": { "value": "texte interprete", "sourceText": "texte exact", "confidence": 0.95, "zone": "prescription" }
    }
  }]
}

Regles obligatoires :
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
- Une dose "1 ml pour 10 kg" est ponderale : doseValue=1, referenceValue=10, referenceType=live_weight, normalizedDoseValue=0.1. Ce n'est pas une dose fixe de 1 ml.
- Lorsqu'une dose pratique (ml, g, comprime ou bolus) et une dose de substance active en mg/kg sont toutes les deux lisibles,
  renseigne doseValue/doseUnit/referenceValue/referenceUnit avec la dose pratique. Conserve le passage complet dans
  evidence.dose.sourceText afin que la dose pharmacologique reste verifiable. N'invente aucune conversion entre mg et ml.
- Accepte aussi les doses fixes par animal et les doses en mg/kg.
- Separe une injection initiale, un rappel conditionnel et la duree du traitement.
- administrationCount contient le nombre d'administrations. repeatCondition contient uniquement la condition
  de renouvellement. administrationInstructions contient uniquement les consignes pratiques (agiter,
  nettoyer, position du flacon, parage, seringue, ponctions), jamais la frequence.
- Les nombres des delais viande, abats ou lait ne sont jamais une duree de traitement.
- Recherche et conserve separement les trois delais meatDays, offalDays et milkDays lorsqu'ils sont ecrits.
  "viande et abats : 21 jours, lait : 7 jours" signifie meatDays=21, offalDays=21 et milkDays=7.
- Pour chaque champ important, fournis le texte source et une confiance entre 0 et 1.
- Si une information n'est pas lisible, mets null.`;

interface ImageEntree {
  data: string;
  mimeType: string;
}

async function chargerCandidats(): Promise<MedicamentCandidat[]> {
  const medicaments = await prisma.medicament.findMany({
    // La pharmacie affiche aussi les fiches inactives : elles doivent rester
    // reconnaissables pour éviter de recréer un médicament déjà existant.
    orderBy: { nom: "asc" },
    select: {
      id: true,
      nom: true,
      dci: true,
      forme: true,
      categorie: true,
      voie: true,
      delaiAttenteViandeJ: true,
      delaiAttenteLaitJ: true,
      aliasesVocaux: { select: { alias: true, transcription: true } },
    },
  });
  return medicaments.map((medicament) => ({
    ...medicament,
    aliases: medicament.aliasesVocaux.flatMap((alias) => [alias.alias, alias.transcription]),
  }));
}

function construireResultat(
  parsed: Record<string, unknown> | null | undefined,
  raw: string,
  candidats: MedicamentCandidat[],
): OrdonnanceResult {
  const proposition = normaliserAnalyseOrdonnance(parsed, candidats);
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
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide" }, { status: 400 });
  }
  const images: ImageEntree[] = Array.isArray(body.images) && body.images.length > 0
    ? body.images.filter((image) => image && typeof image.data === "string" && image.data.length > 0)
    : body.image
      ? [{ data: body.image, mimeType: body.mimeType ?? "image/jpeg" }]
      : [];
  if (images.length === 0) {
    return NextResponse.json({ error: "Aucune image fournie" }, { status: 400 });
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    return NextResponse.json({ error: `Erreur d'analyse (${response.status})` }, { status: 502 });
  }

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const candidats = await chargerCandidats();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return NextResponse.json(construireResultat(parsed, raw, candidats));
  } catch {
    return NextResponse.json(construireResultat({}, raw, candidats));
  }
}
