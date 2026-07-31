import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { calculateGmqKgPerDay } from "@/lib/field-weighing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nutrav = String(body.nutrav ?? "").trim();
    const date = String(body.date ?? "");
    const poids = Number(body.poids);
    const sessionStartedAt = new Date(String(body.sessionStartedAt ?? ""));

    if (
      !nutrav ||
      !date ||
      !Number.isInteger(poids) ||
      poids <= 0 ||
      poids > 2000 ||
      Number.isNaN(sessionStartedAt.getTime())
    ) {
      return NextResponse.json({ error: "Données de pesée invalides" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({
      where: { nutrav },
      select: { id: true, nutrav: true, sexbov: true },
    });
    if (!animal) {
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }

    const currentDate = new Date(`${date}T12:00:00`);
    if (Number.isNaN(currentDate.getTime())) {
      return NextResponse.json({ error: "Date de pesée invalide" }, { status: 400 });
    }

    const previous = await prisma.pesee.findFirst({
      where: {
        animalId: animal.id,
        createdAt: { lt: sessionStartedAt },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { poids: true, date: true },
    });

    const pesee = await prisma.pesee.create({
      data: {
        animalId: animal.id,
        date: currentDate,
        poids,
      },
    });

    const desc = `Pesée ${pesee.poids}kg enregistrée pour ${nutrav}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PESEE", desc, { op: "delete", model: "pesee", id: pesee.id });
    } catch {}

    return NextResponse.json({
      success: true,
      pesee,
      animal: { nutrav: animal.nutrav, sexe: animal.sexbov },
      previous,
      gmq: calculateGmqKgPerDay(poids, currentDate, previous),
      _undoId: undoId,
      _undoDesc: desc,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
