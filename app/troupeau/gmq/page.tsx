import { prisma } from "@/lib/prisma";
import { mapGmqCalves } from "@/lib/gmq-calves";
import BackButton from "@/app/components/BackButton";
import PerformancesVeauxClient from "./PerformancesVeauxClient";

export const dynamic = "force-dynamic";

export default async function GmqPage() {
  // Read-only. Keep sold/deceased calves in the history; select by birth date in the client.
  const velages = await prisma.velage.findMany({
    where: { OR: [{ veauId: { not: null } }, { veauxDetails: { some: { animalId: { not: null } } } }] },
    select: {
      vacheId: true,
      vache: { select: { nutrav: true, nobovi: true } },
      pereNom: true, pereNunati: true,
      gestation: { select: { saillie: { select: { taureau: { select: { id: true, nopere: true, nupere: true } } } } } },
      veauxDetails: { select: { animal: { select: {
        id: true, nutrav: true, nobovi: true, danais: true, sexbov: true,
        pereNomManuel: true, pereNationalManuel: true, pereTravailManuel: true,
        taureau: { select: { id: true, nopere: true, nupere: true, traper: true } },
        pesees: { orderBy: { date: "asc" }, select: { date: true, poids: true } },
      } } } },
      veau: { select: {
        id: true, nutrav: true, nobovi: true, danais: true, sexbov: true,
        pereNomManuel: true, pereNationalManuel: true, pereTravailManuel: true,
        taureau: { select: { id: true, nopere: true, nupere: true, traper: true } },
        pesees: { orderBy: { date: "asc" }, select: { date: true, poids: true } },
      } },
    },
  });
  const veaux = mapGmqCalves(velages);
  return <main className="max-w-5xl mx-auto px-3 sm:px-5 py-4 pb-24 space-y-4">
    <div className="flex items-center gap-3"><BackButton className="p-2 bg-white rounded-lg shadow text-gray-500" iconSize={18} />
      <div><h1 className="text-xl font-bold text-gray-800">Performances des veaux</h1>
        <p className="text-xs text-gray-500">GMQ des mâles et femelles · classements par parents</p></div>
    </div>
    <PerformancesVeauxClient veaux={veaux} />
  </main>;
}
