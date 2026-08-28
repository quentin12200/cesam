import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { StatutProtocoleVaccinal } from "@/lib/vaccine-planner";

const STATUTS = new Set<StatutProtocoleVaccinal>([
  "PROTOCOLE_ACQUIS",
  "PRIMO_A_FAIRE",
  "PRIMO_EN_COURS",
  "A_CONFIRMER",
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const statuts = await prisma.statutProtocoleVaccinal.findMany({
    where: { protocoleId: id },
    include: { animal: { select: { id: true, nutrav: true, nobovi: true } } },
    orderBy: { animal: { nutrav: "asc" } },
  });
  return NextResponse.json(statuts);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: protocoleId } = await params;
  const body = await request.json();
  const animalIds = [...new Set(Array.isArray(body.animalIds) ? body.animalIds.filter((id: unknown) => typeof id === "string") : [])] as string[];
  if (animalIds.length === 0 || !STATUTS.has(body.statut)) {
    return NextResponse.json({ error: "Animaux et statut valides requis" }, { status: 400 });
  }
  const [protocole, animaux] = await Promise.all([
    prisma.protocoleVaccin.findUnique({ where: { id: protocoleId }, select: { id: true } }),
    prisma.animal.findMany({ where: { id: { in: animalIds } }, select: { id: true } }),
  ]);
  if (!protocole || animaux.length !== animalIds.length) {
    return NextResponse.json({ error: "Protocole ou animal introuvable" }, { status: 404 });
  }
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "MANUEL";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const confirmeAt = new Date();
  await prisma.$transaction(animalIds.map((animalId) => prisma.statutProtocoleVaccinal.upsert({
    where: { animalId_protocoleId: { animalId, protocoleId } },
    create: { animalId, protocoleId, statut: body.statut, source, notes, confirmeAt },
    update: { statut: body.statut, source, notes, confirmeAt },
  })));
  return NextResponse.json({ count: animalIds.length }, { status: 201 });
}
