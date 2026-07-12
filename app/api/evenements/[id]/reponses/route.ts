import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { questionId, valeur, libelleEnregistre } = body;

  if (!questionId) {
    return NextResponse.json({ error: "questionId requis" }, { status: 400 });
  }

  const evenement = await prisma.evenementSanitaire.findUnique({ where: { id } });
  if (!evenement) return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });

  if (valeur === undefined || valeur === null || valeur === "") {
    await prisma.questionReponse.deleteMany({ where: { evenementId: id, questionId } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const reponse = await prisma.questionReponse.upsert({
    where: { evenementId_questionId: { evenementId: id, questionId } },
    create: {
      evenementId: id,
      questionId,
      valeur: JSON.stringify(valeur),
      libelleEnregistre: libelleEnregistre ?? "",
    },
    update: {
      valeur: JSON.stringify(valeur),
      ...(libelleEnregistre !== undefined && { libelleEnregistre }),
    },
  });

  return NextResponse.json(reponse);
}
