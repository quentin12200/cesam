import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

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
  const {
    animalId, evenementId, medicamentId, medicamentNom, dateDebut, dureeJours, voie, frequence,
    dose, doseRecommandee, uniteDosage, poidsUtilise, motif, veterinaire,
    ordonnanceNumero, ordonnanceId, ordonnanceAAssocier, delaiAttenteViandeJ, delaiAttenteLaitJ, notes,
  } = body;

  if (!animalId || !medicamentNom?.trim() || !dateDebut) {
    return NextResponse.json({ error: "animalId, medicamentNom et dateDebut requis" }, { status: 400 });
  }

  if (!evenementId || !medicamentId) {
    return NextResponse.json(
      { error: "Tout nouveau traitement doit etre lie a un evenement sanitaire et a un medicament de la Pharmacie" },
      { status: 400 }
    );
  }

  if (evenementId) {
    const evenement = await prisma.evenementSanitaire.findFirst({
      where: { id: evenementId, animalId },
      select: { id: true },
    });
    if (!evenement) {
      return NextResponse.json(
        { error: "Événement introuvable pour cet animal" },
        { status: 400 }
      );
    }
  }

  const traitement = await prisma.traitement.create({
    data: {
      animalId,
      evenementId: evenementId ?? null,
      medicamentId: medicamentId ?? null,
      medicamentNom: medicamentNom.trim(),
      dateDebut: new Date(dateDebut),
      dureeJours: dureeJours ?? 1,
      voie: voie?.trim() || null,
      frequence: frequence?.trim() || null,
      dose: dose ?? null,
      doseRecommandee: doseRecommandee ?? null,
      uniteDosage: uniteDosage?.trim() || null,
      poidsUtilise: poidsUtilise ?? null,
      motif: motif?.trim() || null,
      veterinaire: veterinaire?.trim() || null,
      ordonnanceNumero: ordonnanceNumero?.trim() || null,
      ordonnanceId: ordonnanceId ?? null,
      ordonnanceAAssocier: ordonnanceAAssocier ?? false,
      delaiAttenteViandeJ: delaiAttenteViandeJ ?? null,
      delaiAttenteLaitJ: delaiAttenteLaitJ ?? null,
      notes: notes?.trim() || null,
      statut: "EN_COURS",
    },
    include: {
      animal: { select: { id: true, nutrav: true, nobovi: true } },
      medicament: { select: { id: true, nom: true, delaiAttenteViandeJ: true } },
    },
  });

  const desc = `Traitement ${traitement.medicamentNom} enregistré pour ${traitement.animal.nutrav}`;
  let undoId = "";
  try {
    undoId = await logAction("CREATE_TRAITEMENT", desc, { op: "delete", model: "traitement", id: traitement.id });
  } catch {}

  return NextResponse.json({ ...traitement, _undoId: undoId, _undoDesc: desc }, { status: 201 });
}

