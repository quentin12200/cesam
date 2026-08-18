import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { retainedWeight } from "@/lib/sale-simulation";
import SimulationSaleForm from "./SimulationSaleForm";

export const dynamic = "force-dynamic";

export default async function ConfirmSimulationSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const simulation = await prisma.saleSimulation.findUnique({
    where: { id },
    include: { lignes: { orderBy: { createdAt: "asc" }, include: { animal: { select: { id: true, nutrav: true, nobovi: true, sexbov: true, categorie: true, statut: true } } } } },
  });
  if (!simulation) notFound();
  const unavailable = simulation.lignes.filter((line) => line.animal.statut !== "ACTIF");
  if (unavailable.length > 0) {
    return <main className="mx-auto max-w-xl px-3 py-8"><h1 className="text-2xl font-black">Vente à vérifier</h1><p className="mt-3 rounded-md bg-orange-50 p-4 font-semibold">{unavailable.length} animal{unavailable.length > 1 ? "aux ne sont" : " n’est"} plus actif dans le troupeau. Aucun animal n’a été vendu.</p><Link href={`/troupeau/simulations-vente/${id}`} className="mt-4 flex min-h-12 items-center justify-center rounded-md border-2 border-black font-bold">Retour à la simulation</Link></main>;
  }
  const animals = simulation.lignes.filter((line) => line.animal.statut === "ACTIF").map((line) => ({
    id: line.animal.id,
    nutrav: line.animal.nutrav,
    nobovi: line.animal.nobovi,
    sexbov: line.animal.sexbov,
    categorie: line.animal.categorie,
    poidsVif: retainedWeight(line.poidsUtilise, line.refactionIndividuelle ?? simulation.refactionGlobale),
  }));
  const animalPrices = Object.fromEntries(simulation.lignes.map((line) => [line.animalId, line.prixKgIndividuel ?? simulation.prixKgGlobal]));
  return <SimulationSaleForm simulationId={id} animals={animals} priceKg={simulation.prixKgGlobal} animalPrices={animalPrices} />;
}
