export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PrintButton from "./PrintButton";

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export default async function ImpressionVelagesPage() {
  const annee = new Date().getFullYear();

  // Gestations confirmées avec dateVelagePrevue (à venir ou vêlées cette année)
  const gestations = await prisma.gestation.findMany({
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

  const today = new Date();
  const printDate = today.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      {/* Navigation écran */}
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/reproduction" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm">
          ← Retour reproduction
        </Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">GAEC Samuel &amp; Céline</h1>
          <h2 className="text-lg font-semibold text-gray-700 mt-1">
            Calendrier de vêlages {annee}
          </h2>
          <p className="text-xs text-gray-400 mt-1">Imprimé le {printDate}</p>
        </div>

        {/* Tableau */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">N° vache</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">9 mois</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Père</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Vélage</th>
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

              // Surligner les vêlages imminents (< 21 j)
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
                    {daysLeft !== null && !velage && (
                      <span className={`ml-1 text-xs ${daysLeft <= 14 ? "text-pink-600 font-bold" : daysLeft <= 30 ? "text-orange-500" : "text-gray-400"}`}>
                        J-{daysLeft}
                      </span>
                    )}
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
                  Aucune gestation confirmée — enregistrez des échographies pour remplir ce tableau
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-xs text-gray-400 mt-4 print:hidden">
          {gestations.length} entrée{gestations.length > 1 ? "s" : ""} · Les lignes roses = vêlage dans moins de 14 jours · Les lignes jaunes = dans moins de 30 jours
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
