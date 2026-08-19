import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleNomMarchand } from "@/lib/marchands";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marchand = await prisma.marchand.findUnique({ where: { id } });
  if (!marchand) return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
  const tous = await prisma.marchand.findMany({ select: { id: true, nom: true } });
  const ids = tous.filter((item) => cleNomMarchand(item.nom) === cleNomMarchand(marchand.nom)).map((item) => item.id);
  await prisma.marchand.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true });
}
