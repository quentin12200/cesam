import { NextRequest, NextResponse } from "next/server";
import { createManualEchoRequest } from "@/lib/manual-echo-requests";
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
  const result = await createManualEchoRequest({
    nutrav,
    motif: body.motif,
    datePlanification: body.datePlanification,
    observation: body.observation,
    saillieId: body.saillieId,
  });
  if (result.status === "NOT_FOUND") return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
  if (result.status === "NOT_FEMALE") return NextResponse.json({ error: "Cette action concerne une femelle" }, { status: 400 });
  if (result.status === "INVALID_BREEDING") {
    return NextResponse.json({ error: "La tentative sélectionnée n’appartient pas au cycle actuel" }, { status: 400 });
  }
  return NextResponse.json(
    { request: result.request, duplicate: result.status === "ALREADY_ACTIVE" },
    { status: result.status === "ADDED" ? 201 : 200 },
  );
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
