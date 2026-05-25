import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface OrdonnanceResult {
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  dureeJours: number | null;
  dateDebut: string | null;
  veterinaire: string | null;
  motif: string | null;
  delaiAttenteViandeJ: number | null;
  raw: string;
}

const SYSTEM_PROMPT = `Tu es un assistant vétérinaire qui analyse des ordonnances françaises.
Extrait les informations suivantes de l'image fournie et réponds UNIQUEMENT en JSON valide, sans markdown.
Voici les champs à extraire :
- medicamentNom: nom commercial ou DCI du médicament principal (string ou null)
- voie: voie d'administration abrégée (ex: "IM", "SC", "IV", "PO", "cutanée", etc.) (string ou null)
- dose: dose numérique (nombre uniquement, pas l'unité) (number ou null)
- uniteDosage: unité de la dose (ex: "ml", "mg", "g", "cp") (string ou null)
- dureeJours: durée totale du traitement en jours (number ou null)
- dateDebut: date de prescription au format YYYY-MM-DD (string ou null)
- veterinaire: prénom et nom du vétérinaire prescripteur (string ou null)
- motif: motif ou diagnostic mentionné (string ou null)
- delaiAttenteViandeJ: délai d'attente viande en jours s'il est mentionné (number ou null)

Si une information n'est pas visible ou lisible, mets null.
Réponds uniquement avec le JSON, pas d'explication.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY non configurée" }, { status: 500 });
  }

  let body: { image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "Image manquante" }, { status: 400 });
  }

  const mimeType = body.mimeType ?? "image/jpeg";
  const imageUrl = `data:${mimeType};base64,${body.image}`;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "auto" },
            },
            {
              type: "text",
              text: "Analyse cette ordonnance vétérinaire et extrait les informations demandées en JSON.",
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
    const parsed = JSON.parse(cleaned);
    result = { ...parsed, raw };
  } catch {
    result = {
      medicamentNom: null,
      voie: null,
      dose: null,
      uniteDosage: null,
      dureeJours: null,
      dateDebut: null,
      veterinaire: null,
      motif: null,
      delaiAttenteViandeJ: null,
      raw,
    };
  }

  return NextResponse.json(result);
}
