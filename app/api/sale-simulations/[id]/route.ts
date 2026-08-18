import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSaleSimulationPayload } from "@/lib/sale-simulation-persistence";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = parseSaleSimulationPayload(await request.json());
    const exists = await prisma.saleSimulation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Simulation introuvable." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.saleSimulation.update({
        where: { id },
        data: {
          weighingSessionId: input.weighingSessionId,
          statut: input.statut,
          refactionGlobale: input.refactionGlobale,
          prixKgGlobal: input.prixKgGlobal,
        },
      });
      await tx.saleSimulationAnimal.deleteMany({ where: { simulationId: id } });
      await tx.saleSimulationAnimal.createMany({
        data: input.lines.map((line) => ({
          simulationId: id,
          animalId: line.animalId,
          dernierePeseePoids: line.lastWeight,
          dernierePeseeDate: line.lastWeightDate ? new Date(line.lastWeightDate) : null,
          gmqUtilise: line.gmq,
          poidsPredit: line.predictedWeight,
          poidsMarchand: line.merchantWeight,
          poidsManuel: line.manualWeight,
          sourcePoids: line.source,
          poidsUtilise: line.poidsUtilise,
          refactionIndividuelle: line.individualRefaction,
          prixKgIndividuel: line.individualPriceKg,
        })),
      });
    });
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Simulation invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json() as { statut?: unknown };
  if (body.statut !== "CONFIRMED") return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  try {
    await prisma.saleSimulation.update({ where: { id }, data: { statut: "CONFIRMED" } });
    return NextResponse.json({ id, statut: "CONFIRMED" });
  } catch {
    return NextResponse.json({ error: "Simulation introuvable." }, { status: 404 });
  }
}
