import Link from "next/link";
import { differenceInDays } from "date-fns";
import type { GestationCalendarRow } from "@/lib/gestation-calendar";

const DUREE_GESTATION = 285;

export function GestationCircle({ daysLeft, size = 36 }: { daysLeft: number; size?: number }) {
  const progress = Math.min(100, Math.max(0, ((DUREE_GESTATION - daysLeft) / DUREE_GESTATION) * 100));
  const r = size === 36 ? 14 : 12;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;
  const color = progress >= 90 ? "#ef4444" : progress >= 75 ? "#f97316" : "#22c55e";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx={c} cy={c} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${c}px ${c}px` }}
      />
      <text x={c} y={c + 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

function fmt(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function GestationCalendarTable({ rows, now, noPrintProgress = false }: { rows: GestationCalendarRow[]; now: Date; noPrintProgress?: boolean }) {
  if (rows.length === 0) {
    return <div className="text-center text-gray-400 py-6 text-sm">Aucune gestation active en cours</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-green-700 text-white text-xs uppercase tracking-wide">
            <th className="px-3 py-2.5 text-left font-semibold">Vache</th>
            <th className="px-3 py-2.5 text-center font-semibold">Vêlage prévu</th>
            <th className="px-3 py-2.5 text-center font-semibold">J-</th>
            <th className="px-3 py-2.5 text-center font-semibold">Saillie</th>
            <th className="px-3 py-2.5 text-center font-semibold">Père</th>
            <th className={`px-2 py-2.5 text-center font-semibold ${noPrintProgress ? "no-print" : ""}`}>Prog.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((g) => {
            const daysLeft = differenceInDays(g.dateVelagePrevue, now);
            const rowBg = daysLeft < 0 ? "bg-red-50" : daysLeft <= 14 ? "bg-pink-50" : daysLeft <= 30 ? "bg-yellow-50" : "";
            return (
              <tr key={g.id} className={rowBg}>
                <td className="px-3 py-2.5">
                  <Link href={`/troupeau/${g.nutrav}`} className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                      {g.nutrav}
                    </span>
                    <span className="text-gray-700 font-medium">{g.nobovi ?? "Sans nom"}</span>
                    {g.estGenisse && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-1 py-0.5 rounded-full">Génisse</span>
                    )}
                  </Link>
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
                    <span className="text-red-600 font-bold">+{Math.abs(daysLeft)}j dépassé</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                  {g.saillieDate ? fmt(g.saillieDate) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-600 text-xs">
                  {g.taureauNom ?? "IA"}
                </td>
                <td className={`px-2 py-2.5 text-center ${noPrintProgress ? "no-print" : ""}`}>
                  <GestationCircle daysLeft={daysLeft} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
