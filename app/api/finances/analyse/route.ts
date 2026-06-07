import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { stats } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Format stats pour le prompt
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
    }) => `${s.annee}: ${s.veauxCount} veaux vif (${Math.round(s.veauxKgTotal)} kg, prix moy ${s.veauxPrixMoyen?.toFixed(2) ?? "—"}€/kg, CA ${Math.round(s.veauxCA)}€) | ${s.vachesCount} vaches boucherie (${Math.round(s.vachesKgCarcasse)} kg carcasse, prix moy ${s.vachesPrixMoyen?.toFixed(2) ?? "—"}€/kg, CA ${Math.round(s.vachesCA)}€) | CA total ${Math.round(s.caTotal)}€ | taux productivité ${s.tauxProductivite ?? "—"}%`
    ).join("\n");

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Tu es un conseiller agricole expert en élevage bovin allaitant. Analyse les données de vente de ce GAEC sur plusieurs années et donne une interprétation concrète, utile et bienveillante. Sois direct, précis, et parle en agriculteur à agriculteur.

Données de vente :
${lines}

Donne une analyse structurée en 3-4 paragraphes courts :
1. Tendance globale du chiffre d'affaires et des volumes
2. Évolution des prix au kilo (veaux et vaches) et ce que ça révèle du marché
3. Productivité : analyse du taux veaux vendus / vêlages et ce que ça dit de l'efficacité du troupeau
4. Points forts, points de vigilance, et 1-2 recommandations concrètes

Réponds en français, de façon claire et sans jargon inutile. Maximum 250 mots.`
        }
      ]
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ analyse: text });
  } catch (err) {
    console.error("POST /api/finances/analyse error:", err);
    return NextResponse.json({ error: "Erreur lors de l'analyse" }, { status: 500 });
  }
}
