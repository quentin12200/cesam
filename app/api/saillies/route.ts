import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { validateBreedingInput } from "@/lib/validate-breeding";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateBreedingInput(body);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    const { animalIds, date: parsedDate, type: typeNormalise, taureauId, tentative } = validated;
    const { groupage, estimation } = body;

    const animaux = await prisma.animal.findMany({ where: { id: { in: animalIds } }, select: { nutrav: true, nobovi: true } });
    if (animaux.length !== animalIds.length) {
      return NextResponse.json({ error: "Un ou plusieurs animaux sont introuvables." }, { status: 400 });
    }
    if (taureauId != null) {
      const taureau = await prisma.taureau.findUnique({ where: { id: taureauId }, select: { id: true } });
      if (!taureau) return NextResponse.json({ error: "Taureau introuvable." }, { status: 400 });
    }
    const creations = await prisma.$transaction(async (tx) => {
      const resultats = [];
      for (const id of animalIds) {
        const saillie = await tx.saillie.create({
          data: {
            animalId: id,
            date: parsedDate,
            type: typeNormalise,
            estimation: estimation === true,
            groupage: groupage ?? false,
            tentative: tentative ?? 1,
            taureauId: taureauId ?? null,
            updatedAt: new Date(),
          },
        });
        const gestation = await tx.gestation.create({
          data: { saillieId: saillie.id, etat: "GRIS", updatedAt: new Date() },
        });
        resultats.push({ saillie, gestation });
      }
      return resultats;
    });

    const desc = animalIds.length > 1
      ? `Saillie enregistrée pour ${animalIds.length} vaches`
      : `Saillie enregistrée pour ${animaux[0]?.nobovi ?? animaux[0]?.nutrav ?? animalIds[0]}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_SAILLIE", desc, creations.flatMap(({ saillie, gestation }) => [
        { op: "delete" as const, model: "gestation", id: gestation.id },
        { op: "delete" as const, model: "saillie", id: saillie.id },
      ]));
    } catch {}

    return NextResponse.json({ ...creations[0].saillie, count: creations.length, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/saillies error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
