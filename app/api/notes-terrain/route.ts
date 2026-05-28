import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notes = await prisma.noteTerrain.findMany({
    where: { traitee: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const { texte } = await request.json();
  if (!texte?.trim()) {
    return NextResponse.json({ error: "texte requis" }, { status: 400 });
  }
  const note = await prisma.noteTerrain.create({
    data: { texte: texte.trim() },
  });
  return NextResponse.json(note, { status: 201 });
}
