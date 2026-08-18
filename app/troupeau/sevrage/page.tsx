import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { formatAge, formatDate } from "@/lib/utils";
import { differenceInDays, subDays } from "date-fns";

import BackButton from "@/app/components/BackButton";
import WeaningDryOffPanel from "@/app/components/WeaningDryOffPanel";
import { getWeaningDryOffCandidates } from "@/lib/weaning-dry-off-data";
import { resolveCalfMother } from "@/lib/weaning-dry-off";
import { formatWeaningAgeDays } from "@/lib/weaning-age-display";
// Page sans segment dynamique ni searchParams : sans cette directive, Next.js
// la fige en HTML statique au moment du build et ne reflète plus les
// évolutions de la base tant qu'un nouveau déploiement n'a pas lieu.
export const dynamic = "force-dynamic";

interface VeauSevre {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: Date;
  dateSevrage: Date;
  ageSevrageJours: number;
  mereNutrav: string | null;
  mereNobovi: string | null;
}

interface MereTarieRecente {
  id: string;
  nutrav: string;
  nobovi: string | null;
  dateTarie: Date;
}

async function getVeauxSevres(): Promise<VeauSevre[]> {
  // Seuls les sevrages avec une date connue sont listés (les sevrages
  // antérieurs à ce suivi, sans date exacte, ne sont pas exploitables ici).
  // Passé un an, ce ne sont plus des veaux mais des génisses/vaches : on les
  // sort de ce suivi opérationnel (sinon la table finit par contenir tout le
  // troupeau adulte, ce qui n'a plus d'intérêt).
  const unAn = subDays(new Date(), 365);
  const animaux = await prisma.animal.findMany({
    where: { sevreFait: true, dateSevrage: { not: null }, danais: { gte: unAn } },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      danais: true,
      dateSevrage: true,
      velageVeau: {
        select: {
          vache: { select: { nutrav: true, nobovi: true } },
        },
      },
      veauxVelage: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          velage: {
            select: {
              vache: { select: { nutrav: true, nobovi: true } },
            },
          },
        },
      },
      mere: { select: { nutrav: true, nobovi: true } },
    },
    orderBy: { dateSevrage: "desc" },
  });

  return animaux.map((a) => {
    const mere = resolveCalfMother(a);
    const dateSevrage = a.dateSevrage as Date;
    return {
      id: a.id,
      nutrav: a.nutrav,
      nobovi: a.nobovi,
      danais: a.danais,
      dateSevrage,
      ageSevrageJours: differenceInDays(dateSevrage, a.danais),
      mereNutrav: mere?.nutrav ?? null,
      mereNobovi: mere?.nobovi ?? null,
    };
  });
}

async function getMeresTariesRecemment(): Promise<MereTarieRecente[]> {
  const animaux = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      tarieFaite: true,
      dateTarie: { gte: subDays(new Date(), 14) },
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      dateTarie: true,
    },
    orderBy: { dateTarie: "desc" },
  });
  return animaux.flatMap((animal) =>
    animal.dateTarie
      ? [{ ...animal, dateTarie: animal.dateTarie }]
      : []
  );
}

export default async function SevragePage() {
  const [veaux, meresTariesRecemment, weaningDryOff] = await Promise.all([
    getVeauxSevres(),
    getMeresTariesRecemment(),
    getWeaningDryOffCandidates(),
  ]);

  const ageMoyenJours =
    veaux.length > 0
      ? Math.round(veaux.reduce((s, v) => s + v.ageSevrageJours, 0) / veaux.length)
      : null;

  const recents = veaux.filter((v) => differenceInDays(new Date(), v.dateSevrage) <= 14);

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Scissors size={20} className="text-orange-600" />
            Sevrage et tarissement
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            À faire, bientôt à prévoir et récemment effectués
          </p>
        </div>
      </div>

      <WeaningDryOffPanel
        initialCandidates={weaningDryOff.candidates}
        thresholdMonths={weaningDryOff.thresholdMonths}
      />

      {/* Résumé global */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{veaux.length}</div>
          <div className="text-xs text-gray-500 mt-1">veaux sevrés</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">
            {ageMoyenJours !== null ? formatWeaningAgeDays(ageMoyenJours) : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">âge moyen au sevrage</div>
        </div>
      </div>

      {veaux.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
          Aucun sevrage récent enregistré pour l&apos;instant.
        </div>
      )}

      {/* Événements récents, issus des dates déjà stockées sur les animaux. */}
      {(recents.length > 0 || meresTariesRecemment.length > 0) && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="text-base">🕐</span> Récemment effectués (14 derniers jours)
          </h3>
          <div className="space-y-2">
            {recents.map((v) => (
              <div key={v.id} className="bg-white rounded-xl shadow p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/troupeau/${v.nutrav}`} className="hover:underline">
                    <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                      {v.nutrav}
                    </span>
                    {v.nobovi && <span className="ml-2 text-gray-800 text-sm font-medium">{v.nobovi}</span>}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    Sevré le {formatDate(v.dateSevrage)} à {formatAge(v.danais, v.dateSevrage)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {v.mereNutrav ? (
                    <Link href={`/troupeau/${v.mereNutrav}`} className="hover:underline">
                      <span className="font-mono font-bold text-xs bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                        {v.mereNutrav}
                      </span>
                      {v.mereNobovi && <span className="ml-1 text-gray-600 text-xs">{v.mereNobovi}</span>}
                    </Link>
                  ) : (
                    <span className="text-gray-400 text-xs">Mère inconnue</span>
                  )}
                </div>
              </div>
            ))}
            {meresTariesRecemment.map((mere) => (
              <div key={`dry-off-${mere.id}`} className="bg-white rounded-xl shadow p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/troupeau/${mere.nutrav}`} className="hover:underline">
                    <span className="font-mono font-bold text-xs bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded">
                      {mere.nutrav}
                    </span>
                    {mere.nobovi && <span className="ml-2 text-gray-800 text-sm font-medium">{mere.nobovi}</span>}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    Tarissement enregistré le {formatDate(mere.dateTarie)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                  Mère tarie
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Historique complet */}
      {veaux.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Historique des sevrages</h3>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Veau</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Mère</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Date sevrage</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Âge au sevrage</th>
                  </tr>
                </thead>
                <tbody>
                  {veaux.map((v, i) => (
                    <tr key={v.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                      <td className="px-4 py-3">
                        <Link href={`/troupeau/${v.nutrav}`} className="hover:underline">
                          <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                            {v.nutrav}
                          </span>
                          {v.nobovi && <span className="ml-2 text-gray-600 text-xs">{v.nobovi}</span>}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {v.mereNutrav ? (
                          <Link href={`/troupeau/${v.mereNutrav}`} className="hover:underline">
                            <span className="font-mono text-xs bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                              {v.mereNutrav}
                            </span>
                            {v.mereNobovi && <span className="ml-1 text-gray-600 text-xs">{v.mereNobovi}</span>}
                          </Link>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(v.dateSevrage)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs whitespace-nowrap">
                        {formatAge(v.danais, v.dateSevrage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
