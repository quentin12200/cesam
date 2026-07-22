Exit code: 0
Wall time: 0.6 seconds
Output:
"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import { BarChart3, CalendarDays, Check, HeartPulse, List, RefreshCw, Syringe } from "lucide-react";
import {
  ECHOGRAPHY_WAIT_DAYS,
  POST_CALVING_REST_DAYS,
  VELAGE_IMMINENT_DAYS,
  VELAGE_IMMINENT_COLORS,
  type EtatGestation,
} from "@/lib/utils";
import {
  GESTATION_REFERENCE_DAYS,
  formatGestationElapsed,
  getGestationProgress,
} from "@/lib/gestation-progress";

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

type View = "cycle" | "suivi" | "analyse";

interface Segment {
  id: string;
  label: string;
  days: number;
  color: string;
  current?: boolean;
  striped?: boolean;
  detail?: string;
}

interface EventItem {
  label: string;
  date: Date;
  color: string;
}

const OPEN_CYCLE_SCALE_DAYS = 365;
const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const STAGE_COLORS = {
  service: "#d946ef",
  waiting: "#94a3b8",
  scan: "#facc15",
  pregnant: "#22c55e",
  imminent: VELAGE_IMMINENT_COLORS.hex,
  rest: "#38bdf8",
  delay: "#ef4444",
  future: "#f1f5f9",
} as const;

function elapsedDays(from: Date, to: Date) {
  return Math.max(0, differenceInCalendarDays(to, from));
}

