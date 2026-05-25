import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statut = searchParams.get("statut");
  const animalId = searchParams.get("animalId");

  const traitements = await prisma.traitement.findMany({
    where: {
      ...(statut ? { statut } : {}),
      ...(animalId ? { animalId } : {}),
    },
    include: {
      animal: { select: { id: true, nutrav: true, nobovi: true } },
      medicament: { select: { id: true, nom: true, delaiAttenteViandeJ: true } },
    },
    orderBy: { dateDebut: "desc" },
  });

  return NextResponse.json(traitements);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { animalId, medicamentId, medicamentNom, dateDebut, dureeJours, voie, dose, uniteDosage, motif, veterinaire, notes } = body;

  if (!animalId || !medicamentNom?.trim() || !dateDebut) {
    return NextResponse.json({ error: "animalId, medicamentNom et dateDebut requis" }, { status: 400 });
  }

  const traitement = await prisma.traitement.create({
    data: {
      animalId,
      medicamentId: medicamentId ?? null,
      medicamentNom: medicamentNom.trim(),
      dateDebut: new Date(dateDebut),
      dureeJours: dureeJours ?? 1,
      voie: voie?.trim() || null,
      dose: dose ?? null,
      uniteDosage: uniteDosage?.trim() || null,
      motif: motif?.trim() || null,
      veterinaire: veterinaire?.trim() || null,
      notes: notes?.trim() || null,
      statut: "EN_COURS",
    },
    include: {
      animal: { select: { id: true, nutrav: true, nobovi: true } },
      medicament: { select: { id: true, nom: true, delaiAttenteViandeJ: true } },
    },
  });

  return NextResponse.json(traitement, { status: 201 });
}
