import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isSaleWeightSource } from "@/lib/sale-simulation";
import { saleSimulationCandidates } from "@/lib/sale-simulation-data";
import SaleSimulationEditor from "../SaleSimulationEditor";

export const dynamic = "force-dynamic";

export default async function EditSaleSimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [simulation, freshCandidates] = await Promise.all([
    prisma.saleSimulation.findUnique({ where: { id }, include: { lignes: { orderBy: { createdAt: "asc" }, include: { animal: { select: { nutrav: true, nobovi: true } } } } } }),
    saleSimulationCandidates(),
  ]);
  if (!simulation) notFound();
  const savedCandidates = simulation.lignes.map((line) => ({
    id: line.animalId,
    nutrav: line.animal.nutrav,
    nobovi: line.animal.nobovi,
    lastWeight: line.dernierePeseePoids,
    lastWeightDate: line.dernierePeseeDate?.toISOString() ?? null,
    gmq: line.gmqUtilise,
    predictionDays: line.dernierePeseeDate ? Math.max(0, Math.floor((simulation.updatedAt.getTime() - line.dernierePeseeDate.getTime()) / 86_400_000)) : 0,
    predictedWeight: line.poidsPredit,
    merchantWeight: line.poidsMarchand,
    manualWeight: line.poidsManuel,
    source: isSaleWeightSource(line.sourcePoids) ? line.sourcePoids : "MANUAL" as const,
    individualRefaction: line.refactionIndividuelle,
    individualPriceKg: line.prixKgIndividuel,
  }));
  const savedIds = new Set(savedCandidates.map((item) => item.id));
  const candidates = [...savedCandidates, ...freshCandidates.filter((item) => !savedIds.has(item.id))];
  return <SaleSimulationEditor simulationId={id} weighingSessionId={simulation.weighingSessionId} candidates={candidates} initialSelectedIds={savedCandidates.map((item) => item.id)} initialRefaction={simulation.refactionGlobale} initialPriceKg={simulation.prixKgGlobal} />;
}
