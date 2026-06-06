export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays, subMonths } from "date-fns";
import { getEtatGestation, getBadgeClass, type EtatGestation } from "@/lib/utils";
import Link from "next/link";
import PrintButton from "./PrintButton";

const DUREE_GESTATION = 285;

const ETAT_LABEL: Record<string, string> = {
  VERT: "Pleine",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "Récente",
  ROUGE: "Vide",
  REPOS: "Repos",
};

function GestationCircle({ daysLeft }: { daysLeft: number }) {
  const progress = Math.min(100, Math.max(0, ((DUREE_GESTATION - daysLeft) / DUREE_GESTATION) * 100));
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;
  const color = progress >= 90 ? "#ef4444" : progress >= 75 ? "#f97316" : "#22c55e";
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="inline-block">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "18px 18px" }}
      />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

interface GestationRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  estGenisse: boolean;
  categorie: string | null;
  etat: EtatGestation;
  dateVelagePrevue: Date;
  taureauNom: string | null;
  saillieDate: Date | null;
}

export default async function CalendrierGestationPage() {
  const now = new Date();
  const dateMin24Mois = subMonths(now, 24);

  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      AND: [
        { OR: [{ categorie: null }, { categorie: { not: "ENGRAISSEMENT" } }] },
        {
          OR: [
            { estGenisse: false, danais: { lte: dateMin24Mois } },
            { estGenisse: false, velagesVache: { some: {} } },
            { estGenisse: true, danais: { lte: dateMin24Mois } },
          ],
        },
      ],
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      estGenisse: true,
      categorie: true,
      saillies: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          date: true,
          taureau: { select: { nopere: true, nupere: true } },
          gestation: { select: { etat: true, dateVelagePrevue: true } },
        },
      },
      velagesVache: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  const gestationsList: GestationRow[] = vaches
    .flatMap((v) => {
      const saillie = v.saillies[0];
      if (!saillie?.gestation?.dateVelagePrevue) return [];
      const etat = getEtatGestation(
        saillie.date ? new Date(saillie.date) : null,
        saillie.gestation.etat,
        new Date(saillie.gestation.dateVelagePrevue),
        v.velagesVache[0]?.date ? new Date(v.velagesVache[0].date) : null
      ) as EtatGestation;
      if (etat !== "VERT" && etat !== "ROSE") return [];
      return [{
        id: v.id,
        nutrav: v.nutrav,
        nobovi: v.nobovi,
        estGenisse: v.estGenisse,
        categorie: v.categorie,
        etat,
        dateVelagePrevue: saillie.gestation.dateVelagePrevue,
        taureauNom: saillie.taureau?.nopere ?? saillie.taureau?.nupere ?? null,
        saillieDate: saillie.date,
      }];
    })
    .sort((a, b) => a.dateVelagePrevue.getTime() - b.dateVelagePrevue.getTime());

  const imminentes = gestationsList.filter(
    (g) => differenceInDays(g.dateVelagePrevue, now) <= 30
  );

  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        <div className="bg-green-700 text-white px-6 py-4 no-print">
          <div className="flex items-center gap-3">
            <Link href="/reproduction" className="text-green-200 hover:text-white text-sm">← Retour</Link>
            <span className="text-green-400">|</span>
            <h1 className="font-bold text-lg flex-1">Calendrier de gestation</h1>
            <PrintButton />
          </div>
        </div>

        {/* En-tête d'impression */}
        <div className="print-only px-6 py-4 border-b border-gray-300 mb-4">
          <h1 className="text-xl font-bold text-gray-900">GAEC CESAM — Calendrier de gestation</h1>
          <p className="text-sm text-gray-600">
            Imprimé le {now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            {" · "}{gestationsList.length} vache{gestationsList.length !== 1 ? "s" : ""} pleines
          </p>
        </div>

        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Résumé */}
          <div className="flex gap-3 no-print">
            <div className="bg-white rounded-xl shadow px-4 py-3 flex-1 text-center">
              <div className="text-2xl font-bold text-green-700">{gestationsList.length}</div>
              <div className="text-xs text-gray-500">Vaches pleines</div>
            </div>
            <div className="bg-pink-50 rounded-xl shadow px-4 py-3 flex-1 text-center">
              <div className="text-2xl font-bold text-pink-600">{imminentes.length}</div>
              <div className="text-xs text-gray-500">Vêlages ≤ 30 jours</div>
            </div>
          </div>

          {gestationsList.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
              Aucune gestation active en cours
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-700 text-white text-xs uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left font-semibold">Vache</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Statut</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Vêlage prévu</th>
                    <th className="px-3 py-2.5 text-center font-semibold">J-</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Saillie</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Père</th>
                    <th className="px-2 py-2.5 text-center font-semibold no-print">Prog.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gestationsList.map((g) => {
                    const daysLeft = differenceInDays(g.dateVelagePrevue, now);
                    const rowBg = daysLeft <= 14 ? "bg-pink-50" : daysLeft <= 30 ? "bg-yellow-50" : "";
                    return (
                      <tr key={g.id} className={rowBg}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                              {g.nutrav}
                            </span>
                            <span className="text-gray-700 font-medium">{g.nobovi ?? "Sans nom"}</span>
                            {g.estGenisse && (
                              <span className="text-xs bg-teal-100 text-teal-700 px-1 py-0.5 rounded-full">Génisse</span>
                            )}
                            {g.categorie === "A_ENGRAISSER" && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full">🥩</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(g.etat)}`}>
                            {ETAT_LABEL[g.etat] ?? g.etat}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-gray-800">
                          {fmt(g.dateVelagePrevue)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs">
                          {daysLeft >= 0 ? (
                            <span className={daysLeft <= 14 ? "text-red-600 font-bold" : daysLeft <= 30 ? "text-orange-600 font-bold" : "text-gray-500"}>
                              J-{daysLeft}
                            </span>
                          ) : (
                            <span className="text-red-500">Dépassé</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                          {g.saillieDate ? fmt(g.saillieDate) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600 text-xs">
                          {g.taureauNom ?? "IA"}
                        </td>
                        <td className="px-2 py-2.5 text-center no-print">
                          <GestationCircle daysLeft={daysLeft} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
