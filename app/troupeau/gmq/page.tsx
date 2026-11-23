import { prisma } from "@/lib/prisma";
import BackButton from "@/app/components/BackButton";
import PerformancesVeauxClient from "./PerformancesVeauxClient";

export default async function GmqPage() {
  // Read-only. Keep sold/deceased calves in the history; select by birth date in the client.
  const velages = await prisma.velage.findMany({
    where: { veauId: { not: null } },
    select: {
      vacheId: true,
      vache: { select: { nutrav: true, nobovi: true } },
      pereNom: true, pereNunati: true,
      gestation: { select: { saillie: { select: { taureau: { select: { id: true, nopere: true, nupere: true } } } } } },
      veau: { select: {
        id: true, nutrav: true, nobovi: true, danais: true, sexbov: true,
        pereNomManuel: true, pereNationalManuel: true, pereTravailManuel: true,
        taureau: { select: { id: true, nopere: true, nupere: true, traper: true } },
        pesees: { orderBy: { date: "asc" }, select: { date: true, poids: true } },
      } },
    },
  });
  const seen = new Set<string>();
  const veaux = velages.flatMap(v => {
    const calf = v.veau;
    if (!calf || seen.has(calf.id)) return [];
    seen.add(calf.id);
    const bull = calf.taureau ?? v.gestation?.saillie?.taureau;
    // The calf genealogy is the primary source. Older births may store father
    // information on the calving or the linked breeding record instead.
    // NUMEIP/NOMEIP/TRAMIP describe the MOTHER (identification permanente),
    // never the father. Only use explicitly paternal sources here.
    const fatherNational = calf.pereNationalManuel?.trim()
      || bull?.nupere?.trim() || v.pereNunati?.trim() || null;
    const fatherName = calf.pereNomManuel?.trim()
      || bull?.nopere?.trim() || v.pereNom?.trim()
      || calf.pereTravailManuel?.trim()
      || fatherNational || null;
    return [{
      id: calf.id, numero: calf.nutrav, nom: calf.nobovi,
      naissance: calf.danais.toISOString(), sexe: calf.sexbov,
      mereId: v.vacheId, mere: [v.vache.nutrav, v.vache.nobovi].filter(Boolean).join(" · "),
      pereId: bull?.id ?? null,
      pereNational: fatherNational,
      pere: fatherName,
      pesees: calf.pesees.map(p => ({ date: p.date.toISOString(), poids: p.poids })),
    }];
  });
  return <main className="max-w-5xl mx-auto px-3 sm:px-5 py-4 pb-24 space-y-4">
    <div className="flex items-center gap-3"><BackButton className="p-2 bg-white rounded-lg shadow text-gray-500" iconSize={18} />
      <div><h1 className="text-xl font-bold text-gray-800">Performances des veaux</h1>
        <p className="text-xs text-gray-500">GMQ des mâles et femelles · classements par parents</p></div>
    </div>
    <PerformancesVeauxClient veaux={veaux} />
  </main>;
}
