import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import type { MedicamentPropose, PropositionOrdonnance } from "@/lib/ordonnance-types";
import { medicamentVide } from "@/lib/ordonnance-types";

export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const PROMPT_VERSION = "ordonnance-v2";

interface OrdonnanceResult extends PropositionOrdonnance {
  medicaments: MedicamentPropose[];
  raw: string;
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

const SYSTEM_PROMPT = `Tu analyses une ordonnance vétérinaire française pour bovins.
On te fournit UNE OU PLUSIEURS photos qui forment UNE SEULE ordonnance (pages 1/2, 2/2…) :
combine les informations de toutes les images. Réponds UNIQUEMENT en JSON valide, sans markdown.

Structure JSON attendue :
{
  "dateDebut": "date de prescription au format YYYY-MM-DD ou null",
  "ordonnanceNumero": "numéro imprimé sans le suffixe entre crochets, ex 26-03-0290, ou null",
  "veterinaire": "prénom et nom du vétérinaire prescripteur ou null",
  "motif": "motif ou diagnostic global mentionné ou null",
  "medicaments": [
    {
      "medicamentNom": "nom commercial complet du médicament (string ou null)",
      "numeroLot": "numéro de lot indiqué après 'n° lot' (string ou null)",
      "voie": "voie d'administration abrégée (IM, SC, IV, PO, nasale, cutanée…) (string ou null)",
      "dose": "dose numérique par animal, nombre uniquement sans l'unité (number ou null)",
      "uniteDosage": "unité de la dose (ml, mg, g, cp…) (string ou null)",
      "frequence": "fréquence d'administration (string ou null)",
      "dureeJours": "durée totale du traitement en jours (number ou null)",
      "delaiAttenteViandeJ": "délai d'attente viande en jours (number ou null)",
      "delaiAttenteLaitJ": "délai d'attente lait en jours (number ou null)",
      "precautions": "précautions d'emploi mentionnées (string ou null)",
      "rappels": "rappels ou administrations de suivi prévus (string ou null)"
    }
  ]
}

Règles importantes :
- Il peut y avoir plusieurs médicaments numérotés (1-, 2-, …) : mets un objet par médicament dans "medicaments".
- Le délai d'attente (viande / lait) est SOUVENT sur une autre page que le médicament : cherche-le dans toutes les images. "0 jour" ou "0 heure" => 0.
- Si une information n'est ni visible ni lisible, mets null.
- Réponds uniquement avec le JSON, sans explication.`;

interface ImageEntree {
  data: string; // base64 sans préfixe data:
  mimeType: string;
}

function normaliserMedicament(brut: unknown): MedicamentPropose {
  const m = (brut ?? {}) as Record<string, unknown>;
  const nombre = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    ...medicamentVide(),
    medicamentNom: texte(m.medicamentNom),
    numeroLot: texte(m.numeroLot),
    voie: texte(m.voie),
    dose: nombre(m.dose),
    uniteDosage: texte(m.uniteDosage),
    frequence: texte(m.frequence),
    dureeJours: nombre(m.dureeJours),
    delaiAttenteViandeJ: nombre(m.delaiAttenteViandeJ),
    delaiAttenteLaitJ: nombre(m.delaiAttenteLaitJ),
    precautions: texte(m.precautions),
    rappels: texte(m.rappels),
  };
}

function construireResultat(parsed: Record<string, unknown>, raw: string): OrdonnanceResult {
  const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  let medicaments: MedicamentPropose[] = [];
  if (Array.isArray(parsed.medicaments)) {
    medicaments = parsed.medicaments.map(normaliserMedicament).filter((m) => m.medicamentNom || m.dose || m.numeroLot);
  }
  // Repli : ancien format « à plat » (un seul médicament au niveau racine).
  if (medicaments.length === 0) {
    const seul = normaliserMedicament(parsed);
    if (seul.medicamentNom || seul.dose) medicaments = [seul];
  }
  if (medicaments.length === 0) medicaments = [medicamentVide()];

  return {
    dateDebut: texte(parsed.dateDebut),
    ordonnanceNumero: texte(parsed.ordonnanceNumero),
    veterinaire: texte(parsed.veterinaire),
    motif: texte(parsed.motif),
    medicaments,
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
    return NextResponse.json({ error: "OPENAI_API_KEY non configurée" }, { status: 500 });
  }

  let body: { images?: ImageEntree[]; image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // Accepte un tableau d'images (multi-pages) ou une image unique (rétrocompat).
  const images: ImageEntree[] = Array.isArray(body.images) && body.images.length > 0
    ? body.images.filter((i) => i && typeof i.data === "string" && i.data.length > 0)
    : body.image
      ? [{ data: body.image, mimeType: body.mimeType ?? "image/jpeg" }]
      : [];

  if (images.length === 0) {
    return NextResponse.json({ error: "Aucune image fournie" }, { status: 400 });
  }

  const imageBlocks = images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "auto" as const },
  }));

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: "Analyse cette ordonnance vétérinaire (toutes les pages fournies) et extrait les informations demandées en JSON.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", response.status, errText);
    let errMsg = `Erreur OpenAI (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) errMsg = errJson.error.message;
    } catch { /* keep default */ }
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";

  let result: OrdonnanceResult;
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    result = construireResultat(parsed, raw);
  } catch {
    result = construireResultat({}, raw);
  }

  return NextResponse.json(result);
}
