import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

import BackButton from "@/app/components/BackButton";
import type { GrowthPoint, GrowthReference, DeathMarker } from "../[nutrav]/DescendantGrowthChart";
import GmqDashboard from "./GmqDashboard";

async function getCroissanceGlobale(): Promise<{ points: GrowthPoint[]; reference: GrowthReference[]; deaths: DeathMarker[] }> {
  // Historique permanent en lecture seule : ne JAMAIS filtrer par statut ACTIF.
  // Les veaux SORTIS restent dans les points et la moyenne de référence,
  // avec leurs pesées antérieures et leur poids vif de vente lorsqu'il existe.
  // La sélection par vêlage évite de confondre les veaux avec les vaches.
  const velages = await prisma.velage.findMany({
    where: { veauId: { not: null } },
    select: { veau: { select: {
      id: true, nutrav: true, danais: true, sexbov: true, estGenisse: true, categorie: true,
      pesees: { select: { date: true, poids: true } },
      sortie: { select: { type: true, date: true, poids: true, poidsVifVente: true, poidsVif: true, modeVente: true, causeMortalite: true } },
    } } },
  });
  const points: GrowthPoint[] = [];
  const deaths: DeathMarker[] = [];
  const buckets = new Map<string, Map<string, { sum: number; count: number }>>();
  const seen = new Set<string>();
  for (const velage of velages) {
    const calf = velage.veau;
    if (!calf || seen.has(calf.id)) continue;
    seen.add(calf.id);
    const retained = calf.sexbov === "F" &&
      ["PRESELECTION_GENISSE", "PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "GENISSE_VALIDEE"].includes(calf.categorie ?? "");
    const deceased = calf.sortie?.type === "MORT";
    const sold = calf.sortie && ["ELEVAGE", "BOUCHERIE", "ENGRAISSEMENT"].includes(calf.sortie.type);
    const sex = calf.sexbov === "M" ? "M" : "F";
    if (deceased && calf.sortie) {
      const ageMonths = (calf.sortie.date.getTime() - calf.danais.getTime()) / (86400000 * 30.4375);
      if (ageMonths >= 0 && ageMonths <= 13) deaths.push({ id: calf.id, number: calf.nutrav, sex, ageMonths, cause: calf.sortie.causeMortalite });
    }
    const observations = calf.pesees.map((p) => ({ date: p.date, kg: p.poids, source: "Pesée" }));
    if (sold && calf.sortie) {
      const kg = calf.sortie.poidsVifVente ?? calf.sortie.poidsVif ??
        (calf.sortie.modeVente !== "CARCASSE" && calf.sortie.type === "ELEVAGE" ? calf.sortie.poids : null);
      if (kg != null) observations.push({ date: calf.sortie.date, kg, source: "Poids vif de vente" });
    }
    for (const obs of observations) {
      const ageMonths = (obs.date.getTime() - calf.danais.getTime()) / (86400000 * 30.4375);
      if (!Number.isFinite(obs.kg) || obs.kg <= 0 || ageMonths < 0 || ageMonths > 13) continue;
      points.push({ id: calf.id, number: calf.nutrav, sex, ageMonths, kg: obs.kg, retained, deceased, source: obs.source });
      const month = Math.min(13, Math.round(ageMonths));
      const key = `${deceased ? "deceased" : retained ? "retained" : "sold"}:${sex}:${month}`;
      const animals = buckets.get(key) ?? new Map<string, { sum: number; count: number }>();
      const prev = animals.get(calf.id) ?? { sum: 0, count: 0 };
      animals.set(calf.id, { sum: prev.sum + obs.kg, count: prev.count + 1 });
      buckets.set(key, animals);
    }
  }
  const reference: GrowthReference[] = [...buckets.entries()].map(([key, animals]) => {
    const [group, sex, month] = key.split(":");
    const weights = [...animals.values()].map((v) => v.sum / v.count);
    return { group, sex, month: Number(month), count: weights.length,
      kg: weights.reduce((total, kg) => total + kg, 0) / weights.length };
  }).sort((a, b) => a.month - b.month);
  return { points, reference, deaths };
}

// Calcul du GMQ en g/j
// GMQ = (dernière pesée - première pesée) / jours écoulés ENTRE les deux pesées.

interface VeauStats {
  veauId: string;
  veauNutrav: string;
  veauNobovi: string | null;
  dateNaissance: Date;
  premierPoids: number | null; // première pesée
  dernierePoids: number | null;
  dernierePeseeDate: Date | null;
  gmq: number | null; // g/j
  vacheId: string;
  vacheNutrav: string;
  vacheNobovi: string | null;
  pereNom: string | null;
  pereNunati: string | null;
  taureauId: string | null;
  taureauNom: string | null;
}

interface GroupeMere {
  vacheId: string;
  vacheNutrav: string;
  vacheNobovi: string | null;
  nbVeaux: number;
  nbGmq: number;
  nbPremierPoids: number;
  nbDernierPoids: number;
  gmqMoyen: number | null;
  poidsMoyPremier: number | null;
  poidsMoyDerniere: number | null;
}

interface GroupePere {
  pereLabel: string; // nom du taureau ou "IA: xxx" ou "Inconnu"
  nbVeaux: number;
  nbGmq: number;
  nbPremierPoids: number;
  nbDernierPoids: number;
  gmqMoyen: number | null;
  poidsMoyPremier: number | null;
  poidsMoyDerniere: number | null;
}

async function getGmqData(): Promise<{ parMere: GroupeMere[]; parPere: GroupePere[] }> {
  // Charger tous les vêlages avec le veau et ses pesées
  const velages = await prisma.velage.findMany({
    where: {
      veauId: { not: null },
    },
    select: {
      id: true,
      vacheId: true,
      vache: {
        select: { id: true, nutrav: true, nobovi: true },
      },
      veauId: true,
      veau: {
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          danais: true,
          pesees: {
            orderBy: { date: "asc" },
            select: { date: true, poids: true },
          },
        },
      },
      pereNom: true,
      pereNunati: true,
      gestation: {
        select: {
          saillie: {
            select: {
              taureau: {
                select: { id: true, nopere: true, nupere: true },
              },
            },
          },
        },
      },
    },
  });

  const veauxStats: VeauStats[] = [];

  for (const velage of velages) {
    if (!velage.veau) continue;
    const veau = velage.veau;
    const pesees = veau.pesees;

    const premierPoids = pesees.length > 0 ? pesees[0].poids : null;
    const dernierePesee = pesees.length > 1 ? pesees[pesees.length - 1] : null;

    let gmq: number | null = null;
    if (premierPoids !== null && dernierePesee !== null) {
      const ageJours =
        (dernierePesee.date.getTime() - pesees[0].date.getTime()) / (1000 * 60 * 60 * 24);
      if (ageJours > 0) {
        gmq = Math.round(((dernierePesee.poids - premierPoids) / ageJours) * 1000); // en g/j
      }
    }

    const taureau = velage.gestation?.saillie?.taureau ?? null;

    veauxStats.push({
      veauId: veau.id,
      veauNutrav: veau.nutrav,
      veauNobovi: veau.nobovi,
      dateNaissance: veau.danais,
      premierPoids,
      dernierePoids: dernierePesee?.poids ?? null,
      dernierePeseeDate: dernierePesee?.date ?? null,
      gmq,
      vacheId: velage.vacheId,
      vacheNutrav: velage.vache.nutrav,
      vacheNobovi: velage.vache.nobovi,
      pereNom: velage.pereNom,
      pereNunati: velage.pereNunati,
      taureauId: taureau?.id ?? null,
      taureauNom: taureau?.nopere ?? taureau?.nupere ?? null,
    });
  }

  // Grouper par mère
  const mereMap = new Map<string, VeauStats[]>();
  for (const v of veauxStats) {
    const existing = mereMap.get(v.vacheId) ?? [];
    existing.push(v);
    mereMap.set(v.vacheId, existing);
  }

  const parMere: GroupeMere[] = [];
  for (const [, veaux] of mereMap) {
    const gmqValues = veaux.map((v) => v.gmq).filter((g): g is number => g !== null);
    const poidsPremierValues = veaux.map((v) => v.premierPoids).filter((p): p is number => p !== null);
    const poidsDerniereValues = veaux.map((v) => v.dernierePoids).filter((p): p is number => p !== null);

    parMere.push({
      vacheId: veaux[0].vacheId,
      vacheNutrav: veaux[0].vacheNutrav,
      vacheNobovi: veaux[0].vacheNobovi,
      nbVeaux: veaux.length,
      nbGmq: gmqValues.length,
      nbPremierPoids: poidsPremierValues.length,
      nbDernierPoids: poidsDerniereValues.length,
      gmqMoyen: gmqValues.length > 0 ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length) : null,
      poidsMoyPremier: poidsPremierValues.length > 0 ? Math.round((poidsPremierValues.reduce((a, b) => a + b, 0) / poidsPremierValues.length) * 10) / 10 : null,
      poidsMoyDerniere: poidsDerniereValues.length > 0 ? Math.round((poidsDerniereValues.reduce((a, b) => a + b, 0) / poidsDerniereValues.length) * 10) / 10 : null,
    });
  }

  parMere.sort((a, b) => {
    if (a.gmqMoyen === null && b.gmqMoyen === null) return a.vacheNutrav.localeCompare(b.vacheNutrav);
    if (a.gmqMoyen === null) return 1;
    if (b.gmqMoyen === null) return -1;
    return b.gmqMoyen - a.gmqMoyen;
  });

  // Grouper par père
  const pereMap = new Map<string, VeauStats[]>();
  for (const v of veauxStats) {
    // Clé : taureauId si dispo, sinon pereNunati, sinon "inconnu"
    const key = v.taureauId ?? v.pereNunati ?? "inconnu";
    const existing = pereMap.get(key) ?? [];
    existing.push(v);
    pereMap.set(key, existing);
  }

  const parPere: GroupePere[] = [];
  for (const [key, veaux] of pereMap) {
    const gmqValues = veaux.map((v) => v.gmq).filter((g): g is number => g !== null);
    const poidsPremierValues = veaux.map((v) => v.premierPoids).filter((p): p is number => p !== null);
    const poidsDerniereValues = veaux.map((v) => v.dernierePoids).filter((p): p is number => p !== null);

    // Construire le label du père
    let pereLabel = "Inconnu";
    if (key !== "inconnu") {
      const first = veaux[0];
      if (first.taureauNom) {
        pereLabel = first.taureauNom;
      } else if (first.pereNom) {
        pereLabel = first.pereNom;
      } else if (first.pereNunati) {
        pereLabel = first.pereNunati;
      }
    }

    parPere.push({
      pereLabel,
      nbVeaux: veaux.length,
      nbGmq: gmqValues.length,
      nbPremierPoids: poidsPremierValues.length,
      nbDernierPoids: poidsDerniereValues.length,
      gmqMoyen: gmqValues.length > 0 ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length) : null,
      poidsMoyPremier: poidsPremierValues.length > 0 ? Math.round((poidsPremierValues.reduce((a, b) => a + b, 0) / poidsPremierValues.length) * 10) / 10 : null,
      poidsMoyDerniere: poidsDerniereValues.length > 0 ? Math.round((poidsDerniereValues.reduce((a, b) => a + b, 0) / poidsDerniereValues.length) * 10) / 10 : null,
    });
  }

  parPere.sort((a, b) => {
    if (a.gmqMoyen === null && b.gmqMoyen === null) return a.pereLabel.localeCompare(b.pereLabel);
    if (a.gmqMoyen === null) return 1;
    if (b.gmqMoyen === null) return -1;
    return b.gmqMoyen - a.gmqMoyen;
  });

  return { parMere, parPere };
}

