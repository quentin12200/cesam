import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateGmqKgPerDay } from "@/lib/field-weighing";
import { parsePriceGroups } from "@/lib/price-simulation";
import {
  getWeighingSession,
  updateWeighingSessionMetadata,
  WeighingSessionError,
  type WeighingSessionMetadata,
} from "@/lib/weighing-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getWeighingSession(id);
    const fieldEntries = await Promise.all(session.pesees.map(async (pesee) => {
      const previous = await prisma.pesee.findFirst({
        where: {
          animalId: pesee.animalId,
          createdAt: { lt: session.startedAt },
          id: { not: pesee.id },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { poids: true, date: true },
      });
      return {
        id: pesee.id,
        nutrav: pesee.animal.nutrav,
        mereNutrav: pesee.animal.mere?.nutrav ?? null,
        birthDate: pesee.animal.danais.toISOString(),
        sexe: pesee.animal.sexbov === "M" ? "M" : "F",
        poids: pesee.poids,
        gmq: calculateGmqKgPerDay(pesee.poids, pesee.date, previous),
        selected: true,
      };
    }));
    return NextResponse.json({ ...session, fieldEntries });
  } catch (error) {
    if (error instanceof WeighingSessionError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<WeighingSessionMetadata>;
    const metadata: WeighingSessionMetadata = {
      selectedPeseeIds: Array.isArray(body.selectedPeseeIds)
        ? body.selectedPeseeIds.filter((value): value is string => typeof value === "string")
        : [],
      summaryOpen: body.summaryOpen === true,
      simulationOpen: body.simulationOpen === true,
      priceGroups: parsePriceGroups(JSON.stringify(body.priceGroups ?? [])),
    };
    return NextResponse.json(await updateWeighingSessionMetadata(id, metadata));
  } catch (error) {
    if (error instanceof WeighingSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
