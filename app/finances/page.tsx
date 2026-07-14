export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TrendingUp, Package, Euro, Plus, BarChart2 } from "lucide-react";
import SortieForm from "./SortieForm";
import AnnulerSortieButton from "./AnnulerSortieButton";
import EditSortieDrawer from "./EditSortieDrawer";
import CoutAlimentation from "./CoutAlimentation";
import FinancesTabs from "./FinancesTabs";
import PerformancesOverview from "./PerformancesOverview";

function formatEuro(val: number | null | undefined) {
  if (val == null) return "—";
  return val.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatPoids(val: number | null | undefined) {
  if (val == null) return "—";
  return `${val.toFixed(0)} kg`;
}

function estVeauHistorique(typeAnimal: string) {
  return ["veau", "veaux"].includes(typeAnimal.trim().toLowerCase());
}

function estVacheHistorique(typeAnimal: string) {
  return typeAnimal.trim().toLowerCase().startsWith("vache");
}

async function getFinancesData(annee: number) {
  const debut = new Date(`${annee}-01-01`);
  const fin = new Date(`${annee + 1}-01-01`);

  const [sorties, ventesHistoriques] = await Promise.all([
    prisma.sortie.findMany({
      where: { date: { gte: debut, lt: fin } },
      include: {
        animal: {
          select: { nutrav: true, nobovi: true, sexbov: true, danais: true, estGenisse: true, velageVeau: { select: { id: true } } },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.venteHistorique.findMany({
      where: { annee },
      orderBy: { date: "desc" },
    }),
  ]);

  const ventesElevage = sorties.filter((s) => s.type === "ELEVAGE");
  const ventesBoucherie = sorties.filter((s) => s.type === "BOUCHERIE");
  const morts = sorties.filter((s) => s.type === "MORT");
  const engraissements = sorties.filter((s) => s.type === "ENGRAISSEMENT");

  const clesSorties = new Set(
    sorties.map((s) => `${s.animal.nutrav}|${s.date.toISOString().slice(0, 10)}`)
  );
  const ventesHistoriquesUniques = ventesHistoriques.filter(
    (v) => !v.nutrav || !clesSorties.has(`${v.nutrav}|${v.date.toISOString().slice(0, 10)}`)
  );
  const veauxHistoriques = ventesHistoriquesUniques.filter((v) => estVeauHistorique(v.typeAnimal));
  const vachesHistoriques = ventesHistoriquesUniques.filter((v) => estVacheHistorique(v.typeAnimal));

  const caVeaux = ventesElevage
    .filter((s) => s.animal.velageVeau !== null)
    .reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0)
    + veauxHistoriques.reduce((sum, v) => sum + (v.total ?? 0), 0);

  const caVaches = [
    ...ventesElevage.filter((s) => s.animal.velageVeau === null),
    ...ventesBoucherie,
  ].reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0)
    + vachesHistoriques.reduce((sum, v) => sum + (v.total ?? 0), 0);

  const caTotal = caVeaux + caVaches;

  const veauxVendus = ventesElevage.filter((s) => s.animal.velageVeau !== null);
  const veauxVendusCount = veauxVendus.length + veauxHistoriques.length;
  const poidsVeauxTotal = veauxVendus.reduce((sum, s) => sum + (s.poids ?? 0), 0)
    + veauxHistoriques.reduce((sum, v) => sum + (v.poidsVif ?? v.poidsCarc ?? 0), 0);
  const poidsMoyenVeau = veauxVendusCount > 0 ? poidsVeauxTotal / veauxVendusCount : null;
  const prixMoyenVeau = veauxVendusCount > 0 ? caVeaux / veauxVendusCount : null;

  const vachesBoucherie = ventesBoucherie;
  const vachesBoucherieCount = vachesBoucherie.length + vachesHistoriques.length;
  const poidsCarcasseTotal = vachesBoucherie.reduce((sum, s) => sum + (s.poids ?? 0), 0)
    + vachesHistoriques.reduce((sum, v) => sum + (v.poidsCarc ?? v.poidsVif ?? 0), 0);
  const poidsMoyenCarcasse =
    vachesBoucherieCount > 0 ? poidsCarcasseTotal / vachesBoucherieCount : null;
  const prixMoyenVache = vachesBoucherieCount > 0 ? caVaches / vachesBoucherieCount : null;

  // Monthly CA distribution
  const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthlyCA = MOIS_COURTS.map((label, i) => {
    const monthSorties = sorties.filter((s) => new Date(s.date).getMonth() === i);
    const monthHistoriques = ventesHistoriquesUniques.filter((v) => new Date(v.date).getMonth() === i);
    return {
      label,
      ca: monthSorties.reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0)
        + monthHistoriques.reduce((sum, v) => sum + (v.total ?? 0), 0),
      count: monthSorties.length + monthHistoriques.length,
    };
  });
  const maxMonthlyCA = Math.max(...monthlyCA.map((m) => m.ca), 1);

  // Top buyers
  const buyerMap = new Map<string, { count: number; total: number }>();
  for (const s of sorties) {
    if (s.acheteur) {
      const existing = buyerMap.get(s.acheteur) ?? { count: 0, total: 0 };
      buyerMap.set(s.acheteur, {
        count: existing.count + 1,
        total: existing.total + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0),
      });
    }
  }
  for (const v of ventesHistoriquesUniques) {
    if (v.acheteur) {
      const existing = buyerMap.get(v.acheteur) ?? { count: 0, total: 0 };
      buyerMap.set(v.acheteur, {
        count: existing.count + 1,
        total: existing.total + (v.total ?? 0),
      });
    }
  }
  const topBuyers = [...buyerMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, stats]) => ({ name, ...stats }));

  // CA by animal category
  const caVeauxVif = ventesElevage
    .filter((s) => s.animal.velageVeau !== null)
    .reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0)
    + veauxHistoriques.reduce((sum, v) => sum + (v.total ?? 0), 0);
  const caGenisses = ventesElevage
    .filter((s) => s.animal.velageVeau === null && s.animal.estGenisse)
    .reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0);
  const caVachesBoucherie = ventesBoucherie
    .reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0)
    + vachesHistoriques.reduce((sum, v) => sum + (v.total ?? 0), 0);
  const caVachesElevage = ventesElevage
    .filter((s) => s.animal.velageVeau === null && !s.animal.estGenisse && s.animal.sexbov === "F")
    .reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0);

  // Statistiques mortalité — toutes années confondues pour le taux de troupeau
  const allTimeTotal = await prisma.animal.count();
  const allTimeMorts = await prisma.sortie.count({ where: { type: "MORT" } });
  const tauxMortalite = allTimeTotal > 0 ? (allTimeMorts / allTimeTotal) * 100 : 0;

  // Répartition par cause pour l'année sélectionnée
  const mortsAvecCause = morts.filter((s) => s.causeMortalite);
  const causeMap = new Map<string, number>();
  for (const m of mortsAvecCause) {
    const cause = m.causeMortalite!;
    causeMap.set(cause, (causeMap.get(cause) ?? 0) + 1);
  }
  const statsParCause = [...causeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({
      cause,
      count,
      pct: mortsAvecCause.length > 0 ? Math.round((count / mortsAvecCause.length) * 100) : 0,
    }));

  return {
    sorties,
    ventesHistoriques: ventesHistoriquesUniques,
    caVeaux,
    caVaches,
    caTotal,
    ventesElevageCount: ventesElevage.length + veauxHistoriques.length,
    ventesBoucherieCount: vachesBoucherieCount,
    mortsCount: morts.length,
    engraissementsCount: engraissements.length,
    poidsMoyenVeau,
    prixMoyenVeau,
    poidsMoyenCarcasse,
    prixMoyenVache,
    veauxVendusCount,
    monthlyCA,
    maxMonthlyCA,
    topBuyers,
    caVeauxVif,
    caGenisses,
    caVachesBoucherie,
    caVachesElevage,
    tauxMortalite,
    allTimeMorts,
    statsParCause,
    mortsAnneeSansProbleme: morts.length - mortsAvecCause.length,
  };
}

