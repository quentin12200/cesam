export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PrintButton from "./PrintButton";

interface PageProps {
  searchParams: Promise<{ mois?: string; quantite?: string }>;
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

const MOIS_LABELS = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default async function ImpressionVelagesPage({ searchParams }: PageProps) {
  const { mois, quantite } = await searchParams;
  const annee = new Date().getFullYear();

  const gestationsRaw = await prisma.gestation.findMany({
    where: {
      dateVelagePrevue: { not: null },
      OR: [
        { etat: { in: ["VERT", "ROSE"] } },
        {
          velage: {
            date: { gte: new Date(`${annee - 1}-08-01`) },
          },
        },
      ],
    },
    select: {
      dateVelagePrevue: true,
      etat: true,
      velage: {
        select: {
          date: true,
          pereNom: true,
          veau: {
            select: { nutrav: true, sexbov: true },
          },
        },
      },
      saillie: {
        select: {
          taureau: { select: { nopere: true, nupere: true } },
          animal: { select: { nutrav: true, nobovi: true } },
        },
      },
    },
    orderBy: { dateVelagePrevue: "asc" },
  });

  // Apply month filter
  let gestations = gestationsRaw;
  const moisNum = mois ? parseInt(mois, 10) : null;
  if (moisNum && moisNum >= 1 && moisNum <= 12) {
    gestations = gestations.filter((g) => {
      if (!g.dateVelagePrevue) return false;
      return new Date(g.dateVelagePrevue).getMonth() + 1 === moisNum;
    });
  }

  // Apply quantity filter
  const quantiteNum = quantite ? parseInt(quantite, 10) : null;
  if (quantiteNum && quantiteNum > 0) {
    gestations = gestations.slice(0, quantiteNum);
  }

  const today = new Date();
  const printDate = today.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      {/* Navigation et filtres — masqués à l'impression */}
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/reproduction" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm">
          ← Retour reproduction
        </Link>
        <PrintButton />
      </div>

      {/* Filtres */}
      <div className="px-6 pb-4 flex flex-wrap gap-3 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Par mois</label>
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/reproduction/impression${quantite ? `?quantite=${quantite}` : ""}`}
              className={`px-2 py-1 rounded text-xs border transition-colors ${!mois ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
            >
              Tous
            </Link>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
              <Link
                key={m}
                href={`/reproduction/impression?mois=${m}${quantite ? `&quantite=${quantite}` : ""}`}
                className={`px-2 py-1 rounded text-xs border transition-colors ${moisNum === m ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {MOIS_LABELS[m].slice(0, 3)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quantité max</label>
          <div className="flex gap-1">
            {[undefined, 10, 20, 30, 50].map((q) => (
              <Link
                key={q ?? "tous"}
                href={`/reproduction/impression${mois ? `?mois=${mois}` : ""}${q ? `${mois ? "&" : "?"}quantite=${q}` : ""}`}
                className={`px-2 py-1 rounded text-xs border transition-colors ${(quantiteNum ?? null) === (q ?? null) ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {q ? `${q}` : "Tous"}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">GAEC Samuel &amp; Céline</h1>
          <h2 className="text-lg font-semibold text-gray-700 mt-1">
            Calendrier de vêlages {annee}
            {moisNum ? ` — ${MOIS_LABELS[moisNum]}` : ""}
          </h2>
          <p className="text-xs text-gray-400 mt-1">Imprimé le {printDate}</p>
        </div>

        {/* Tableau */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">N° vache</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Terme</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Père</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Date vêlage</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Sexe</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">N° veau</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Synel</th>
            </tr>
          </thead>
          <tbody>
            {gestations.map((g, i) => {
              const vache = g.saillie.animal;
              const velage = g.velage;
              const pereNom =
                g.saillie.taureau?.nopere ??
                g.saillie.taureau?.nupere ??
                velage?.pereNom ??
                "IA";
              const veauNutrav = velage?.veau?.nutrav ?? "";
              const sexe = velage?.veau?.sexbov === "F" ? "F" : velage?.veau ? "M" : "";

              const daysLeft = g.dateVelagePrevue
                ? Math.ceil((new Date(g.dateVelagePrevue).getTime() - today.getTime()) / 86400000)
                : null;
              const rowBg =
                velage
                  ? "bg-white"
                  : daysLeft !== null && daysLeft <= 14
                  ? "bg-pink-50"
                  : daysLeft !== null && daysLeft <= 30
                  ? "bg-yellow-50"
                  : i % 2 === 0
                  ? "bg-white"
                  : "bg-gray-50";

              return (
                <tr key={`${vache.nutrav}-${i}`} className={rowBg}>
                  <td className="border border-gray-300 px-3 py-1.5 font-mono font-bold text-green-800">
                    {vache.nutrav}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-gray-700">
                    {vache.nobovi ?? ""}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-medium">
                    {fmt(g.dateVelagePrevue)}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center">{pereNom}</td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-medium">
                    {velage ? fmt(velage.date) : ""}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-bold">
                    {sexe}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-mono text-xs">
                    {veauNutrav}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center text-lg">
                    {velage ? "☑" : "☐"}
                  </td>
                </tr>
              );
            })}
            {gestations.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-gray-300 px-3 py-8 text-center text-gray-400">
                  Aucun vêlage trouvé pour ce filtre
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-xs text-gray-400 mt-4 print:hidden">
          {gestations.length} entrée{gestations.length > 1 ? "s" : ""} · Lignes roses = vêlage &lt; 14 jours · Lignes jaunes = &lt; 30 jours
        </p>
      </div>

      <style>{`
        @media print {
          nav, header, .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          table { width: 100%; font-size: 11px; }
          th, td { padding: 4px 6px !important; }
          @page { size: A4 landscape; margin: 1.5cm; }
          .bg-pink-50 { background-color: #fdf2f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-yellow-50 { background-color: #fefce8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
