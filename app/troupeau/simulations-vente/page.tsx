import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SaleSimulationsPage() {
  const simulations = await prisma.saleSimulation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { lignes: { select: { poidsUtilise: true, refactionIndividuelle: true, prixKgIndividuel: true } }, weighingSession: { select: { startedAt: true } } },
  });
  return <main className="mx-auto max-w-3xl px-3 py-4 pb-24">
    <header className="flex items-center gap-3 border-b-2 border-black pb-3"><Link href="/troupeau" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border" aria-label="Retour"><ArrowLeft /></Link><div><h1 className="text-2xl font-black">Simulations de vente</h1><p className="text-sm text-gray-600">Préparer sans sortir les animaux</p></div></header>
    <Link href="/troupeau/simulations-vente/nouvelle" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-md bg-green-700 px-4 font-bold text-white"><Plus size={20} />Nouvelle simulation</Link>
    <div className="mt-4 space-y-3">{simulations.length === 0 ? <p className="rounded-md border p-5 text-center text-gray-600">Aucune simulation enregistrée.</p> : simulations.map((simulation) => {
      const amount = simulation.lignes.reduce((sum, line) => {
        const refaction = line.refactionIndividuelle ?? simulation.refactionGlobale;
        const price = line.prixKgIndividuel ?? simulation.prixKgGlobal ?? 0;
        return sum + line.poidsUtilise * (1 - refaction / 100) * price;
      }, 0);
      return <Link key={simulation.id} href={`/troupeau/simulations-vente/${simulation.id}`} className="block rounded-lg border border-gray-300 bg-white p-3 shadow-sm"><div className="flex justify-between gap-3"><strong>{simulation.lignes.length} animaux</strong><strong>{amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong></div><p className="mt-1 text-sm text-gray-600">Modifiée le {simulation.updatedAt.toLocaleDateString("fr-FR")} · {simulation.statut === "CONFIRMED" ? "Vente confirmée" : "Simulation"}{simulation.weighingSession ? ` · pesée du ${simulation.weighingSession.startedAt.toLocaleDateString("fr-FR")}` : " · depuis le troupeau"}</p></Link>;
    })}</div>
  </main>;
}
