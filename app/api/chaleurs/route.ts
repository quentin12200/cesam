import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const { animalId, animalIds: requestedAnimalIds, date, notes } = await request.json();
    const animalIds = [...new Set<string>(
      Array.isArray(requestedAnimalIds) ? requestedAnimalIds.filter((id): id is string => typeof id === "string" && id.length > 0) : animalId ? [animalId] : []
    )];
    if (animalIds.length === 0 || !date) {
      return NextResponse.json({ error: "animalId(s) et date requis" }, { status: 400 });
    }
    const chaleurs = await prisma.$transaction(
      animalIds.map((id) => prisma.chaleur.create({
        data: { animalId: id, date: new Date(date), notes: notes?.trim() || null, updatedAt: new Date() },
      }))
    );

    const animaux = await prisma.animal.findMany({ where: { id: { in: animalIds } }, select: { nutrav: true } });
    const desc = animalIds.length > 1
      ? `Chaleur enregistrée pour ${animalIds.length} vaches`
      : `Chaleur enregistrée pour ${animaux[0]?.nutrav ?? animalIds[0]}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_CHALEUR", desc, chaleurs.map((chaleur) => ({ op: "delete", model: "chaleur", id: chaleur.id })));
    } catch {}

    return NextResponse.json({ ...chaleurs[0], count: chaleurs.length, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/chaleurs error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
