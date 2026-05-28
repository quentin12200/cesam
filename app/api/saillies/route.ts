import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalId, date, type, groupage, taureauId, tentative } = body;

    if (!animalId || !date || !type) {
      return NextResponse.json({ error: "Champs manquants: animalId, date, type requis" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { nutrav: true, nobovi: true } });

    const saillie = await prisma.saillie.create({
      data: {
        animalId,
        date: new Date(date),
        type,
        groupage: groupage ?? false,
        tentative: tentative ?? 1,
        taureauId: taureauId ?? null,
        updatedAt: new Date(),
      },
    });

    // Créer une gestation associée en état GRIS
    const gestation = await prisma.gestation.create({
      data: {
        saillieId: saillie.id,
        etat: "GRIS",
        updatedAt: new Date(),
      },
    });

    const desc = `Saillie enregistrée pour ${animal?.nobovi ?? animal?.nutrav ?? animalId}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_SAILLIE", desc, [
        { op: "delete", model: "gestation", id: gestation.id },
        { op: "delete", model: "saillie", id: saillie.id },
      ]);
    } catch {}

    return NextResponse.json({ ...saillie, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/saillies error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
