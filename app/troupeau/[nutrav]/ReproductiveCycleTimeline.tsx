import { differenceInCalendarDays } from "date-fns";
import {
  ECHOGRAPHY_WAIT_DAYS,
  POST_CALVING_REST_DAYS,
  VELAGE_IMMINENT_COLORS,
  type EtatGestation,
} from "@/lib/utils";
import { formatGestationElapsed, getGestationProgress } from "@/lib/gestation-progress";

interface Props {
  status: EtatGestation | null;
  breedingDate: Date | null;
  breedingType: string | null;
  dueDate: Date | null;
  lastCalvingDate: Date | null;
}

const STAGES = [
  { short: "Saillie", full: "Saillie / IA", active: "bg-fuchsia-600 text-white", past: "bg-fuchsia-100 text-fuchsia-700" },
  { short: "Attente", full: "Attente avant échographie", active: "bg-slate-500 text-white", past: "bg-slate-200 text-slate-700" },
  { short: "Écho", full: "À échographier", active: "bg-yellow-400 text-black", past: "bg-yellow-100 text-yellow-800" },
  { short: "Gestante", full: "Gestante", active: "bg-green-500 text-white", past: "bg-green-100 text-green-700" },
  { short: "Imminent", full: "Vêlage imminent", active: VELAGE_IMMINENT_COLORS.badge, past: `${VELAGE_IMMINENT_COLORS.surface} ${VELAGE_IMMINENT_COLORS.text}` },
  { short: "Repos", full: "Repos post-vêlage", active: "bg-sky-500 text-white", past: "bg-sky-100 text-sky-700" },
  { short: "Retard ↻", full: "Retard ↻", active: "bg-red-500 text-white", past: "bg-red-100 text-red-700" },
] as const;

function cyclePosition(status: EtatGestation | null, daysSinceBreeding: number | null, isPostCalvingDelay: boolean) {
  if (isPostCalvingDelay) return 6;
  if (status === "REPOS") return 5;
  if (status === "ROSE") return 4;
  if (status === "VERT") return 3;
  if (status === "JAUNE") return 2;
  if (status === "GRIS") return daysSinceBreeding !== null && daysSinceBreeding <= 0 ? 0 : 1;
  if (status === "ROUGE") return 0;
  return -1;
}

export default function ReproductiveCycleTimeline({
  status,
  breedingDate,
  breedingType,
  dueDate,
  lastCalvingDate,
}: Props) {
  const today = new Date();
  const daysSinceBreeding = breedingDate ? Math.max(0, differenceInCalendarDays(today, breedingDate)) : null;
  const daysSinceCalving = lastCalvingDate ? Math.max(0, differenceInCalendarDays(today, lastCalvingDate)) : null;
  const calvingIsLatest = Boolean(lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate));
  const isPostCalvingDelay = status === "ROUGE" && calvingIsLatest && daysSinceCalving !== null && daysSinceCalving > POST_CALVING_REST_DAYS;
  const activeStage = cyclePosition(status, daysSinceBreeding, isPostCalvingDelay);
  const gestation = status === "VERT" || status === "ROSE" ? getGestationProgress(breedingDate, dueDate, today) : null;

  let summary = "Cycle reproductif à renseigner";
  if (isPostCalvingDelay && daysSinceCalving !== null) {
    summary = `Retard de remise à la reproduction · ${daysSinceCalving - POST_CALVING_REST_DAYS} jours`;
  } else if (status === "REPOS" && daysSinceCalving !== null) {
    summary = `Repos post-vêlage · ${daysSinceCalving} ${daysSinceCalving === 1 ? "jour" : "jours"}`;
  } else if (status === "ROSE" && gestation) {
    summary = gestation.remainingDays < 0
      ? `Terme dépassé de ${Math.abs(gestation.remainingDays)} ${Math.abs(gestation.remainingDays) === 1 ? "jour" : "jours"}`
      : `Vêlage imminent · J-${gestation.remainingDays}`;
  } else if (status === "VERT" && gestation) {
    const elapsed = formatGestationElapsed(gestation.elapsedDays);
    summary = `Gestante · ${elapsed}${gestation.remainingDays >= 0 && gestation.remainingDays <= 60 ? ` · J-${gestation.remainingDays}` : ""}`;
  } else if (status === "JAUNE" && daysSinceBreeding !== null) {
    const waitingDays = Math.max(0, daysSinceBreeding - ECHOGRAPHY_WAIT_DAYS);
    summary = `À échographier depuis ${waitingDays} ${waitingDays === 1 ? "jour" : "jours"}`;
  } else if (status === "GRIS" && daysSinceBreeding !== null) {
    const typeLabel = breedingType === "IA" ? "IA" : "Saillie naturelle";
    summary = `${typeLabel} il y a ${daysSinceBreeding} ${daysSinceBreeding === 1 ? "jour" : "jours"}`;
  } else if (status === "ROUGE") {
    summary = "En attente d’une nouvelle saillie / IA";
  }

  return (
    <div className="mt-2 w-full" aria-label={`Cycle reproductif : ${summary}`}>
      <div className="grid grid-cols-7 gap-0.5" role="list" aria-label="Étapes du cycle reproductif">
        {STAGES.map((stage, index) => {
          const isActive = index === activeStage;
          const isPast = activeStage > 0 && index < activeStage;
          const classes = isActive ? stage.active : isPast ? stage.past : "bg-gray-100 text-gray-400";
          const showGestationFill = index === 3 && isActive && gestation;

          return (
            <div
              key={stage.full}
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              title={stage.full}
              className={`relative flex min-h-8 min-w-0 items-center justify-center overflow-hidden rounded-md px-0.5 text-center text-[9px] font-semibold leading-tight sm:min-h-9 sm:px-1 sm:text-[10px] ${classes}`}
            >
              {showGestationFill && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-green-700/35"
                  style={{ width: `${gestation.percentage}%` }}
                />
              )}
              <span className="relative z-[1] sm:hidden">{stage.short}</span>
              <span className="relative z-[1] hidden sm:inline">{stage.full}</span>
            </div>
          );
        })}
      </div>
      <p className={`mt-1.5 text-xs font-semibold ${activeStage === 6 || (status === "ROSE" && gestation && gestation.remainingDays < 0) ? "text-red-700" : activeStage === 4 ? VELAGE_IMMINENT_COLORS.text : "text-gray-700"}`}>
        {summary}
      </p>
    </div>
  );
}
