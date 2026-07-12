import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const animalIds: string[] = Array.isArray(body.animalIds) ? body.animalIds : [];
  if (animalIds.length === 0) {
    return NextResponse.json({ error: "animalIds requis" }, { status: 400 });
  }

  const source = await prisma.evenementSanitaire.findUnique({
    where: { id },
    include: { symptomes: true, reponses: true },
  });
  if (!source) return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });

  const ciblesValides = animalIds.filter((aid) => aid !== source.animalId);
  if (ciblesValides.length === 0) {
    return NextResponse.json({ error: "Aucun animal supplémentaire à ajouter" }, { status: 400 });
  }

  const now = new Date();
  const crees = await prisma.$transaction(
    ciblesValides.map((animalId) =>
      prisma.evenementSanitaire.create({
        data: {
          animalId,
          categorie: source.categorie,
          type: source.type,
          date: source.date,
          moment: source.moment,
          temperature: source.temperature,
          description: source.description,
          photos: source.photos,
          constatePar: source.constatePar,
          updatedAt: now,
          symptomes: {
            create: source.symptomes.map((s) => ({ typeEvenementId: s.typeEvenementId, libelle: s.libelle })),
          },
          reponses: {
            create: source.reponses.map((r) => ({ questionId: r.questionId, valeur: r.valeur, libelleEnregistre: r.libelleEnregistre })),
          },
        },
      })
    )
  );

  const desc = `Événement "${source.type}" ajouté à ${crees.length} animal(x) supplémentaire(s)`;
  let undoId = "";
  try {
    undoId = await logAction(
      "DUPLIQUER_EVENEMENT_SANITAIRE",
      desc,
      crees.map((e) => ({ op: "delete" as const, model: "evenementSanitaire", id: e.id }))
    );
  } catch {}

  return NextResponse.json({ count: crees.length, evenements: crees.map((e) => ({ id: e.id, animalId: e.animalId })), _undoId: undoId, _undoDesc: desc }, { status: 201 });
}
