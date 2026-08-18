import SaleSimulationEditor from "../SaleSimulationEditor";
import { saleSimulationCandidates, weighingSessionAnimalIds } from "@/lib/sale-simulation-data";

export const dynamic = "force-dynamic";

export default async function NewSaleSimulationPage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  const { sessionId } = await searchParams;
  const [candidates, selectedIds] = await Promise.all([
    saleSimulationCandidates(),
    weighingSessionAnimalIds(sessionId ?? null),
  ]);
  return <SaleSimulationEditor candidates={candidates} initialSelectedIds={selectedIds.filter((id) => candidates.some((animal) => animal.id === id))} weighingSessionId={sessionId ?? null} />;
}
