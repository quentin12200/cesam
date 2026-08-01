import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { calculateGmqKgPerDay } from "@/lib/field-weighing";
import {
  assertActiveWeighingSessionForAnimal,
  isWeighingSessionWeightDuplicateError,
  WeighingSessionError,
} from "@/lib/weighing-sessions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nutrav = String(body.nutrav ?? "").trim();
    const date = String(body.date ?? "");
    const poids = Number(body.poids);
    const sessionStartedAt = new Date(String(body.sessionStartedAt ?? ""));
    const weighingSessionId = typeof body.weighingSessionId === "string"
      ? body.weighingSessionId.trim() || null
      : null;

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
      select: {
        id: true,
        nutrav: true,
        sexbov: true,
        danais: true,
        mere: { select: { nutrav: true } },
      },
    });
    if (!animal) {
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }

    if (weighingSessionId) {
      try {
        await assertActiveWeighingSessionForAnimal(weighingSessionId, animal.id);
      } catch (error) {
        if (error instanceof WeighingSessionError) {
          return NextResponse.json(
            { error: error.message },
            { status: error.code === "NOT_FOUND" ? 404 : 409 },
          );
        }
        throw error;
      }
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

    let pesee;
    try {
      pesee = await prisma.pesee.create({
        data: {
          animalId: animal.id,
          weighingSessionId,
          date: currentDate,
          poids,
        },
      });
    } catch (error) {
      if (weighingSessionId && isWeighingSessionWeightDuplicateError(error)) {
        return NextResponse.json(
          { error: "Cet animal possède déjà une pesée dans cette séance." },
          { status: 409 },
        );
      }
      throw error;
    }

    const desc = `Pesée ${pesee.poids}kg enregistrée pour ${nutrav}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PESEE", desc, { op: "delete", model: "pesee", id: pesee.id });
    } catch {}

    return NextResponse.json({
      success: true,
      pesee,
      animal: {
        nutrav: animal.nutrav,
        sexe: animal.sexbov,
        mereNutrav: animal.mere?.nutrav ?? null,
        birthDate: animal.danais.toISOString(),
      },
      previous,
      gmq: calculateGmqKgPerDay(poids, currentDate, previous),
      _undoId: undoId,
      _undoDesc: desc,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
