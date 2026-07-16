import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const statut = body.statut === "A_VOIR" ? "A_VOIR" : body.statut === "FAIT" ? "FAIT" : null;
  if (!statut) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const existing = await prisma.parage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Ligne de parage introuvable" }, { status: 404 });

  const parage = await prisma.parage.update({
    where: { id },
    data: { statut, dateFait: statut === "FAIT" ? new Date() : null },
  });
  return NextResponse.json({ id: parage.id, statut: parage.statut });
}