async function getAnimauxActifs() {
  return prisma.animal.findMany({
    where: { statut: "ACTIF" },
    select: { id: true, nutrav: true, nobovi: true, sexbov: true },
    orderBy: { nutrav: "asc" },
  });
}

interface PageProps {
  searchParams: Promise<{ annee?: string; nouvelle?: string; onglet?: string }>;
}

const ANNEE_COURANTE = new Date().getFullYear();

export default async function FinancesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  if (sp.onglet === "performances") return <PerformancesOverview />;

  const annee = sp.annee ? parseInt(sp.annee) : ANNEE_COURANTE;
  const showForm = sp.nouvelle === "1";

  const [data, animaux] = await Promise.all([
    getFinancesData(annee),
    showForm ? getAnimauxActifs() : Promise.resolve([]),
  ]);

  const typeLabel: Record<string, string> = {
    MORT: "Mort",
    ELEVAGE: "Vente vif",
    BOUCHERIE: "Boucherie",
    ENGRAISSEMENT: "Engraissement",
  };

  const typeBadge: Record<string, string> = {
    MORT: "bg-gray-100 text-gray-600",
    ELEVAGE: "bg-green-100 text-green-700",
    BOUCHERIE: "bg-orange-100 text-orange-700",
    ENGRAISSEMENT: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <h2 className="text-xl font-bold text-gray-800 flex-1">Finances</h2>
        <Link
          href="/finances/stats"
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg shadow-sm hover:bg-gray-50"
        >
          <BarChart2 size={16} />
          Stats
        </Link>
        {!showForm && (
          <Link
            href={`/finances?annee=${annee}&nouvelle=1`}
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg shadow"
          >
            <Plus size={16} />
            Sortie
          </Link>
        )}
      </div>

      <FinancesTabs active="economie" />

      {/* Sélecteur d'année */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[ANNEE_COURANTE - 1, ANNEE_COURANTE, ANNEE_COURANTE + 1].map((y) => (
          <Link
            key={y}
            href={`/finances?annee=${y}`}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              y === annee
                ? "bg-green-700 text-white shadow"
                : "bg-white text-gray-600 shadow-sm border border-gray-200"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <CoutAlimentation />

      {/* Formulaire nouvelle sortie */}
      {showForm && <SortieForm animaux={animaux} annee={annee} />}

      {/* CA Total */}
      <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-xl shadow p-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Euro size={18} />
          <span className="text-sm font-medium opacity-90">Chiffre d&apos;affaires {annee}</span>
        </div>
        <div className="text-3xl font-bold">{formatEuro(data.caTotal)}</div>
        <div className="flex gap-4 mt-3 text-sm opacity-80">
          <div>
            <div className="font-semibold text-white">{formatEuro(data.caVeaux)}</div>
            <div>Veaux</div>
          </div>
          <div className="w-px bg-white/30" />
          <div>
            <div className="font-semibold text-white">{formatEuro(data.caVaches)}</div>
            <div>Vaches / boucherie</div>
          </div>
        </div>
      </div>

      {/* Stats par catégorie */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-600" />
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ventes vif</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{data.ventesElevageCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">animaux</div>
          {data.poidsMoyenVeau && (
            <div className="text-xs text-gray-400 mt-1">
              Poids moy. {formatPoids(data.poidsMoyenVeau)}
            </div>
          )}
          {data.prixMoyenVeau && (
            <div className="text-xs text-green-600 font-medium mt-0.5">
              Moy. {formatEuro(data.prixMoyenVeau)}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-orange-600" />
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Boucherie</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{data.ventesBoucherieCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">vaches</div>
          {data.poidsMoyenCarcasse && (
            <div className="text-xs text-gray-400 mt-1">
              Carcasse moy. {formatPoids(data.poidsMoyenCarcasse)}
            </div>
          )}
          {data.prixMoyenVache && (
            <div className="text-xs text-orange-600 font-medium mt-0.5">
              Moy. {formatEuro(data.prixMoyenVache)}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">💀</span>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Morts</span>
          </div>
          <div className="text-2xl font-bold text-gray-400">{data.mortsCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">animaux</div>
        </div>

        <div className="bg-white rounded-xl shadow p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🐄</span>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Engraissement</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{data.engraissementsCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">en cours</div>
        </div>
      </div>

      {/* Répartition mensuelle */}
      {data.sorties.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Répartition mensuelle {annee}</h3>
          <div className="space-y-2">
            {data.monthlyCA.filter((m) => m.ca > 0).map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8 shrink-0">{m.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-green-500 h-2.5 rounded-full"
                    style={{ width: `${(m.ca / data.maxMonthlyCA) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-24 text-right shrink-0">
                  {formatEuro(m.ca)}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">×{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top acheteurs */}
      {data.topBuyers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Top acheteurs {annee}</h3>
          <div className="space-y-2">
            {data.topBuyers.map((buyer, i) => (
              <div key={buyer.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                <span className="flex-1 text-sm text-gray-700 truncate">{buyer.name}</span>
                <span className="text-xs text-gray-400">{buyer.count > 1 ? `${buyer.count} animaux` : `${buyer.count} animal`}</span>
                <span className="text-sm font-semibold text-green-700">{formatEuro(buyer.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistiques mortalité */}
      {(data.mortsCount > 0 || data.allTimeMorts > 0) && (
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-gray-400">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>💀</span>
            Mortalité — statistiques
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{data.mortsCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">Morts en {annee}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{data.tauxMortalite.toFixed(1)} %</div>
              <div className="text-xs text-gray-500 mt-0.5">Taux cumulé</div>
            </div>
          </div>

          {data.statsParCause.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Répartition par cause ({annee})
              </h4>
              <div className="space-y-2">
                {data.statsParCause.map((s) => (
                  <div key={s.cause} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{s.cause}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-gray-500 h-2 rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-12 text-right shrink-0">
                      {s.pct} %
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">×{s.count}</span>
                  </div>
                ))}
              </div>
              {data.mortsAnneeSansProbleme > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  + {data.mortsAnneeSansProbleme} mort{data.mortsAnneeSansProbleme > 1 ? "s" : ""} sans cause renseignée
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Liste des sorties */}
      {(() => {
        type SortieItem =
          | { kind: "sortie"; date: Date; id: string; data: (typeof data.sorties)[number] }
          | { kind: "historique"; date: Date; id: string; data: (typeof data.ventesHistoriques)[number] };

        const items: SortieItem[] = [
          ...data.sorties.map((s) => ({ kind: "sortie" as const, date: s.date, id: s.id, data: s })),
          ...data.ventesHistoriques.map((v) => ({ kind: "historique" as const, date: v.date, id: v.id, data: v })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        const totalCount = items.length;

        return (
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              Sorties {annee} ({totalCount})
            </h3>
            {totalCount === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune sortie enregistrée pour {annee}</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  if (item.kind === "sortie") {
                    const sortie = item.data;
                    return (
                      <div key={`s-${sortie.id}`} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link
                              href={`/troupeau/${sortie.animal.nutrav}`}
                              className="bg-gray-700 text-white text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0"
                            >
                              {sortie.animal.nutrav}
                            </Link>
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {sortie.animal.nobovi ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[sortie.type] ?? "bg-gray-100 text-gray-600"}`}>
                              {typeLabel[sortie.type] ?? sortie.type}
                            </span>
                            {sortie.type === "MORT" && sortie.causeMortalite && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                {sortie.causeMortalite}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>{new Date(sortie.date).toLocaleDateString("fr-FR")}</span>
                          <div className="flex items-center gap-3">
                            {sortie.type === "BOUCHERIE" && sortie.poidsVif && (
                              <span>{formatPoids(sortie.poidsVif)} vif{sortie.rendementCarcasse ? ` → ${sortie.rendementCarcasse}%` : ""}</span>
                            )}
                            {sortie.poids && <span>{formatPoids(sortie.poids)}{sortie.type === "BOUCHERIE" ? " carc." : ""}</span>}
                            {sortie.prixKilo && <span>{sortie.prixKilo.toFixed(2)} €/kg</span>}
                            {(sortie.prixDefinitifHT ?? sortie.prixPrevuHT) && (
                              <span className="font-semibold text-green-700">
                                {formatEuro(sortie.prixDefinitifHT ?? sortie.prixPrevuHT)}
                              </span>
                            )}
                          </div>
                        </div>
                        {sortie.acheteur && (
                          <div className="text-xs text-gray-400 mt-1">Acheteur : {sortie.acheteur}</div>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <EditSortieDrawer sortie={{
                            id: sortie.id,
                            date: sortie.date.toISOString(),
                            type: sortie.type,
                            acheteur: sortie.acheteur,
                            poids: sortie.poids,
                            poidsVif: sortie.poidsVif,
                            rendementCarcasse: sortie.rendementCarcasse,
                            prixKilo: sortie.prixKilo,
                            prixDefinitifHT: sortie.prixDefinitifHT,
                            prixPrevuHT: sortie.prixPrevuHT,
                            notes: sortie.notes,
                            causeMortalite: sortie.causeMortalite,
                            animalId: sortie.animalId,
                            animal: { nutrav: sortie.animal.nutrav, nobovi: sortie.animal.nobovi },
                          }} />
                          <AnnulerSortieButton sortieId={sortie.id} nutrav={sortie.animal.nutrav} />
                        </div>
                      </div>
                    );
                  } else {
                    const vh = item.data;
                    return (
                      <div key={`h-${vh.id}`} className="border border-amber-100 bg-amber-50/40 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {vh.nutrav ? (
                              <span className="bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0">
                                {vh.nutrav}
                              </span>
                            ) : (
                              <span className="bg-gray-300 text-gray-600 text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0">
                                —
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {vh.typeAnimal}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              {vh.typeVente === "carcasse" ? "Boucherie" : "Vente vif"}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              historique
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>{new Date(vh.date).toLocaleDateString("fr-FR")}</span>
                          <div className="flex items-center gap-3">
                            {vh.poidsVif && <span>{formatPoids(vh.poidsVif)} vif</span>}
                            {vh.poidsCarc && <span>{formatPoids(vh.poidsCarc)} carc.</span>}
                            {vh.prixKgCarc && <span>{vh.prixKgCarc.toFixed(2)} €/kg carc.</span>}
                            {vh.prixKgVif && !vh.prixKgCarc && <span>{vh.prixKgVif.toFixed(2)} €/kg vif</span>}
                            {vh.total && (
                              <span className="font-semibold text-green-700">
                                {formatEuro(vh.total)}
                              </span>
                            )}
                          </div>
                        </div>
                        {vh.acheteur && (
                          <div className="text-xs text-gray-400 mt-1">Acheteur : {vh.acheteur}</div>
                        )}
                        {vh.notes && (
                          <div className="text-xs text-gray-400 mt-0.5 italic">{vh.notes}</div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
