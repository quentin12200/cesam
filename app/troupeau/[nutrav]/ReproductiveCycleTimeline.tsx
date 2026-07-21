import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import {
  ECHOGRAPHY_WAIT_DAYS,
  POST_CALVING_REST_DAYS,
  VELAGE_IMMINENT_DAYS,
  type EtatGestation,
} from "@/lib/utils";
import { GESTATION_REFERENCE_DAYS, formatGestationElapsed, getGestationProgress } from "@/lib/gestation-progress";

interface Props {
  status: EtatGestation | null;
  breedingDate: Date | null;
  breedingType: string | null;
  dueDate: Date | null;
  echoDate: Date | null;
  echoResult: string | null;
  lastCalvingDate: Date | null;
  statusModifiedAt: Date | null;
}

interface Segment {
  id: string;
  days: number;
  active: string;
  past: string;
  current?: boolean;
  marker?: "Vêlage" | "Saillie / IA" | "Échographie";
  striped?: boolean;
}

const OPEN_CYCLE_SCALE_DAYS = 365;

function elapsedDays(from: Date, to: Date) {
  return Math.max(0, differenceInCalendarDays(to, from));
}

function addSegment(segments: Segment[], segment: Segment) {
  if (segment.days > 0) segments.push(segment);
}

export default function ReproductiveCycleTimeline({
  status,
  breedingDate,
  breedingType,
  dueDate,
  echoDate,
  echoResult,
  lastCalvingDate,
  statusModifiedAt,
}: Props) {
  const today = new Date();
  const segments: Segment[] = [];
  const daysSinceBreeding = breedingDate ? elapsedDays(breedingDate, today) : null;
  const daysSinceCalving = lastCalvingDate ? elapsedDays(lastCalvingDate, today) : null;
  const calvingIsLatest = Boolean(lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate));
  const isPostCalvingDelay = status === "ROUGE" && calvingIsLatest && daysSinceCalving !== null && daysSinceCalving > POST_CALVING_REST_DAYS;
  const isEmptyAfterEcho = status === "ROUGE" && !calvingIsLatest && (echoResult === "VIDE" || Boolean(echoDate));
  const gestation = status === "VERT" || status === "ROSE" ? getGestationProgress(breedingDate, dueDate, today) : null;
  let summary = "Cycle reproductif à renseigner";
  let horizonDays = OPEN_CYCLE_SCALE_DAYS;

  if ((status === "REPOS" || isPostCalvingDelay) && lastCalvingDate && daysSinceCalving !== null) {
    const restDays = Math.min(daysSinceCalving, POST_CALVING_REST_DAYS);
    addSegment(segments, {
      id: "repos",
      days: restDays || 1,
      active: "bg-sky-500",
      past: "bg-sky-200",
      current: status === "REPOS",
      marker: "Vêlage",
    });

    if (isPostCalvingDelay) {
      const delayDays = daysSinceCalving - POST_CALVING_REST_DAYS;
      addSegment(segments, {
        id: "retard",
        days: delayDays,
        active: "bg-red-500",
        past: "bg-red-200",
        current: true,
        striped: true,
      });
      summary = `En retard depuis ${delayDays} ${delayDays === 1 ? "jour" : "jours"}`;
    } else {
      summary = `Repos post-vêlage · ${daysSinceCalving} ${daysSinceCalving === 1 ? "jour" : "jours"}`;
    }
  } else if (breedingDate && daysSinceBreeding !== null) {
    const expectedEchoDate = addDays(breedingDate, ECHOGRAPHY_WAIT_DAYS);
    const effectiveEchoDate = echoDate && echoDate >= breedingDate ? echoDate : null;
    const waitingEnd = effectiveEchoDate && effectiveEchoDate < expectedEchoDate ? effectiveEchoDate : expectedEchoDate;
    const waitingDays = elapsedDays(breedingDate, waitingEnd > today ? today : waitingEnd);
    addSegment(segments, {
      id: "attente",
      days: waitingDays || (daysSinceBreeding === 0 ? 1 : 0),
      active: "bg-slate-500",
      past: "bg-slate-200",
      current: status === "GRIS",
      marker: "Saillie / IA",
    });

    const echoWaitingEnd = effectiveEchoDate ?? today;
    const echoWaitingDays = echoWaitingEnd > expectedEchoDate ? elapsedDays(expectedEchoDate, echoWaitingEnd) : 0;
    addSegment(segments, {
      id: "echo-wait",
      days: echoWaitingDays || (status === "JAUNE" ? 1 : 0),
      active: "bg-yellow-400",
      past: "bg-yellow-100",
      current: status === "JAUNE",
    });

    if (isEmptyAfterEcho) {
      const emptySince = effectiveEchoDate ?? statusModifiedAt ?? breedingDate;
      const availableDays = elapsedDays(emptySince, today);
      addSegment(segments, {
        id: "a-remettre",
        days: availableDays || 1,
        active: "bg-fuchsia-500",
        past: "bg-fuchsia-100",
        current: true,
        marker: effectiveEchoDate ? "Échographie" : undefined,
      });
      summary = `À remettre à la reproduction depuis ${availableDays} ${availableDays === 1 ? "jour" : "jours"}`;
    } else if ((status === "VERT" || status === "ROSE") && gestation) {
      const confirmedAt = effectiveEchoDate ?? expectedEchoDate;
      const calculatedDueDate = dueDate ?? addDays(breedingDate, GESTATION_REFERENCE_DAYS);
      const imminentAt = subDays(calculatedDueDate, VELAGE_IMMINENT_DAYS);
      const gestationEnd = today < imminentAt ? today : imminentAt;
      addSegment(segments, {
        id: "gestante",
        days: Math.max(status === "VERT" ? 1 : 0, elapsedDays(confirmedAt, gestationEnd)),
        active: "bg-green-500",
        past: "bg-green-200",
        current: status === "VERT",
        marker: "Échographie",
      });

      if (status === "ROSE") {
        const imminentEnd = today < calculatedDueDate ? today : calculatedDueDate;
        addSegment(segments, {
          id: "imminent",
          days: Math.max(1, elapsedDays(imminentAt, imminentEnd)),
          active: "bg-orange-500",
          past: "bg-orange-200",
          current: gestation.remainingDays >= 0,
        });
        if (gestation.remainingDays < 0) {
          addSegment(segments, {
            id: "terme-depasse",
            days: Math.abs(gestation.remainingDays),
            active: "bg-red-500",
            past: "bg-red-200",
            current: true,
            striped: true,
          });
        }
      }

      horizonDays = Math.max(1, elapsedDays(breedingDate, calculatedDueDate));
      if (status === "ROSE") {
        summary = gestation.remainingDays < 0
          ? `Terme dépassé de ${Math.abs(gestation.remainingDays)} ${Math.abs(gestation.remainingDays) === 1 ? "jour" : "jours"}`
          : `Vêlage imminent · J-${gestation.remainingDays}`;
      } else {
        const elapsed = formatGestationElapsed(gestation.elapsedDays);
        summary = `Gestante · ${elapsed}${gestation.remainingDays >= 0 && gestation.remainingDays <= 60 ? ` · J-${gestation.remainingDays}` : ""}`;
      }
    } else if (status === "JAUNE") {
      const waitingForEchoDays = Math.max(0, daysSinceBreeding - ECHOGRAPHY_WAIT_DAYS);
      summary = `À échographier depuis ${waitingForEchoDays} ${waitingForEchoDays === 1 ? "jour" : "jours"}`;
    } else if (status === "GRIS") {
      const typeLabel = breedingType === "IA" ? "IA" : "Saillie naturelle";
      summary = daysSinceBreeding === 0
        ? `${typeLabel} aujourd’hui`
        : `${typeLabel} il y a ${daysSinceBreeding} ${daysSinceBreeding === 1 ? "jour" : "jours"}`;
    } else if (status === "ROUGE") {
      const availableSince = statusModifiedAt ?? breedingDate;
      const availableDays = elapsedDays(availableSince, today);
      addSegment(segments, {
        id: "a-remettre",
        days: availableDays || 1,
        active: "bg-fuchsia-500",
        past: "bg-fuchsia-100",
        current: true,
      });
      summary = `À remettre à la reproduction depuis ${availableDays} ${availableDays === 1 ? "jour" : "jours"}`;
    }
  } else if (status === "ROUGE") {
    summary = "À remettre à la reproduction";
  }

  const trackedDays = segments.reduce((total, segment) => total + segment.days, 0);
  const scaleDays = Math.max(horizonDays, trackedDays);
  const futureDays = Math.max(0, scaleDays - trackedDays);

  return (
    <div className="mt-2 w-full" aria-label={`Cycle reproductif : ${summary}`}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label={summary}>
        {segments.map((segment) => (
          <span
            key={segment.id}
            title={segment.marker ? `${segment.marker} · ${segment.days} jours` : `${segment.days} jours`}
            className={`relative min-w-0 ${segment.current ? segment.active : segment.past}`}
            style={{
              flexGrow: segment.days,
              flexBasis: 0,
              backgroundImage: segment.striped
                ? "repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,.35) 4px, rgba(255,255,255,.35) 7px)"
                : undefined,
            }}
          >
            {segment.marker && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-0.5 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
              />
            )}
          </span>
        ))}
        {futureDays > 0 && <span className="bg-gray-100" style={{ flexGrow: futureDays, flexBasis: 0 }} />}
      </div>
      <p className={`mt-1.5 text-xs font-semibold ${summary.startsWith("En retard") || summary.startsWith("Terme dépassé") ? "text-red-700" : "text-gray-700"}`}>
        {summary}
      </p>
    </div>
  );
}
