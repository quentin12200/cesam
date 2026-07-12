import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const animaux = await prisma.animal.findMany({
    where: { statut: "ACTIF" },
    orderBy: { nutrav: "asc" },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      nunati: true,
      danais: true,
      sexbov: true,
      estGenisse: true,
      categorie: true,
      groupeId: true,
      groupe: { select: { nom: true } },
    },
  });

  return NextResponse.json(
    animaux.map((a) => ({
      id: a.id,
      nutrav: a.nutrav,
      nobovi: a.nobovi,
      nunati: a.nunati,
      danais: a.danais.toISOString(),
      sexbov: a.sexbov,
      estGenisse: a.estGenisse,
      categorie: a.categorie,
      groupeId: a.groupeId,
      groupeNom: a.groupe?.nom ?? null,
    }))
  );
}
