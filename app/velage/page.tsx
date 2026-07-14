export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import VelageFormWrapper from "./VelageFormWrapper";
import CapteurManager from "./CapteurManager";
import { getGestationCalendar } from "@/lib/gestation-calendar";
import GestationCalendarSection from "@/app/components/GestationCalendarSection";

async function getVelageData() {
  const now = new Date();

  const [capteurs, gestationCalendar, velagesRecents] = await Promise.all([
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    getGestationCalendar(),
    prisma.velage.findMany({
      where: {
        date: {
          gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        vache: { select: { nutrav: true, nobovi: true } },
        veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  return { capteurs, gestationCalendar, velagesRecents };
}

export default async function VelagePage() {
  const { capteurs, gestationCalendar, velagesRecents } = await getVelageData();
  const now = new Date();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mt-2">Vélage</h2>

      {/* Action principale */}
      <VelageFormWrapper />

      {/* Calendrier de gestation */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <CalendarDays size={18} className="text-green-700" />
          <h3 className="font-semibold text-gray-800">
            Calendrier de gestation ({gestationCalendar.length})
          </h3>
        </div>
        <GestationCalendarSection rows={gestationCalendar} now={now} />
      </div>

      {/* Capteurs */}
      <CapteurManager
        capteurs={capteurs.map((c) => ({
          ...c,
          dateAttribution: c.dateAttribution?.toISOString() ?? null,
        }))}
      />

      {/* Vélages récents */}
      {velagesRecents.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Vélages récents (14 derniers jours)</h3>
          <div className="space-y-2">
            {velagesRecents.map((velage) => (
              <div key={velage.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{velage.vache.nutrav}</span>
                    <span className="font-medium text-gray-800">{velage.vache.nobovi ?? "Sans nom"}</span>
                  </div>
                  {velage.veau && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Veau: {velage.veau.nobovi ?? velage.veau.nutrav} ({velage.veau.sexbov})
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{formatDate(velage.date)}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${velage.qualificatif === "NORMAL" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {velage.qualificatif}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
