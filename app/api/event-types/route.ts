import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ECHO_ACTION_CATEGORY, ACTION_PREFIX, normEcho, actionLabel } from "@/lib/echo-session-extras";
import { normalizeSearch } from "@/lib/fuzzy-search";

export async function GET(request: NextRequest) {
  const actions=request.nextUrl.searchParams.get("kind")==="actions";
  const types = await prisma.typeEvenement.findMany({
    where: { actif: true, categorie: actions?ECHO_ACTION_CATEGORY:{not:ECHO_ACTION_CATEGORY} },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, synonymes: true, categorie: true },
  });
  return NextResponse.json(actions?types.map(t=>({...t,nom:actionLabel(t.nom)})):types);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nom = (body.nom as string | undefined)?.trim();
  if (!nom || normEcho(nom).startsWith(normEcho(ACTION_PREFIX))) {
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