function GmqBadge({ gmq }: { gmq: number | null }) {
  if (gmq === null) return <span className="text-gray-400">—</span>;
  const color =
    gmq >= 1500 ? "text-green-700 bg-green-50" :
    gmq >= 1200  ? "text-yellow-700 bg-yellow-50" :
    "text-red-700 bg-red-50";
  return (
    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${color}`}>
      {gmq.toLocaleString("fr-FR")} g/j
    </span>
  );
}

export default async function GmqPage() {
  const [{ parMere, parPere }, croissance] = await Promise.all([getGmqData(), getCroissanceGlobale()]);

  const totalVeaux = parMere.reduce((s, r) => s + r.nbVeaux, 0);
  const nbGmqGlobal = parMere.reduce((sum, r) => sum + r.nbGmq, 0);
  const gmqGlobal = nbGmqGlobal > 0 ? Math.round(parMere.reduce((sum, r) => sum + (r.gmqMoyen ?? 0) * r.nbGmq, 0) / nbGmqGlobal) : null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600" />
            Performances des descendants
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Gain Moyen Quotidien des veaux</p>
        </div>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{totalVeaux}</div>
          <div className="text-xs text-gray-500 mt-1">veaux analysés</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            {gmqGlobal !== null ? `${gmqGlobal.toLocaleString("fr-FR")} g/j` : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">GMQ moyen global · {nbGmqGlobal} / {totalVeaux} veaux</div>
        </div>
      </div>

      <GmqDashboard points={croissance.points} reference={croissance.reference} deaths={croissance.deaths} />

      {totalVeaux === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
          Aucune donnée de pesée disponible pour calculer le GMQ.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Tableau par mère */}
      {parMere.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="text-base">🐄</span> Par mère (vache)
          </h3>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Vache</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Veaux</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">GMQ moyen</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">1er poids</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Poids dern.</th>
                  </tr>
                </thead>
                <tbody>
                  {parMere.map((row, i) => (
                    <tr
                      key={row.vacheId}
                      className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/troupeau/${row.vacheNutrav}`} className="hover:underline">
                          <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                            {row.vacheNutrav}
                          </span>
                          {row.vacheNobovi && (
                            <span className="ml-2 text-gray-600 text-xs">{row.vacheNobovi}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">{row.nbVeaux}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1"><GmqBadge gmq={row.gmqMoyen} /><span className="text-[11px] text-gray-500 whitespace-nowrap">sur {row.nbGmq} / {row.nbVeaux} veaux</span></div>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyPremier !== null ? <>{row.poidsMoyPremier} kg<span className="block text-[11px] text-gray-400">{row.nbPremierPoids} / {row.nbVeaux}</span></> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyDerniere !== null ? <>{row.poidsMoyDerniere} kg<span className="block text-[11px] text-gray-400">{row.nbDernierPoids} / {row.nbVeaux}</span></> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tableau par père */}
      {parPere.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="text-base">🐂</span> Par père (taureau / IA)
          </h3>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Père</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Veaux</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">GMQ moyen</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">1er poids</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Poids dern.</th>
                  </tr>
                </thead>
                <tbody>
                  {parPere.map((row, i) => (
                    <tr
                      key={row.pereLabel}
                      className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-gray-800 font-medium text-sm">{row.pereLabel}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">{row.nbVeaux}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1"><GmqBadge gmq={row.gmqMoyen} /><span className="text-[11px] text-gray-500 whitespace-nowrap">sur {row.nbGmq} / {row.nbVeaux} veaux</span></div>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyPremier !== null ? <>{row.poidsMoyPremier} kg<span className="block text-[11px] text-gray-400">{row.nbPremierPoids} / {row.nbVeaux}</span></> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyDerniere !== null ? <>{row.poidsMoyDerniere} kg<span className="block text-[11px] text-gray-400">{row.nbDernierPoids} / {row.nbVeaux}</span></> : "—"}
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
      {/* Légende */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600 mb-2">Méthode de calcul</p>
        <p>• GMQ = (dernière pesée − première pesée) ÷ nombre de jours entre les deux pesées</p>
        <p>• La première pesée enregistrée n’est pas forcément le poids de naissance</p>
        <p>• Minimum 2 pesées requises pour calculer le GMQ</p>
        <p>• Sous chaque moyenne : nombre de veaux avec une mesure exploitable / nombre total de descendants du parent.</p>
        <p>• Les pères sont regroupés selon leur identifiant enregistré, pas uniquement leur nom : ZEUS et Zeus peuvent désigner deux fiches distinctes à vérifier avant fusion.</p>
        <div className="flex gap-3 mt-2 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-block"></span> ≥ 1 500 g/j excellent</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 inline-block"></span> ≥ 1 200 g/j correct</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 inline-block"></span> &lt; 1 000 g/j faible</span>
        </div>
      </div>
    </div>
  );
}
