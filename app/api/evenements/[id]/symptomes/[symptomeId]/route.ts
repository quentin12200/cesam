import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; symptomeId: string }> }
) {
  const { id, symptomeId } = await params;

  const evenement = await prisma.evenementSanitaire.findUnique({
    where: { id },
    include: { symptomes: true },
  });
  if (!evenement) return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });

  const symptome = evenement.symptomes.find((s) => s.id === symptomeId);
  if (!symptome) return NextResponse.json({ error: "Symptôme non trouvé" }, { status: 404 });

  if (evenement.symptomes.length <= 1) {
    return NextResponse.json({ error: "Il doit rester au moins un événement" }, { status: 400 });
  }

  if (symptome.typeEvenementId) {
    const questions = await prisma.questionTemplate.findMany({
      where: { typeEvenementId: symptome.typeEvenementId },
      select: { id: true },
    });
    if (questions.length > 0) {
      await prisma.questionReponse.deleteMany({
        where: { evenementId: id, questionId: { in: questions.map((q) => q.id) } },
      });
    }
  }

  await prisma.evenementSymptome.delete({ where: { id: symptomeId } });

  let nouveauType = evenement.type;
  if (evenement.type === symptome.libelle) {
    const restant = evenement.symptomes.find((s) => s.id !== symptomeId);
    if (restant) {
      nouveauType = restant.libelle;
      await prisma.evenementSanitaire.update({ where: { id }, data: { type: nouveauType } });
    }
  }

  return NextResponse.json({ ok: true, type: nouveauType });
}
