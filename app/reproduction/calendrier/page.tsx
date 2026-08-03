import BackButton from "@/app/components/BackButton";
export const dynamic = "force-dynamic";

import { differenceInDays } from "date-fns";
import { getGestationCalendar } from "@/lib/gestation-calendar";
import { GestationCalendarTable } from "@/app/components/GestationCalendarTable";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

export default async function CalendrierGestationPage() {
  const now = new Date();
  const gestationsList = await getGestationCalendar();

  const imminentes = gestationsList.filter(
    (g) => differenceInDays(g.dateVelagePrevue, now) <= 30
  );

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
            <BackButton label="Retour" className="inline-flex items-center gap-1.5 text-green-200 hover:text-white text-sm" />
            <span className="text-green-400">|</span>
            <h1 className="font-bold text-lg flex-1">Calendrier de gestation</h1>
          </div>
        </div>

        {/* En-tête d'impression */}
        <div className="print-only px-6 py-4 border-b border-gray-300 mb-4">
          <h1 className="text-xl font-bold text-gray-900">GAEC CESAM — Calendrier de gestation</h1>
          <p className="text-sm text-gray-600">
            Imprimé le {now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            {" · "}{gestationsList.length} vache{gestationsList.length !== 1 ? "s" : ""} gestante{gestationsList.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Résumé */}
          <div className="flex gap-3 no-print">
            <div className="bg-white rounded-xl shadow px-4 py-3 flex-1 text-center">
              <div className="text-2xl font-bold text-green-700">{gestationsList.length}</div>
              <div className="text-xs text-gray-500">Vaches gestantes</div>
            </div>
            <div className={`${VELAGE_IMMINENT_COLORS.surface} rounded-xl shadow px-4 py-3 flex-1 text-center`}>
              <div className={`text-2xl font-bold ${VELAGE_IMMINENT_COLORS.text}`}>{imminentes.length}</div>
              <div className="text-xs text-gray-500">Vêlages ≤ 30 jours</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <GestationCalendarTable rows={gestationsList} now={now} noPrintProgress />
          </div>
        </div>
      </div>
    </>
  );
}
