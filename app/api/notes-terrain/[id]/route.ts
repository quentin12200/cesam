import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const note = await prisma.noteTerrain.update({
    where: { id },
    data: {
      ...(typeof body.traitee === "boolean" ? { traitee: body.traitee } : {}),
      ...(body.texte ? { texte: body.texte.trim() } : {}),
    },
  });
  return NextResponse.json(note);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.noteTerrain.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
