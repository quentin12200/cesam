import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const marchand = await prisma.marchand.findUnique({ where: { id } });
  if (!marchand) return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
  await prisma.marchand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
