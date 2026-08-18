import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSaleSimulationPayload } from "@/lib/sale-simulation-persistence";

export async function POST(request: Request) {
  try {
    const input = parseSaleSimulationPayload(await request.json());
    const animalCount = await prisma.animal.count({ where: { id: { in: input.lines.map((line) => line.animalId) } } });
    if (animalCount !== input.lines.length) return NextResponse.json({ error: "Un animal est introuvable." }, { status: 400 });
    const simulation = await prisma.saleSimulation.create({
      data: {
        weighingSessionId: input.weighingSessionId,
        statut: input.statut,
        refactionGlobale: input.refactionGlobale,
        prixKgGlobal: input.prixKgGlobal,
        lignes: {
          create: input.lines.map((line) => ({
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
        },
      },
      select: { id: true },
    });
    return NextResponse.json(simulation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Simulation invalide." }, { status: 400 });
  }
}
