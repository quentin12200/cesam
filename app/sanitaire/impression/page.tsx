export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import { formatAge, getVaccinProtocolSteps, DEFAULT_PROTOCOLES, type ProtocoleVaccinConfig } from "@/lib/utils";
import PrintButton from "@/app/components/PrintButton";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch { /* fallback */ }
  return DEFAULT_PROTOCOLES;
}

export default async function SanitaireImpressionPage() {
  const [protocoles, animaux] = await Promise.all([
    getProtocoles(),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { orderBy: { date: "asc" } } },
      orderBy: { danais: "asc" },
    }),
  ]);

  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Only animals < 2 years for protocol table
  const jeunes = animaux.filter((a) => differenceInDays(now, a.danais) <= 365 * 2);

  // All active protocol names for column headers
  const actifs = protocoles.filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/sanitaire" className="text-sm text-gray-600 hover:text-gray-800">← Retour sanitaire</Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-5xl mx-auto">
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">GAEC Samuel &amp; Céline</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Carnet sanitaire — Protocoles vaccinaux</h1>
          <p className="text-xs text-gray-400 mt-1">Imprimé le {printDate} · {jeunes.length} animal{jeunes.length > 1 ? "s" : ""} (moins de 2 ans)</p>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">N° travail</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Âge</th>
              {actifs.map((p) => (
                <th key={p.id} className="border border-gray-400 px-2 py-1.5 text-center font-bold min-w-[70px]">
                  {p.label}
                </th>
              ))}
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Statut global</th>
            </tr>
          </thead>
          <tbody>
            {jeunes.map((animal, i) => {
              const steps = getVaccinProtocolSteps(animal.danais, animal.vaccinations, protocoles);
              const stepsMap = Object.fromEntries(steps.map((s) => [s.vaccin, s]));
              const dueCount = steps.filter((s) => s.status === "due").length;
              const urgentCount = steps.filter((s) => s.status === "due" && s.isUrgent).length;

              const rowBg = urgentCount > 0 ? "bg-red-50" : dueCount > 0 ? "bg-yellow-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";

              return (
                <tr key={animal.id} className={rowBg}>
                  <td className="border border-gray-300 px-2 py-1 font-mono font-bold text-green-800">{animal.nutrav}</td>
                  <td className="border border-gray-300 px-2 py-1">{animal.nobovi ?? "—"}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{formatAge(animal.danais)}</td>
                  {actifs.map((p) => {
                    const step = stepsMap[p.nom];
                    if (!step) return <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-300">—</td>;
                    if (step.status === "done") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-green-700 font-medium">
                        ✓ {step.doneDate ? fmt(step.doneDate) : ""}
                      </td>
                    );
                    if (step.status === "not_eligible") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-400 text-xs">
                        {step.eligibleDate ? `Élig. ${fmt(step.eligibleDate)}` : "N/A"}
                      </td>
                    );
                    return (
                      <td key={p.id} className={`border border-gray-300 px-2 py-1 text-center font-medium ${step.isUrgent ? "text-red-700 bg-red-100" : "text-orange-600"}`}>
                        {step.isUrgent ? "⚠ URGENT" : "À faire"}
                      </td>
                    );
                  })}
                  <td className={`border border-gray-300 px-2 py-1 text-center font-bold text-xs ${
                    urgentCount > 0 ? "text-red-700" : dueCount > 0 ? "text-orange-600" : "text-green-700"
                  }`}>
                    {urgentCount > 0 ? `${urgentCount} urgent${urgentCount > 1 ? "s" : ""}` :
                     dueCount > 0 ? `${dueCount} à faire` : "Complet"}
                  </td>
                </tr>
              );
            })}
            {jeunes.length === 0 && (
              <tr>
                <td colSpan={actifs.length + 4} className="border border-gray-300 px-3 py-8 text-center text-gray-400">
                  Aucun animal de moins de 2 ans
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex gap-6 text-xs text-gray-500 print:block">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-50 border border-red-200 rounded" /> Urgent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-50 border border-yellow-200 rounded" /> À planifier</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border border-gray-300 rounded" /> Complet</span>
        </div>
      </div>

      <style>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 9px; }
          @page { size: A4 landscape; margin: 1cm; }
          table { width: 100%; }
          th, td { padding: 3px 5px !important; }
          .bg-red-50 { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-red-100 { background-color: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-yellow-50 { background-color: #fefce8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
