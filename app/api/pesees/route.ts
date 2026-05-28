import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nutrav, date, poids } = body;

    if (!nutrav || !date || poids == null) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({ where: { nutrav } });
    if (!animal) {
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }

    const pesee = await prisma.pesee.create({
      data: {
        animalId: animal.id,
        date: new Date(date),
        poids: parseFloat(String(poids)),
      },
    });

    const desc = `Pesée ${pesee.poids}kg enregistrée pour ${nutrav}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PESEE", desc, { op: "delete", model: "pesee", id: pesee.id });
    } catch {}

    return NextResponse.json({ success: true, pesee, _undoId: undoId, _undoDesc: desc });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
