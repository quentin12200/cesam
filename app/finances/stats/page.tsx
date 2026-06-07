export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";

function pct(current: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function Evolution({ val }: { val: number | null }) {
  if (val === null) return <span className="text-gray-300 text-xs">—</span>;
  if (val > 0) return (
    <span className="flex items-center gap-0.5 text-green-600 text-xs font-semibold">
      <TrendingUp size={11} />+{val}%
    </span>
  );
  if (val < 0) return (
    <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold">
      <TrendingDown size={11} />{val}%
    </span>
  );
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={11} />0%</span>;
}

function fmt€(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtKg(v: number | null) {
  if (v == null || v === 0) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} kg`;
}

function fmtPrix(v: number | null) {
  if (v == null) return "—";
  return `${v.toFixed(2)} €/kg`;
}

interface AnneeStats {
  annee: number;
  // Veaux vif
  veauxCount: number;
  veauxKgTotal: number;
  veauxPrixMoyen: number | null;
  veauxCA: number;
  // Vaches boucherie
  vachesCount: number;
  vachesKgCarcasse: number;
  vachesPrixMoyen: number | null;
  vachesCA: number;
  // Total
  caTotal: number;
  // Productivité
  tauxProductivite: number | null; // veaux vendus / vaches
}

async function getStatsPluri(): Promise<AnneeStats[]> {
  const maintenant = new Date();
  const anneeMin = maintenant.getFullYear() - 5;

  const sorties = await prisma.sortie.findMany({
    where: {
      date: { gte: new Date(`${anneeMin}-01-01`) },
      type: { in: ["ELEVAGE", "BOUCHERIE"] },
    },
    include: {
      animal: {
        select: {
          sexbov: true,
          danais: true,
          estGenisse: true,
          velageVeau: { select: { id: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Grouper par année
  const byAnnee = new Map<number, typeof sorties>();
  for (const s of sorties) {
    const annee = new Date(s.date).getFullYear();
    if (!byAnnee.has(annee)) byAnnee.set(annee, []);
    byAnnee.get(annee)!.push(s);
  }

  // Compter les vaches actives par année (approximation : velages dans l'année)
  const velagesParAnnee = await prisma.velage.groupBy({
    by: ["date"],
    _count: { id: true },
  });
  const velagesCountByAnnee = new Map<number, number>();
  for (const v of velagesParAnnee) {
    const annee = new Date(v.date).getFullYear();
    velagesCountByAnnee.set(annee, (velagesCountByAnnee.get(annee) ?? 0) + v._count.id);
  }

  const annees = [...new Set([...byAnnee.keys()])].sort();

  return annees.map((annee) => {
    const rows = byAnnee.get(annee) ?? [];
    const veaux = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau !== null);
    const vaches = rows.filter((s) => s.type === "BOUCHERIE");
    // Ventes vif de vaches/génisses
    const elevageVaches = rows.filter((s) => s.type === "ELEVAGE" && s.animal.velageVeau === null);

    const veauxCount = veaux.length;
    const veauxKgTotal = veaux.reduce((s, v) => s + (v.poids ?? 0), 0);
    const veauxPrix = veaux.filter((v) => v.prixKilo).map((v) => v.prixKilo!);
    const veauxPrixMoyen = veauxPrix.length ? veauxPrix.reduce((a, b) => a + b, 0) / veauxPrix.length : null;
    const veauxCA = veaux.reduce((s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0), 0);

    const vachesCount = vaches.length;
    const vachesKgCarcasse = vaches.reduce((s, v) => s + (v.poids ?? 0), 0);
    const vachesPrix = vaches.filter((v) => v.prixKilo).map((v) => v.prixKilo!);
    const vachesPrixMoyen = vachesPrix.length ? vachesPrix.reduce((a, b) => a + b, 0) / vachesPrix.length : null;
    const vachesCA = [...vaches, ...elevageVaches].reduce(
      (s, v) => s + (v.prixDefinitifHT ?? v.prixPrevuHT ?? 0),
      0
    );

    const caTotal = veauxCA + vachesCA;

    // Taux de productivité : veaux vendus / velages de l'année (approx)
    const velagesAnnee = velagesCountByAnnee.get(annee) ?? 0;
    const tauxProductivite = velagesAnnee > 0 ? Math.round((veauxCount / velagesAnnee) * 100) : null;

    return {
      annee,
      veauxCount,
      veauxKgTotal,
      veauxPrixMoyen,
      veauxCA,
      vachesCount,
      vachesKgCarcasse,
      vachesPrixMoyen,
      vachesCA,
      caTotal,
      tauxProductivite,
    };
  });
}

export default async function FinancesStatsPage() {
  const stats = await getStatsPluri();
  const anneeMax = new Date().getFullYear();

  // Stats de l'année courante et comparaisons
  const byAnnee = new Map(stats.map((s) => [s.annee, s]));

  function getEvol(annee: number, field: keyof AnneeStats) {
    const curr = byAnnee.get(annee)?.[field] as number | null;
    const prev = byAnnee.get(annee - 1)?.[field] as number | null;
    if (curr == null || !prev) return null;
    return pct(curr, prev);
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/finances" className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800 flex-1">Statistiques pluriannuelles</h2>
        <span className="text-xs text-gray-400">{stats.length} années</span>
      </div>

      {/* Tableau de comparaison */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left font-semibold">Indicateur</th>
                {stats.map((s) => (
                  <th key={s.annee} className={`px-3 py-2.5 text-center font-semibold ${s.annee === anneeMax ? "bg-green-50 text-green-700" : ""}`}>
                    {s.annee}
                    {s.annee === anneeMax && <span className="block text-xs font-normal text-green-500">en cours</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* Section veaux */}
              <tr className="bg-green-50">
                <td colSpan={stats.length + 1} className="px-3 py-1.5 text-xs font-bold text-green-700 uppercase tracking-wide">
                  🐄 Veaux vif
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Nb vendus</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{s.veauxCount || "—"}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "veauxCount") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Kg total (vif)</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{fmtKg(s.veauxKgTotal)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "veauxKgTotal") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Prix moy. / kg vif</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{fmtPrix(s.veauxPrixMoyen)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "veauxPrixMoyen") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">CA veaux</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-green-700">{fmt€(s.veauxCA || null)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "veauxCA") : null} />
                  </td>
                ))}
              </tr>

              {/* Section vaches */}
              <tr className="bg-orange-50">
                <td colSpan={stats.length + 1} className="px-3 py-1.5 text-xs font-bold text-orange-700 uppercase tracking-wide">
                  🥩 Vaches boucherie
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Nb vendues</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{s.vachesCount || "—"}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "vachesCount") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Kg total (carcasse)</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{fmtKg(s.vachesKgCarcasse)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "vachesKgCarcasse") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">Prix moy. / kg carc.</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-gray-800">{fmtPrix(s.vachesPrixMoyen)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "vachesPrixMoyen") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">CA vaches</td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    <div className="font-bold text-orange-700">{fmt€(s.vachesCA || null)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "vachesCA") : null} />
                  </td>
                ))}
              </tr>

              {/* Total */}
              <tr className="bg-gray-800">
                <td className="px-3 py-3 text-white font-bold">CA TOTAL</td>
                {stats.map((s) => (
                  <td key={s.annee} className="px-3 py-3 text-center">
                    <div className="font-bold text-white text-base">{fmt€(s.caTotal || null)}</div>
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "caTotal") : null} />
                  </td>
                ))}
              </tr>

              {/* Productivité */}
              <tr className="bg-blue-50">
                <td colSpan={stats.length + 1} className="px-3 py-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide">
                  📊 Productivité
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">
                  Taux vêlages → ventes
                  <span className="block text-xs text-gray-400 font-normal">veaux vendus / vêlages</span>
                </td>
                {stats.map((s) => (
                  <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                    {s.tauxProductivite != null ? (
                      <div className={`font-bold text-base ${s.tauxProductivite >= 80 ? "text-green-600" : s.tauxProductivite >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                        {s.tauxProductivite}%
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                    <Evolution val={s.annee > stats[0].annee ? getEvol(s.annee, "tauxProductivite") : null} />
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">
                  CA / veau vendu
                  <span className="block text-xs text-gray-400 font-normal">recette moyenne par veau</span>
                </td>
                {stats.map((s) => {
                  const caParVeau = s.veauxCount > 0 ? Math.round(s.veauxCA / s.veauxCount) : null;
                  const prev = byAnnee.get(s.annee - 1);
                  const prevCaParVeau = prev && prev.veauxCount > 0 ? Math.round(prev.veauxCA / prev.veauxCount) : null;
                  return (
                    <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/50" : ""}`}>
                      <div className="font-bold text-gray-800">{caParVeau ? fmt€(caParVeau) : "—"}</div>
                      <Evolution val={caParVeau && prevCaParVeau ? pct(caParVeau, prevCaParVeau) : null} />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Graphique barres CA */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Évolution du CA</h3>
        <div className="space-y-3">
          {stats.map((s) => {
            const maxCA = Math.max(...stats.map((x) => x.caTotal), 1);
            const pctVeaux = s.caTotal > 0 ? (s.veauxCA / s.caTotal) * 100 : 0;
            const pctVaches = s.caTotal > 0 ? (s.vachesCA / s.caTotal) * 100 : 0;
            return (
              <div key={s.annee} className="flex items-center gap-3">
                <span className={`text-sm font-semibold w-10 shrink-0 ${s.annee === anneeMax ? "text-green-700" : "text-gray-500"}`}>
                  {s.annee}
                </span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full transition-all"
                    style={{ width: `${(s.veauxCA / maxCA) * 100}%` }}
                    title={`Veaux : ${fmt€(s.veauxCA)}`}
                  />
                  <div
                    className="bg-orange-400 h-full transition-all"
                    style={{ width: `${(s.vachesCA / maxCA) * 100}%` }}
                    title={`Vaches : ${fmt€(s.vachesCA)}`}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 w-24 text-right shrink-0">
                  {fmt€(s.caTotal)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>Veaux vif</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/>Vaches boucherie</span>
        </div>
      </div>

      {/* Note sur la productivité */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">📊 Comment lire le taux de productivité ?</p>
        <p className="text-xs text-blue-600">
          Ratio veaux vendus / vêlages enregistrés dans l&apos;année. Un taux {">"}80% = bonne conversion.
          Une vache présente sans veau vendu dans l&apos;année coûte sans rapporter.
        </p>
      </div>
    </div>
  );
}
