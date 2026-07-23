import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;
  const body = await request.json().catch(() => ({})) as { motif?: string };
  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    select: {
      id: true,
      sexbov: true,
      demandesEchographie: { where: { etat: "A_FAIRE" }, take: 1, select: { id: true } },
      saillies: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1, select: { id: true } },
    },
  });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
  if (animal.sexbov !== "F") return NextResponse.json({ error: "Cette action concerne une femelle" }, { status: 400 });
  if (animal.demandesEchographie[0]) {
    return NextResponse.json({ request: animal.demandesEchographie[0], duplicate: true });
  }

  const requestEcho = await prisma.$transaction(async (tx) => {
    const created = await tx.demandeEchographie.create({
      data: {
        animalId: animal.id,
        saillieId: animal.saillies[0]?.id ?? null,
        origine: "MANUELLE",
        etat: "A_FAIRE",
        motif: body.motif?.trim() || null,
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
    select: { id: true, demandesEchographie: { where: { etat: "A_FAIRE" }, select: { id: true } } },
  });
  if (!animal) return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });

  await prisma.$transaction([
    prisma.demandeEchographie.updateMany({
      where: { id: { in: animal.demandesEchographie.map((item) => item.id) }, origine: "AUTOMATIQUE" },
      data: { etat: "RETIREE", clotureeAt: new Date() },
    }),
    prisma.demandeEchographie.updateMany({
      where: { id: { in: animal.demandesEchographie.map((item) => item.id) }, origine: "MANUELLE" },
      data: { etat: "RETIREE", clotureeAt: new Date(), requestKey: null },
    }),
    prisma.animal.update({ where: { id: animal.id }, data: { aEchographier: false } }),
  ]);
  return NextResponse.json({ success: true });
}
