import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;
  const body = await request.json().catch(() => ({})) as {
    motif?: string;
    datePlanification?: string;
    observation?: string;
    saillieId?: string | null;
  };
  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    select: {
      id: true,
      sexbov: true,
      demandesEchographie: { where: { etat: "A_FAIRE" }, take: 1, select: { id: true } },
      saillies: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { id: true } },
    },
  });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
  if (animal.sexbov !== "F") return NextResponse.json({ error: "Cette action concerne une femelle" }, { status: 400 });
  if (animal.demandesEchographie[0]) {
    return NextResponse.json({ request: animal.demandesEchographie[0], duplicate: true });
  }
  const requestedBreedingId = body.saillieId ?? animal.saillies[0]?.id ?? null;
  if (requestedBreedingId && !animal.saillies.some((saillie) => saillie.id === requestedBreedingId)) {
    return NextResponse.json({ error: "La tentative sélectionnée n’appartient pas à cet animal" }, { status: 400 });
  }

  const requestEcho = await prisma.$transaction(async (tx) => {
    const created = await tx.demandeEchographie.create({
      data: {
        animalId: animal.id,
        saillieId: requestedBreedingId,
        origine: "MANUELLE",
        etat: "A_FAIRE",
        motif: body.motif?.trim() || null,
        planifieeAt: body.datePlanification ? new Date(body.datePlanification) : new Date(),
        observation: body.observation?.trim() || null,
        requestKey: `MANUAL_ACTIVE:${animal.id}`,
      },
    });
    await tx.animal.update({ where: { id: animal.id }, data: { aEchographier: true } });
    return created;
  });
  return NextResponse.json({ request: requestEcho }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;
  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    select: { id: true, demandesEchographie: { where: { etat: "A_FAIRE", origine: "MANUELLE" }, select: { id: true } } },
  });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.demandeEchographie.updateMany({
      where: { id: { in: animal.demandesEchographie.map((item) => item.id) } },
      data: { etat: "RETIREE", clotureeAt: new Date(), requestKey: null },
    });
    const remainingActive = await tx.demandeEchographie.count({ where: { animalId: animal.id, etat: "A_FAIRE" } });
    await tx.animal.update({ where: { id: animal.id }, data: { aEchographier: remainingActive > 0 } });
  });
  return NextResponse.json({ success: true });
}
