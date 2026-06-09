import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";

// Calcul du GMQ en g/j
// GMQ = (poids dernière pesée - poids naissance) / age en jours à dernière pesée
// Poids naissance = première pesée (la plus ancienne)
// Age en jours = (date dernière pesée - date naissance du veau)

interface VeauStats {
  veauId: string;
  veauNutrav: string;
  veauNobovi: string | null;
  dateNaissance: Date;
  poidsNaissance: number | null; // première pesée
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
  gmqMoyen: number | null;
  poidsMoyNaissance: number | null;
  poidsMoyDerniere: number | null;
}

interface GroupePere {
  pereLabel: string; // nom du taureau ou "IA: xxx" ou "Inconnu"
  nbVeaux: number;
  gmqMoyen: number | null;
  poidsMoyNaissance: number | null;
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

    const poidsNaissance = pesees.length > 0 ? pesees[0].poids : null;
    const dernierePesee = pesees.length > 1 ? pesees[pesees.length - 1] : null;

    let gmq: number | null = null;
    if (poidsNaissance !== null && dernierePesee !== null) {
      const ageJours =
        (dernierePesee.date.getTime() - veau.danais.getTime()) / (1000 * 60 * 60 * 24);
      if (ageJours > 0) {
        gmq = Math.round(((dernierePesee.poids - poidsNaissance) / ageJours) * 1000); // en g/j
      }
    }

    const taureau = velage.gestation?.saillie?.taureau ?? null;

    veauxStats.push({
      veauId: veau.id,
      veauNutrav: veau.nutrav,
      veauNobovi: veau.nobovi,
      dateNaissance: veau.danais,
      poidsNaissance,
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
    const poidsNaissValues = veaux.map((v) => v.poidsNaissance).filter((p): p is number => p !== null);
    const poidsDerniereValues = veaux.map((v) => v.dernierePoids).filter((p): p is number => p !== null);

    parMere.push({
      vacheId: veaux[0].vacheId,
      vacheNutrav: veaux[0].vacheNutrav,
      vacheNobovi: veaux[0].vacheNobovi,
      nbVeaux: veaux.length,
      gmqMoyen: gmqValues.length > 0 ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length) : null,
      poidsMoyNaissance: poidsNaissValues.length > 0 ? Math.round((poidsNaissValues.reduce((a, b) => a + b, 0) / poidsNaissValues.length) * 10) / 10 : null,
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
    const poidsNaissValues = veaux.map((v) => v.poidsNaissance).filter((p): p is number => p !== null);
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
      gmqMoyen: gmqValues.length > 0 ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length) : null,
      poidsMoyNaissance: poidsNaissValues.length > 0 ? Math.round((poidsNaissValues.reduce((a, b) => a + b, 0) / poidsNaissValues.length) * 10) / 10 : null,
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
  const { parMere, parPere } = await getGmqData();

  const totalVeaux = parMere.reduce((s, r) => s + r.nbVeaux, 0);
  const allGmq = parMere.flatMap((r) => r.gmqMoyen !== null ? [r.gmqMoyen] : []);
  const gmqGlobal = allGmq.length > 0 ? Math.round(allGmq.reduce((a, b) => a + b, 0) / allGmq.length) : null;

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mt-2">
        <Link href="/troupeau" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600" />
            Performances GMQ
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Gain Moyen Quotidien des veaux</p>
        </div>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{totalVeaux}</div>
          <div className="text-xs text-gray-500 mt-1">veaux analysés</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            {gmqGlobal !== null ? `${gmqGlobal.toLocaleString("fr-FR")} g/j` : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">GMQ moyen global</div>
        </div>
      </div>

      {totalVeaux === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
          Aucune donnée de pesée disponible pour calculer le GMQ.
        </div>
      )}

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
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Poids naiss.</th>
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
                        <GmqBadge gmq={row.gmqMoyen} />
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyNaissance !== null ? `${row.poidsMoyNaissance} kg` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyDerniere !== null ? `${row.poidsMoyDerniere} kg` : "—"}
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
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Poids naiss.</th>
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
                        <GmqBadge gmq={row.gmqMoyen} />
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyNaissance !== null ? `${row.poidsMoyNaissance} kg` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {row.poidsMoyDerniere !== null ? `${row.poidsMoyDerniere} kg` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Légende */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600 mb-2">Méthode de calcul</p>
        <p>• GMQ = (poids dernière pesée − poids 1ʳᵉ pesée) ÷ âge en jours à la dernière pesée</p>
        <p>• Poids naissance = 1ʳᵉ pesée enregistrée</p>
        <p>• Minimum 2 pesées requises pour calculer le GMQ</p>
        <div className="flex gap-3 mt-2 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-block"></span> ≥ 1 500 g/j excellent</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 inline-block"></span> ≥ 1 200 g/j correct</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 inline-block"></span> &lt; 1 000 g/j faible</span>
        </div>
      </div>
    </div>
  );
}
