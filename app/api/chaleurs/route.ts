import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const { animalId, date, notes } = await request.json();
    if (!animalId || !date) {
      return NextResponse.json({ error: "animalId et date requis" }, { status: 400 });
    }
    const chaleur = await prisma.chaleur.create({
      data: { animalId, date: new Date(date), notes: notes?.trim() || null, updatedAt: new Date() },
    });

    const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { nutrav: true } });
    const nutrav = animal?.nutrav ?? animalId;
    const desc = `Chaleur enregistrée pour ${nutrav}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_CHALEUR", desc, { op: "delete", model: "chaleur", id: chaleur.id });
    } catch {}

    return NextResponse.json({ ...chaleur, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/chaleurs error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
