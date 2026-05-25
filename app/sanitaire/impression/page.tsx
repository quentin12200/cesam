export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { differenceInDays, subDays } from "date-fns";
import { getVaccinsManquants, formatDate, formatAge } from "@/lib/utils";
import PrintButton from "./PrintButton";

export default async function ImpressionSanitairePage() {
  const now = new Date();

  const [animaux, vachesAvecGestation] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { select: { vaccin: true, date: true } } },
      orderBy: { danais: "asc" },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
      include: {
        saillies: { orderBy: { date: "desc" }, take: 1, include: { gestation: true } },
        vaccinations: { select: { vaccin: true, date: true } },
      },
    }),
  ]);

  // Veaux à vacciner (< 2 ans)
  const veauxAVacciner = animaux
    .filter((a) => differenceInDays(now, a.danais) <= 365 * 2)
    .map((animal) => ({
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      ageLabel: formatAge(animal.danais),
      vaccinsManquants: getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
      ),
    }))
    .filter((a) => a.vaccinsManquants.length > 0)
    .sort((a, b) => {
      const ua = a.vaccinsManquants.some((v) => v.urgent);
      const ub = b.vaccinsManquants.some((v) => v.urgent);
      return ua === ub ? 0 : ua ? -1 : 1;
    });

  // Crypto/Rotavec pré-vélage (fenêtre J-21 à J-90)
  const cryptoRotavec = vachesAvecGestation
    .map((vache) => {
      const gestation = vache.saillies[0]?.gestation;
      if (!gestation?.dateVelagePrevue) return null;
      if (!["VERT", "ROSE"].includes(gestation.etat)) return null;
      const jours = differenceInDays(new Date(gestation.dateVelagePrevue), now);
      if (jours < 21 || jours > 90) return null;
      const hasCrypto = vache.vaccinations.some(
        (v) => v.vaccin === "CRYPTO" && differenceInDays(now, v.date) < 300
      );
      const hasRotavec = vache.vaccinations.some(
        (v) => v.vaccin === "ROTAVEC" && differenceInDays(now, v.date) < 300
      );
      if (hasCrypto && hasRotavec) return null;
      return {
        id: vache.id,
        nutrav: vache.nutrav,
        nobovi: vache.nobovi,
        joursAvantVelage: jours,
        dateLabel: formatDate(gestation.dateVelagePrevue),
        hasCrypto,
        hasRotavec,
      };
    })
    .filter(Boolean) as {
      id: string;
      nutrav: string;
      nobovi: string | null;
      joursAvantVelage: number;
      dateLabel: string;
      hasCrypto: boolean;
      hasRotavec: boolean;
    }[];

  // Bolus pré-vélage (fenêtre J-21 à J-45)
  const bolus = vachesAvecGestation
    .map((vache) => {
      const gestation = vache.saillies[0]?.gestation;
      if (!gestation?.dateVelagePrevue) return null;
      if (!["VERT", "ROSE"].includes(gestation.etat)) return null;
      const jours = differenceInDays(new Date(gestation.dateVelagePrevue), now);
      if (jours < 21 || jours > 45) return null;
      const hasBolus = vache.vaccinations.some(
        (v) =>
          (v.vaccin === "BOLUS" || v.vaccin === "METRABOL") &&
          differenceInDays(now, v.date) < 300
      );
      if (hasBolus) return null;
      return {
        id: vache.id,
        nutrav: vache.nutrav,
        nobovi: vache.nobovi,
        joursAvantVelage: jours,
        dateLabel: formatDate(gestation.dateVelagePrevue),
      };
    })
    .filter(Boolean) as {
      id: string;
      nutrav: string;
      nobovi: string | null;
      joursAvantVelage: number;
      dateLabel: string;
    }[];

  cryptoRotavec.sort((a, b) => a.joursAvantVelage - b.joursAvantVelage);
  bolus.sort((a, b) => a.joursAvantVelage - b.joursAvantVelage);

  const printDate = now.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Navigation écran */}
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link
          href="/sanitaire"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
        >
          ← Retour sanitaire
        </Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">GAEC Samuel &amp; Céline</h1>
          <h2 className="text-lg font-semibold text-gray-700 mt-1">
            Liste vaccinations
          </h2>
          <p className="text-xs text-gray-400 mt-1">Imprimé le {printDate}</p>
        </div>

        {/* Tableau 1 — Veaux à vacciner */}
        <h3 className="text-base font-bold text-gray-800 mb-2 mt-6">
          1. Veaux à vacciner ({veauxAVacciner.length})
        </h3>
        <table className="w-full border-collapse text-sm mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">N° Travail</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Âge</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Vaccins à faire</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Urgent</th>
            </tr>
          </thead>
          <tbody>
            {veauxAVacciner.map((animal, i) => {
              const estUrgent = animal.vaccinsManquants.some((v) => v.urgent);
              return (
                <tr
                  key={animal.id}
                  className={estUrgent ? "bg-red-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-3 py-1.5 font-mono font-bold text-green-800">
                    {animal.nutrav}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-gray-700">
                    {animal.nobovi ?? ""}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center">
                    {animal.ageLabel}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5">
                    {animal.vaccinsManquants.map((v) => v.vaccin).join(", ")}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-bold">
                    {estUrgent ? "⚠ Oui" : ""}
                  </td>
                </tr>
              );
            })}
            {veauxAVacciner.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border border-gray-300 px-3 py-6 text-center text-gray-400"
                >
                  Aucun veau à vacciner
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Tableau 2 — Crypto / Rotavec pré-vélage */}
        <h3 className="text-base font-bold text-gray-800 mb-2">
          2. Crypto / Rotavec pré-vélage ({cryptoRotavec.length})
        </h3>
        <table className="w-full border-collapse text-sm mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">N° Vache</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Vélage prévu</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">J-</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">CRYPTO ☑/☐</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">ROTAVEC ☑/☐</th>
            </tr>
          </thead>
          <tbody>
            {cryptoRotavec.map((vache, i) => (
              <tr key={vache.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-300 px-3 py-1.5 font-mono font-bold text-green-800">
                  {vache.nutrav}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-gray-700">
                  {vache.nobovi ?? ""}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center">
                  {vache.dateLabel}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center font-bold">
                  {vache.joursAvantVelage}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center text-lg">
                  {vache.hasCrypto ? "☑" : "☐"}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center text-lg">
                  {vache.hasRotavec ? "☑" : "☐"}
                </td>
              </tr>
            ))}
            {cryptoRotavec.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="border border-gray-300 px-3 py-6 text-center text-gray-400"
                >
                  Aucune vache en fenêtre Crypto/Rotavec
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Tableau 3 — Bolus / Métrabol pré-vélage */}
        <h3 className="text-base font-bold text-gray-800 mb-2">
          3. Bolus / Métrabol pré-vélage ({bolus.length})
        </h3>
        <table className="w-full border-collapse text-sm mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">N° Vache</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">Vélage prévu</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">J-</th>
              <th className="border border-gray-400 px-3 py-2 text-center font-bold">À faire ☐</th>
            </tr>
          </thead>
          <tbody>
            {bolus.map((vache, i) => (
              <tr key={vache.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-300 px-3 py-1.5 font-mono font-bold text-green-800">
                  {vache.nutrav}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-gray-700">
                  {vache.nobovi ?? ""}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center">
                  {vache.dateLabel}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center font-bold">
                  {vache.joursAvantVelage}
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-center text-lg">
                  ☐
                </td>
              </tr>
            ))}
            {bolus.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border border-gray-300 px-3 py-6 text-center text-gray-400"
                >
                  Aucune vache en fenêtre Bolus/Métrabol
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          nav, header, .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          table { width: 100%; font-size: 11px; }
          th, td { padding: 4px 6px !important; }
          @page { size: A4 portrait; margin: 1.5cm; }
          .bg-red-50 { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
