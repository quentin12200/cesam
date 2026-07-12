import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/fuzzy-search";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { typeEvenementId, nom } = body;

  const evenement = await prisma.evenementSanitaire.findUnique({ where: { id } });
  if (!evenement) return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });

  let resolvedTypeId: string | null = typeEvenementId ?? null;
  let resolvedNom: string = nom?.trim() ?? "";

  if (resolvedTypeId) {
    const type = await prisma.typeEvenement.findUnique({ where: { id: resolvedTypeId } });
    if (!type) return NextResponse.json({ error: "Type d'événement introuvable" }, { status: 404 });
    resolvedNom = type.nom;
  } else if (resolvedNom) {
    const normalise = normalizeSearch(resolvedNom);
    const existants = await prisma.typeEvenement.findMany({ select: { id: true, nom: true } });
    const match = existants.find((t) => normalizeSearch(t.nom) === normalise);
    if (match) {
      resolvedTypeId = match.id;
      resolvedNom = match.nom;
    } else {
      const created = await prisma.typeEvenement.create({ data: { nom: resolvedNom, categorie: "AUTRE" } });
      resolvedTypeId = created.id;
      resolvedNom = created.nom;
    }
  } else {
    return NextResponse.json({ error: "typeEvenementId ou nom requis" }, { status: 400 });
  }

  const dejaPresent = await prisma.evenementSymptome.findFirst({
    where: { evenementId: id, typeEvenementId: resolvedTypeId },
  });
  if (dejaPresent) {
    return NextResponse.json({ error: "Cet événement est déjà présent" }, { status: 409 });
  }

  const symptome = await prisma.evenementSymptome.create({
    data: { evenementId: id, typeEvenementId: resolvedTypeId, libelle: resolvedNom },
  });

  const questions = resolvedTypeId
    ? await prisma.questionTemplate.findMany({
        where: { typeEvenementId: resolvedTypeId, actif: true },
        orderBy: { ordre: "asc" },
      })
    : [];

  return NextResponse.json({
    symptome: { id: symptome.id, libelle: symptome.libelle, typeEvenementId: symptome.typeEvenementId },
    questions: questions.map((q) => ({ ...q, options: q.options ? JSON.parse(q.options) : null })),
  }, { status: 201 });
}
