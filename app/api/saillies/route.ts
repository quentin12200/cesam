import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalId, animalIds: requestedAnimalIds, date, type, groupage, taureauId, tentative, estimation } = body;
    const typeNormalise = typeof type === "string" ? type.trim().toUpperCase() : "";
    const parsedDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date) ? new Date(date) : new Date(NaN);
    const validDate = !Number.isNaN(parsedDate.getTime());
    const validTaureauId = taureauId == null || (typeof taureauId === "string" && taureauId.trim().length > 0);
    const validTentative = tentative == null || (Number.isInteger(tentative) && tentative >= 1);
    const animalIds = [...new Set<string>(
      Array.isArray(requestedAnimalIds) ? requestedAnimalIds.filter((id): id is string => typeof id === "string" && id.length > 0) : animalId ? [animalId] : []
    )];

    if (animalIds.length === 0 || !validDate || !validTaureauId || !validTentative || !["NATURELLE", "IA"].includes(typeNormalise)) {
      return NextResponse.json({ error: "Champs manquants: animalId(s), date, type requis" }, { status: 400 });
    }

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