function addSegment(segments: Segment[], segment: Segment) {
  if (segment.days > 0) segments.push(segment);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function pluralDays(days: number) {
  return `${days} ${days === 1 ? "jour" : "jours"}`;
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
  const [view, setView] = useState<View>("cycle");

  const model = useMemo(() => {
    const today = new Date();
    const segments: Segment[] = [];
    const events: EventItem[] = [];
    const daysSinceBreeding = breedingDate ? elapsedDays(breedingDate, today) : null;
    const daysSinceCalving = lastCalvingDate ? elapsedDays(lastCalvingDate, today) : null;
    const calvingIsLatest = Boolean(lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate));
    const isPostCalvingDelay =
      status === "ROUGE" &&
      calvingIsLatest &&
      daysSinceCalving !== null &&
      daysSinceCalving > POST_CALVING_REST_DAYS;
    const isEmptyAfterEcho =
      status === "ROUGE" &&
      !calvingIsLatest &&
      (echoResult === "VIDE" || Boolean(echoDate));
    const gestation =
      status === "VERT" || status === "ROSE"
        ? getGestationProgress(breedingDate, dueDate, today)
        : null;

    let title = "Cycle à renseigner";
    let main = "Aucune étape connue";
    let secondary = "Ajoutez un événement de reproduction pour démarrer le suivi.";
    let tone = "text-slate-700";
    let horizonDays = OPEN_CYCLE_SCALE_DAYS;

    if (lastCalvingDate) {
      events.push({ label: "Dernier vêlage", date: lastCalvingDate, color: STAGE_COLORS.rest });
    }
    if (breedingDate) {
      events.push({
        label: breedingType === "IA" ? "Insémination artificielle" : "Saillie",
        date: breedingDate,
        color: STAGE_COLORS.service,
      });
    }
    if (echoDate) {
      events.push({ label: "Échographie", date: echoDate, color: STAGE_COLORS.scan });
    }
    if (dueDate) {
      events.push({ label: "Vêlage prévu", date: dueDate, color: STAGE_COLORS.imminent });
    }

    if ((status === "REPOS" || isPostCalvingDelay) && lastCalvingDate && daysSinceCalving !== null) {
      const restDays = Math.min(daysSinceCalving, POST_CALVING_REST_DAYS);
      addSegment(segments, {
        id: "repos",
        label: "Repos post-vêlage",
        days: restDays || 1,
        color: STAGE_COLORS.rest,
        current: status === "REPOS",
        detail: `Depuis le ${formatDate(lastCalvingDate)}`,
      });

      if (isPostCalvingDelay) {
        const delayDays = daysSinceCalving - POST_CALVING_REST_DAYS;
        addSegment(segments, {
          id: "retard",
          label: "Retard",
          days: delayDays,
          color: STAGE_COLORS.delay,
          current: true,
          striped: true,
          detail: `Remise à la reproduction attendue depuis ${pluralDays(delayDays)}`,
        });
        title = "Retard";
        main = pluralDays(delayDays);
        secondary = "Retard de remise à la reproduction";
        tone = "text-red-700";
      } else {
        title = "Repos post-vêlage";
        main = pluralDays(daysSinceCalving);
        secondary = `Vêlage le ${formatDate(lastCalvingDate)}`;
        tone = "text-sky-700";
      }
    } else if (breedingDate && daysSinceBreeding !== null) {
      const expectedEchoDate = addDays(breedingDate, ECHOGRAPHY_WAIT_DAYS);
      const effectiveEchoDate = echoDate && echoDate >= breedingDate ? echoDate : null;
      const waitingEnd =
        effectiveEchoDate && effectiveEchoDate < expectedEchoDate ? effectiveEchoDate : expectedEchoDate;
      const waitingDays = elapsedDays(breedingDate, waitingEnd > today ? today : waitingEnd);

      addSegment(segments, {
        id: "attente",
        label: "Attente avant écho",
        days: waitingDays || (daysSinceBreeding === 0 ? 1 : 0),
        color: STAGE_COLORS.waiting,
        current: status === "GRIS",
        detail: `Échographie possible à partir du ${formatDate(expectedEchoDate)}`,
      });

      const echoWaitingEnd = effectiveEchoDate ?? today;
      const echoWaitingDays =
        echoWaitingEnd > expectedEchoDate ? elapsedDays(expectedEchoDate, echoWaitingEnd) : 0;
      addSegment(segments, {
        id: "echo-wait",
        label: "À échographier",
        days: echoWaitingDays || (status === "JAUNE" ? 1 : 0),
        color: STAGE_COLORS.scan,
        current: status === "JAUNE",
        detail: `Échographie possible depuis le ${formatDate(expectedEchoDate)}`,
      });

      if (isEmptyAfterEcho) {
        const emptySince = effectiveEchoDate ?? statusModifiedAt ?? breedingDate;
        const availableDays = elapsedDays(emptySince, today);
        addSegment(segments, {
          id: "a-remettre",
          label: "À remettre à la reproduction",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
          detail: `Disponible depuis le ${formatDate(emptySince)}`,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = effectiveEchoDate ? `Échographie le ${formatDate(effectiveEchoDate)}` : "Cycle ouvert";
        tone = "text-fuchsia-700";
      } else if ((status === "VERT" || status === "ROSE") && gestation) {
        const confirmedAt = effectiveEchoDate ?? expectedEchoDate;
        const calculatedDueDate = dueDate ?? addDays(breedingDate, GESTATION_REFERENCE_DAYS);
        const imminentAt = subDays(calculatedDueDate, VELAGE_IMMINENT_DAYS);
        const gestationEnd = today < imminentAt ? today : imminentAt;

        addSegment(segments, {
          id: "gestante",
          label: "Gestante",
          days: Math.max(status === "VERT" ? 1 : 0, elapsedDays(confirmedAt, gestationEnd)),
          color: STAGE_COLORS.pregnant,
          current: status === "VERT",
          detail: `Vêlage prévu le ${formatDate(calculatedDueDate)}`,
        });

        if (status === "ROSE") {
          const imminentEnd = today < calculatedDueDate ? today : calculatedDueDate;
          addSegment(segments, {
            id: "imminent",
            label: "Vêlage imminent",
            days: Math.max(1, elapsedDays(imminentAt, imminentEnd)),
            color: STAGE_COLORS.imminent,
            current: gestation.remainingDays >= 0,
            detail: `Vêlage prévu le ${formatDate(calculatedDueDate)}`,
          });
          if (gestation.remainingDays < 0) {
            addSegment(segments, {
              id: "terme-depasse",
              label: "Terme dépassé",
              days: Math.abs(gestation.remainingDays),
              color: STAGE_COLORS.delay,
              current: true,
              striped: true,
            });
          }
        }

        horizonDays = Math.max(1, elapsedDays(breedingDate, calculatedDueDate));
        if (status === "ROSE") {
          title = gestation.remainingDays < 0 ? "Terme dépassé" : "Vêlage imminent";
          main =
            gestation.remainingDays < 0
              ? `De ${pluralDays(Math.abs(gestation.remainingDays))}`
              : `J-${gestation.remainingDays}`;
          secondary = `Vêlage prévu le ${formatDate(calculatedDueDate)}`;
          tone = gestation.remainingDays < 0 ? "text-red-700" : "text-orange-700";
        } else {
          title = "Gestante";
          main = formatGestationElapsed(gestation.elapsedDays);
          secondary =
            gestation.remainingDays >= 0 && gestation.remainingDays <= 60
              ? `J-${gestation.remainingDays} · Vêlage le ${formatDate(calculatedDueDate)}`
              : `Vêlage prévu le ${formatDate(calculatedDueDate)}`;
          tone = "text-green-700";
        }
      } else if (status === "JAUNE") {
        const waitingForEchoDays = Math.max(0, daysSinceBreeding - ECHOGRAPHY_WAIT_DAYS);
        title = "À échographier";
        main = waitingForEchoDays === 0 ? "Dès aujourd’hui" : `Depuis ${pluralDays(waitingForEchoDays)}`;
        secondary = `Saillie / IA le ${formatDate(breedingDate)}`;
        tone = "text-amber-700";
      } else if (status === "GRIS") {
        const remaining = Math.max(0, ECHOGRAPHY_WAIT_DAYS - daysSinceBreeding);
        title = "Attente avant écho";
        main = remaining === 0 ? "Échographie possible" : `Encore ${pluralDays(remaining)}`;
        secondary = `${breedingType === "IA" ? "IA" : "Saillie"} le ${formatDate(breedingDate)}`;
        tone = "text-slate-700";
      } else if (status === "ROUGE") {
        const availableSince = statusModifiedAt ?? breedingDate;
        const availableDays = elapsedDays(availableSince, today);
        addSegment(segments, {
          id: "a-remettre",
          label: "À remettre à la reproduction",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = "Animal disponible";
        tone = "text-fuchsia-700";
      }
    } else if (status === "ROUGE") {
      title = "À remettre à la reproduction";
      main = "Disponible";
      secondary = "Aucune date de saillie enregistrée";
      tone = "text-fuchsia-700";
    }

    const trackedDays = segments.reduce((total, segment) => total + segment.days, 0);
    const scaleDays = Math.max(horizonDays, trackedDays, 1);
    const futureDays = Math.max(0, scaleDays - trackedDays);

    return {
      segments,
      events: events.sort((a, b) => b.date.getTime() - a.date.getTime()),
      title,
      main,
      secondary,
      tone,
      scaleDays,
      futureDays,
      trackedDays,
      gestation,
    };
  }, [status, breedingDate, breedingType, dueDate, echoDate, echoResult, lastCalvingDate, statusModifiedAt]);

  const activeStage =
    status === "GRIS" ? "waiting"
      : status === "JAUNE" ? "scan"
      : status === "VERT" ? "pregnant"
      : status === "ROSE" && model.gestation?.remainingDays && model.gestation.remainingDays < 0 ? "delay"
      : status === "ROSE" ? "imminent"
      : status === "REPOS" ? "rest"
      : "delay";

  const activeColor = STAGE_COLORS[activeStage];
  const progressRatio = Math.min(1, Math.max(0, model.trackedDays / model.scaleDays));
  const markerAngle = progressRatio * 360 - 90;
  const markerPosition = {
    left: `${50 + 38.3 * Math.cos(markerAngle * Math.PI / 180)}%`,
    top: `${50 + 38.3 * Math.sin(markerAngle * Math.PI / 180)}%`,
  };

  const today = new Date();
  const projectedCalvingDate =
    dueDate ?? (breedingDate ? addDays(breedingDate, GESTATION_REFERENCE_DAYS) : null);
  const knownCycleEnd =
    projectedCalvingDate && projectedCalvingDate > today ? projectedCalvingDate : today;
  const measuredCycleDays =
    lastCalvingDate && knownCycleEnd > lastCalvingDate
      ? elapsedDays(lastCalvingDate, knownCycleEnd)
      : 365;
  const cycleDays = Math.max(365, measuredCycleDays);
  let ringOffset = 0;
  const elapsedRing = model.segments.map((segment) => {
    const slot = (segment.days / model.scaleDays) * RING_CIRCUMFERENCE;
    const item = { ...segment, length: Math.max(2, slot - 3), offset: ringOffset };
    ringOffset += slot;
    return item;
  });

  const eventStart = lastCalvingDate ?? breedingDate ?? today;
  const eventEnd = projectedCalvingDate && projectedCalvingDate > eventStart
    ? projectedCalvingDate
    : addDays(eventStart, model.scaleDays);
  const eventSpan = Math.max(1, elapsedDays(eventStart, eventEnd));
  const ringEvents = model.events
    .filter((event) => event.date >= eventStart && event.date <= eventEnd)
    .map((event) => {
      const ratio = Math.min(1, Math.max(0, elapsedDays(eventStart, event.date) / eventSpan));
      const angle = ratio * 360 - 90;
      const isEcho = event.label.includes("chographie");
      const isService = event.label.includes("Saillie") || event.label.includes("Insémination");
      return {
        ...event,
        Icon: isEcho ? Check : isService ? Syringe : HeartPulse,
        position: {
          left: `${50 + 47 * Math.cos(angle * Math.PI / 180)}%`,
          top: `${50 + 47 * Math.sin(angle * Math.PI / 180)}%`,
        },
      };
    });

  const nav = [
    { id: "cycle" as const, label: "Cycle", icon: RefreshCw },
    { id: "suivi" as const, label: "Suivi", icon: List },
    { id: "analyse" as const, label: "Analyse", icon: BarChart3 },
  ];

  return (
    <section
      className="mt-3 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label={`Cycle reproductif : ${model.title}, ${model.main}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Reproduction</p>
          <h3 className="text-base font-bold text-slate-900">Cycle reproductif</h3>
        </div>
        <span className={`rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold ${model.tone}`}>
          {model.title}
        </span>
      </div>

      <div className="px-3 py-4 sm:px-5">
        {view === "cycle" && (
          <div className="mx-auto max-w-[660px]">
            <div className="relative mx-auto my-3 aspect-square w-[min(88vw,390px)] sm:w-[430px]">
              <svg
                viewBox="0 0 200 200"
                className="-rotate-90 h-full w-full overflow-visible"
                role="img"
                aria-label={`${model.title} : ${model.main}`}
              >
                <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke={STAGE_COLORS.future} strokeWidth="15" />
                <circle cx="100" cy="100" r="79" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                <g>
                  {elapsedRing.map((stage) => {
                    return (
                      <circle
                        key={stage.id}
                        cx="100"
                        cy="100"
                        r={RING_RADIUS}
                        fill="none"
                        stroke={stage.color}
                        strokeWidth={stage.current ? 17 : 15}
                        strokeLinecap="round"
                        strokeDasharray={`${stage.length} ${RING_CIRCUMFERENCE - stage.length}`}
                        strokeDashoffset={-stage.offset}
                        className="transition-all duration-500"
                      >
                        <title>{stage.label} · {pluralDays(stage.days)}</title>
                      </circle>
                    );
                  })}
                </g>
              </svg>

              {ringEvents.map((event) => {
                const Icon = event.Icon;
                return (
                  <div key={`${event.label}-${event.date.toISOString()}`} className="group absolute z-20 -translate-x-1/2 -translate-y-1/2" style={event.position}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm" style={{ borderColor: event.color, color: event.color }} title={`${event.label} · ${formatDate(event.date)}`}>
                      <Icon size={15} strokeWidth={2.5} />
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-9 hidden w-max max-w-36 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
                      {event.label} · {formatDate(event.date)}
                    </span>
                  </div>
                );
              })}

              <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2" style={markerPosition}>
                <span className="flex min-h-10 min-w-10 items-center justify-center rounded-full border-[3px] bg-white px-2 text-[11px] font-extrabold shadow-md" style={{ borderColor: activeColor, color: activeColor }}>
                  J+{model.trackedDays}
                </span>
              </div>

              <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-white px-4 text-center shadow-[inset_0_0_0_1px_#f1f5f9]">
                <span className="text-[10px] font-medium text-slate-400 sm:text-xs">Aujourd’hui</span>
                <span className={`mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] sm:text-sm ${model.tone}`}>
                  {model.title}
                </span>
                <strong className="mt-1 text-lg leading-tight text-slate-900 sm:text-2xl">{model.main}</strong>
                {model.gestation && (
                  <>
                    <span className="my-2 h-px w-3/5 bg-slate-200" />
                    <span className="text-[10px] text-slate-500 sm:text-xs">Vêlage prévu dans</span>
                    <strong className="mt-0.5 text-sm text-emerald-800 sm:text-lg">
                      {model.gestation.remainingDays < 0
                        ? `Terme dépassé de ${pluralDays(Math.abs(model.gestation.remainingDays))}`
                        : formatGestationElapsed(model.gestation.remainingDays)}
                    </strong>
                  </>
                )}
                <span className="mt-1 line-clamp-2 max-w-[90%] text-[9px] leading-snug text-slate-500 sm:text-[11px]">
                  {model.secondary}
                </span>
              </div>
            </div>
            <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500 sm:text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeColor }} />
              <span>{Math.round(progressRatio * 100)} % du cycle visualisé</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>{cycleDays} jours estimés</span>
            </div>
          </div>
        )}

        {view === "suivi" && (
          <div className="mx-auto max-w-lg">
            {model.events.length > 0 ? (
              <ol className="space-y-1">
                {model.events.map((event, index) => (
                  <li key={`${event.label}-${event.date.toISOString()}`} className="grid grid-cols-[28px_1fr] gap-2">
                    <div className="flex flex-col items-center">
                      <span className="mt-3 h-3 w-3 rounded-full ring-4 ring-white" style={{ backgroundColor: event.color }} />
                      {index < model.events.length - 1 && <span className="h-full w-px bg-slate-200" />}
                    </div>
                    <div className="mb-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm font-bold text-slate-800">{event.label}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays size={13} /> {formatDate(event.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aucun événement de reproduction enregistré.
              </p>
            )}
          </div>
        )}

        {view === "analyse" && (
          <div className="mx-auto max-w-lg">
            {model.gestation ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Avancement estimé</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{formatGestationElapsed(model.gestation.elapsedDays)}</p>
                  </div>
                  <p className="text-sm font-bold text-green-700">
                    {Math.round(model.gestation.percentage / 100 * 100)} %
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${Math.min(100, Math.max(0, model.gestation.percentage / 100 * 100))}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aucun indicateur existant n’est disponible pour ce cycle.
              </p>
            )}
          </div>
        )}
      </div>

      <nav className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/80 p-1.5" aria-label="Vues du cycle reproductif">
        {nav.map((item) => {
          const Icon = item.icon;
          const selected = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-pressed={selected}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition ${selected ? "bg-white text-green-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

