import Link from "next/link";
import { differenceInDays } from "date-fns";
import type { GestationCalendarRow } from "@/lib/gestation-calendar";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

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

function echeanceClasses(daysLeft: number) {
  if (daysLeft < 0) {
    return {
      border: "border-l-red-600",
      countdown: "text-red-700",
    };
  }
  if (daysLeft <= 14) {
    return {
      border: "border-l-red-400",
      countdown: "text-red-600",
    };
  }
  if (daysLeft <= 30) {
    return {
      border: "border-l-amber-400",
      countdown: "text-amber-700",
    };
  }
  return {
    border: "border-l-green-500",
    countdown: "text-green-700",
  };
}

export function GestationCalendarTable({ rows, now, noPrintProgress = false }: { rows: GestationCalendarRow[]; now: Date; noPrintProgress?: boolean }) {
  if (rows.length === 0) {
    return <div className="text-center text-gray-400 py-6 text-sm">Aucune gestation active en cours</div>;
  }

  return (
    <>
      <div className="md:hidden print:hidden divide-y divide-gray-100">
        {rows.map((g) => {
          const daysLeft = differenceInDays(g.dateVelagePrevue, now);
          const classes = echeanceClasses(daysLeft);
          const countdown = daysLeft >= 0 ? `J-${daysLeft}` : `J+${Math.abs(daysLeft)}`;

          return (
            <Link
              key={g.id}
              href={`/troupeau/${g.nutrav}?onglet=reproduction`}
              className={`block border-l-4 ${classes.border} px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors`}
              aria-label={`Ouvrir la fiche reproduction de ${g.nutrav} ${g.nobovi ?? "Sans nom"}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex items-baseline gap-1.5">
                  <span className="font-mono font-bold text-sm text-green-800 shrink-0">
                    {g.nutrav}
                  </span>
                  <span className="text-gray-400 shrink-0">—</span>
                  <span className="font-semibold text-sm text-gray-800 truncate">
                    {g.nobovi ?? "Sans nom"}
                  </span>
                </div>
                <span className={`font-mono text-base font-bold tabular-nums shrink-0 ${classes.countdown}`}>
                  {countdown}
                </span>
              </div>

              <div className="mt-1 text-[11px] leading-4 text-gray-500">
                <span>
                  Vêlage <span className="font-semibold text-gray-700">{fmt(g.dateVelagePrevue)}</span>
                </span>
                <span className="text-gray-300"> · </span>
                <span>Saillie {g.saillieDate ? fmt(g.saillieDate) : "—"}</span>
                <span className="text-gray-300"> · </span>
                <span>
                  Père : <span className="text-gray-600">{g.taureauNom ?? "IA"}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="hidden md:block print:block overflow-x-auto">
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
              const rowBg = daysLeft < 0 ? "bg-red-50" : daysLeft <= 30 ? VELAGE_IMMINENT_COLORS.surface : "";
              return (
                <tr key={g.id} className={rowBg}>
                  <td className="px-3 py-2.5">
                    <Link href={`/troupeau/${g.nutrav}?onglet=reproduction`} className="flex items-center gap-1.5 flex-wrap">
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
    </>
  );
}
