import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { stats } = await req.json();
    if (!Array.isArray(stats) || stats.length > 30 || !stats.every((s) => s && typeof s === "object" && Number.isFinite(s.annee) && Number.isFinite(s.caTotal))) {
      return NextResponse.json({ error: "Données financières invalides" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API OpenAI non configurée (OPENAI_API_KEY manquant)" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const lines = stats.map((s: {
      annee: number;
      veauxCount: number;
      veauxKgTotal: number;
      veauxPrixMoyen: number | null;
      veauxCA: number;
      vachesCount: number;
      vachesKgCarcasse: number;
      vachesPrixMoyen: number | null;
      vachesCA: number;
      caTotal: number;
      tauxProductivite: number | null;
    }) =>
      `${s.annee}: ${s.veauxCount} veaux vif (${Math.round(s.veauxKgTotal)} kg, prix moy ${s.veauxPrixMoyen?.toFixed(2) ?? "—"}€/kg, CA ${Math.round(s.veauxCA)}€) | ${s.vachesCount} vaches boucherie (${Math.round(s.vachesKgCarcasse)} kg carcasse, prix moy ${s.vachesPrixMoyen?.toFixed(2) ?? "—"}€/kg, CA ${Math.round(s.vachesCA)}€) | CA total ${Math.round(s.caTotal)}€ | taux productivité ${s.tauxProductivite ?? "—"}%`
    ).join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Tu es un conseiller agricole expert en élevage bovin allaitant. Tu analyses des données de vente et donnes des conseils concrets, bienveillants et directs, comme un pair agriculteur.",
        },
        {
          role: "user",
          content: `Analyse les données de vente de ce GAEC sur plusieurs années et donne une interprétation utile.

Données :
${lines}

Structure ton analyse en 4 paragraphes courts :
1. Tendance globale du chiffre d'affaires et des volumes
2. Évolution des prix au kilo (veaux et vaches) et ce que ça révèle du marché
3. Productivité : analyse du taux veaux vendus / vêlages et efficacité du troupeau
4. Points forts, points de vigilance, et 1-2 recommandations concrètes

Réponds en français, clairement, sans jargon inutile. Maximum 250 mots.`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ analyse: text });
  } catch (err) {
    console.error("POST /api/finances/analyse error:", err);
    return NextResponse.json({ error: "L’analyse financière est momentanément indisponible." }, { status: 500 });
  }
}
