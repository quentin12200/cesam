import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reliquatFlacon } from "@/lib/vaccine-planner";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const dosesUtilisees = Number(body.dosesUtilisees);
  if (!Number.isFinite(dosesUtilisees) || dosesUtilisees <= 0) {
    return NextResponse.json({ error: "Nombre de doses invalide" }, { status: 400 });
  }
  const actuelle = await prisma.utilisationFlaconVaccin.findUnique({
    where: { id },
    include: { flacon: { include: { utilisations: { select: { id: true, dosesUtilisees: true } } } } },
  });
  if (!actuelle) return NextResponse.json({ error: "Utilisation introuvable" }, { status: 404 });
  const restantesSansCetteUtilisation = reliquatFlacon(
    actuelle.flacon.dosesInitiales,
    actuelle.flacon.utilisations.filter((utilisation) => utilisation.id !== id)
  );
  if (dosesUtilisees > restantesSansCetteUtilisation) {
    return NextResponse.json({ error: "Reliquat insuffisant" }, { status: 400 });
  }
  const utilisation = await prisma.utilisationFlaconVaccin.update({ where: { id }, data: {
    dosesUtilisees,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  }});
  return NextResponse.json(utilisation);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.utilisationFlaconVaccin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
