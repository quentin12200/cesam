import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const groupes = await prisma.groupe.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { animaux: true } } },
  });
  return NextResponse.json(groupes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, couleur } = body;
  if (!nom?.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  try {
    const groupe = await prisma.groupe.create({
      data: { nom: nom.trim(), couleur: couleur ?? null },
    });
    return NextResponse.json({ success: true, groupe });
  } catch {
    return NextResponse.json({ error: "Ce nom de groupe existe déjà" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.groupe.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
