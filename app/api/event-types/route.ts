import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/fuzzy-search";

export async function GET() {
  const types = await prisma.typeEvenement.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, synonymes: true, categorie: true },
  });
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nom = (body.nom as string | undefined)?.trim();
  if (!nom) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }

  const normalise = normalizeSearch(nom);
  const existants = await prisma.typeEvenement.findMany({
    select: { id: true, nom: true },
  });
  const match = existants.find((t) => normalizeSearch(t.nom) === normalise);
  if (match) {
    return NextResponse.json({ id: match.id, nom: match.nom, _reused: true });
  }

  try {
    const type = await prisma.typeEvenement.create({
      data: { nom, categorie: "AUTRE" },
    });
    return NextResponse.json({ id: type.id, nom: type.nom, _reused: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}
