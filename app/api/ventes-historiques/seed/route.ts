import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VENTES_HISTORIQUES } from "./data";

export async function POST() {
  try {
    // Vider les données existantes pour éviter les doublons
    await prisma.venteHistorique.deleteMany({});

    const data = VENTES_HISTORIQUES.map((r) => ({
      annee: r.annee,
      typeAnimal: r.typeAnimal,
      typeVente: r.typeVente,
      nutrav: r.nutrav ?? null,
      sexe: r.sexe ?? null,
      poidsVif: r.poidsVif ?? null,
      prixKgVif: r.prixKgVif ?? null,
      poidsCarc: r.poidsCarc ?? null,
      prixKgCarc: r.prixKgCarc ?? null,
      acheteur: r.acheteur ?? null,
      date: new Date(r.date),
      total: r.total ?? null,
      updatedAt: new Date(),
    }));

    await prisma.venteHistorique.createMany({ data });
    return NextResponse.json({ ok: true, count: data.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
