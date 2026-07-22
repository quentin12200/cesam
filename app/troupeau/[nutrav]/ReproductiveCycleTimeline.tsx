"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import { BarChart3, CalendarDays, List, RefreshCw, Syringe } from "lucide-react";
import {
  ECHOGRAPHY_WAIT_DAYS,
  POST_CALVING_REST_DAYS,
  REPRODUCTIVE_CYCLE_COLORS,
  VELAGE_IMMINENT_DAYS,
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
  echoObservation: string | null;
  lastCalvingDate: Date | null;
  calfNumber: string | null;
  calfSex: string | null;
  breedingReference: string | null;
  statusModifiedAt: Date | null;
}

type View = "cycle" | "suivi" | "analyse";

interface Segment {
  id: string;
  label: string;
  shortLabel?: string;
  days: number;
  color: string;
  current?: boolean;
  striped?: boolean;
  detail?: string;
}

interface EventItem {
  id: string;
  kind: "calving" | "natural" | "ia" | "echo-positive" | "echo-negative";
  label: string;
  date: Date;
  color: string;
  details: string[];
  transition: string;
}

const OPEN_CYCLE_SCALE_DAYS = 365;
const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const STAGE_COLORS = REPRODUCTIVE_CYCLE_COLORS;

function CalvingEventIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20.2 4.3 13A5.1 5.1 0 0 1 11.9 6.2 5.1 5.1 0 0 1 19.7 13Z" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 10.2 6.5 8.7M15.8 10.2l1.7-1.5M8.2 10.4c0-2.1 1.7-3.6 3.8-3.6s3.8 1.5 3.8 3.6v2.2c0 2-1.7 3.6-3.8 3.6s-3.8-1.6-3.8-3.6Z" fill="white" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="10.5" cy="11.5" r=".65" fill="currentColor" /><circle cx="13.5" cy="11.5" r=".65" fill="currentColor" />
      <path d="M10.5 14h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function NaturalServiceIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="9" r="4" /><path d="M6.2 11.8 3 15m0-3v3h3" />
      <circle cx="15" cy="15" r="4" /><path d="m17.8 12.2 3.2-3.2m-3 0h3v3" />
    </svg>
  );
}

function UltrasoundEventIcon({ positive, size = 26 }: { positive: boolean; size?: number }) {
  const accent = positive ? "#16a34a" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="23" height="17" rx="3" fill="#f8fafc" stroke="currentColor" strokeWidth="2" />
      <path d="M10 24h8M14 21v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {positive ? <path d="m7.5 12.5 4 4 9-9" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : <path d="m8.5 8.5 11 9m0-9-11 9" stroke={accent} strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}

function EventIcon({ kind }: { kind: EventItem["kind"] }) {
  if (kind === "calving") return <CalvingEventIcon size={25} />;
  if (kind === "natural") return <NaturalServiceIcon size={24} />;
  if (kind === "ia") return <Syringe size={23} strokeWidth={2.3} />;
  return <UltrasoundEventIcon positive={kind === "echo-positive"} />;
}

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

function softenColor(hex: string, amount = 0.66) {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const mix = (value: number) => Math.round(value + (255 - value) * amount);
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

function calfSexLabel(sex: string | null) {
  if (sex === "F") return "Femelle";
  if (sex === "M") return "Mâle";
  return null;
}

export default function ReproductiveCycleTimeline({
  status,
  breedingDate,
  breedingType,
  dueDate,
  echoDate,
  echoResult,
  echoObservation,
  lastCalvingDate,
  calfNumber,
  calfSex,
  breedingReference,
  statusModifiedAt,
}: Props) {
  const [view, setView] = useState<View>("cycle");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
    let usefulDate: string | null = null;
    let tone = "text-slate-700";
    let horizonDays = OPEN_CYCLE_SCALE_DAYS;

    if (lastCalvingDate) {
      events.push({
        id: "calving",
        kind: "calving",
        label: "Vêlage",
        date: lastCalvingDate,
        color: calfSex === "M"
          ? STAGE_COLORS.maleCalf
          : calfSex === "F"
            ? STAGE_COLORS.femaleCalf
            : STAGE_COLORS.unknownCalf,
        details: [
          ...(calfNumber ? [`Veau n° ${calfNumber}`] : []),
          ...(calfSexLabel(calfSex) ? [`Sexe : ${calfSexLabel(calfSex)}`] : []),
        ],
        transition: "Début du repos",
      });
    }
    if (breedingDate) {
      const isIa = breedingType === "IA";
      events.push({
        id: "breeding",
        kind: isIa ? "ia" : "natural",
        label: isIa ? "Insémination artificielle" : "Saillie naturelle",
        date: breedingDate,
        color: STAGE_COLORS.service,
        details: breedingReference
          ? [`${isIa ? "Référence IA" : "Taureau"} : ${breedingReference}`]
          : [],
        transition: isIa ? "Début du repos post-IA" : "Début du repos post-saillie",
      });
    }
    if (echoDate) {
      const positive = echoResult === "PLEINE";
      events.push({
        id: "echo",
        kind: positive ? "echo-positive" : "echo-negative",
        label: "Échographie",
        date: echoDate,
        color: positive ? STAGE_COLORS.pregnant : STAGE_COLORS.delay,
        details: [
          `Résultat : ${positive ? "positive" : echoResult === "VIDE" ? "négative" : echoResult ?? "non renseigné"}`,
          ...(echoObservation ? [echoObservation] : []),
        ],
        transition: positive ? "Début de la gestation" : "Retour en retard",
      });
    }

    if ((status === "REPOS" || isPostCalvingDelay) && lastCalvingDate && daysSinceCalving !== null) {
      const restDays = Math.min(daysSinceCalving, POST_CALVING_REST_DAYS);
      addSegment(segments, {
        id: "repos",
        label: "Repos",
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
        usefulDate = formatDate(addDays(lastCalvingDate, POST_CALVING_REST_DAYS));
        tone = "text-red-700";
      } else {
        title = "Repos post-vêlage";
        main = pluralDays(daysSinceCalving);
        secondary = `Vêlage le ${formatDate(lastCalvingDate)}`;
        usefulDate = formatDate(lastCalvingDate);
        tone = "text-sky-700";
      }
    } else if (breedingDate && daysSinceBreeding !== null) {
      const expectedEchoDate = addDays(breedingDate, ECHOGRAPHY_WAIT_DAYS);
      const effectiveEchoDate = echoDate && echoDate >= breedingDate ? echoDate : null;
      const negativeSince = isEmptyAfterEcho ? effectiveEchoDate ?? statusModifiedAt ?? breedingDate : null;
      const gestationConfirmedAt =
        (status === "VERT" || status === "ROSE")
          ? effectiveEchoDate ?? (statusModifiedAt && statusModifiedAt >= breedingDate ? statusModifiedAt : null) ?? expectedEchoDate
          : null;
      const conclusionDate = gestationConfirmedAt ?? negativeSince;

      if (lastCalvingDate && lastCalvingDate < breedingDate) {
        addSegment(segments, {
          id: "repos-post-velage",
          label: "Repos",
          days: elapsedDays(lastCalvingDate, breedingDate),
          color: STAGE_COLORS.rest,
          detail: `Du vêlage au ${breedingType === "IA" ? "début IA" : "début saillie"}`,
        });
      }

      const waitingEnd =
        conclusionDate && conclusionDate < expectedEchoDate
          ? conclusionDate
          : today < expectedEchoDate && !conclusionDate
            ? today
            : expectedEchoDate;
      const waitingDays = elapsedDays(breedingDate, waitingEnd);

      addSegment(segments, {
        id: "attente",
        label: "Attente",
        days: waitingDays || (daysSinceBreeding === 0 ? 1 : 0),
        color: STAGE_COLORS.waiting,
        current: status === "GRIS",
        detail: `Attente post-${breedingType === "IA" ? "IA" : "saillie"} jusqu’au ${formatDate(expectedEchoDate)}`,
      });

      const echoWaitingEnd = conclusionDate
        ? conclusionDate > expectedEchoDate ? conclusionDate : expectedEchoDate
        : today;
      const echoWaitingDays =
        echoWaitingEnd > expectedEchoDate ? elapsedDays(expectedEchoDate, echoWaitingEnd) : 0;
      addSegment(segments, {
        id: "echo-wait",
        label: "À échographier",
        shortLabel: "Écho",
        days: echoWaitingDays || (status === "JAUNE" ? 1 : 0),
        color: STAGE_COLORS.scan,
        current: status === "JAUNE",
        detail: `Échographie possible depuis le ${formatDate(expectedEchoDate)}`,
      });

      if (isEmptyAfterEcho) {
        const emptySince = negativeSince ?? breedingDate;
        const availableDays = elapsedDays(emptySince, today);
        addSegment(segments, {
          id: "a-remettre",
          label: "À remettre",
          shortLabel: "Repro",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
          detail: `Disponible depuis le ${formatDate(emptySince)}`,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = effectiveEchoDate ? `Échographie le ${formatDate(effectiveEchoDate)}` : "Cycle ouvert";
        usefulDate = formatDate(emptySince);
        tone = "text-fuchsia-700";
      } else if ((status === "VERT" || status === "ROSE") && gestation) {
        const confirmedAt = gestationConfirmedAt ?? expectedEchoDate;
        const calculatedDueDate = dueDate ?? addDays(breedingDate, GESTATION_REFERENCE_DAYS);
        const imminentAt = subDays(calculatedDueDate, VELAGE_IMMINENT_DAYS);
        const gestationEnd = today < imminentAt ? today : imminentAt;

        addSegment(segments, {
          id: "gestante",
          label: "Gestation",
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
            shortLabel: "Imminent",
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

        horizonDays = Math.max(
          1,
          lastCalvingDate && lastCalvingDate < calculatedDueDate
            ? elapsedDays(lastCalvingDate, calculatedDueDate)
            : elapsedDays(breedingDate, calculatedDueDate)
        );
        if (status === "ROSE") {
          title = gestation.remainingDays < 0 ? "Terme dépassé" : "Vêlage imminent";
          main =
            gestation.remainingDays < 0
              ? `De ${pluralDays(Math.abs(gestation.remainingDays))}`
              : `J-${gestation.remainingDays}`;
          secondary =
            gestation.remainingDays < 0
              ? `Vêlage prévu dépassé de ${pluralDays(Math.abs(gestation.remainingDays))}`
              : `Vêlage prévu dans ${pluralDays(gestation.remainingDays)}`;
          usefulDate = formatDate(calculatedDueDate);
          tone = gestation.remainingDays < 0 ? "text-red-700" : "text-orange-700";
        } else {
          title = "Gestante";
          main = formatGestationElapsed(gestation.elapsedDays);
          secondary =
            gestation.remainingDays >= 0 && gestation.remainingDays <= 60
              ? `Vêlage prévu dans ${pluralDays(gestation.remainingDays)}`
              : `Vêlage prévu le ${formatDate(calculatedDueDate)}`;
          usefulDate = formatDate(calculatedDueDate);
          tone = "text-green-700";
        }
      } else if (status === "JAUNE") {
        const waitingForEchoDays = Math.max(0, daysSinceBreeding - ECHOGRAPHY_WAIT_DAYS);
        title = "À échographier";
        main = waitingForEchoDays === 0 ? "Dès aujourd’hui" : `Depuis ${pluralDays(waitingForEchoDays)}`;
        secondary = `Saillie / IA le ${formatDate(breedingDate)}`;
        usefulDate = formatDate(expectedEchoDate);
        tone = "text-amber-700";
      } else if (status === "GRIS") {
        const remaining = Math.max(0, ECHOGRAPHY_WAIT_DAYS - daysSinceBreeding);
        title = `Repos post-${breedingType === "IA" ? "IA" : "saillie"}`;
        main = remaining === 0 ? "Échographie possible" : `Encore ${pluralDays(remaining)}`;
        secondary = `À échographier à partir de J+${ECHOGRAPHY_WAIT_DAYS}`;
        usefulDate = formatDate(expectedEchoDate);
        tone = "text-slate-700";
      } else if (status === "ROUGE") {
        const availableSince = statusModifiedAt ?? breedingDate;
        const availableDays = elapsedDays(availableSince, today);
        addSegment(segments, {
          id: "a-remettre",
          label: "À remettre",
          shortLabel: "Repro",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = "Animal disponible";
        usefulDate = formatDate(availableSince);
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
      usefulDate,
      tone,
      scaleDays,
      futureDays,
      trackedDays,
      gestation,
    };
  }, [status, breedingDate, breedingType, breedingReference, calfNumber, calfSex, dueDate, echoDate, echoObservation, echoResult, lastCalvingDate, statusModifiedAt]);

  const activeStage =
    status === "GRIS" ? "waiting"
      : status === "JAUNE" ? "scan"
      : status === "VERT" ? "pregnant"
      : status === "ROSE" && model.gestation?.remainingDays && model.gestation.remainingDays < 0 ? "delay"
      : status === "ROSE" ? "imminent"
      : status === "REPOS" ? "rest"
      : "delay";

  const activeSegment = model.segments.find((segment) => segment.current);
  const activeColor = activeSegment?.color ?? (status === "ROUGE" ? STAGE_COLORS.service : STAGE_COLORS[activeStage]);
  const progressRatio = Math.min(1, Math.max(0, model.trackedDays / model.scaleDays));
  const markerAngle = progressRatio * 360 - 90;
  const markerPosition = {
    left: `${50 + 34.5 * Math.cos(markerAngle * Math.PI / 180)}%`,
    top: `${50 + 34.5 * Math.sin(markerAngle * Math.PI / 180)}%`,
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
    const startRatio = ringOffset / RING_CIRCUMFERENCE;
    const item = {
      ...segment,
      length: Math.max(2, slot - 3),
      offset: ringOffset,
      midAngle: (startRatio + segment.days / model.scaleDays / 2) * 360 - 90,
      displayColor: segment.current ? segment.color : softenColor(segment.color),
    };
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
      return {
        ...event,
        position: {
          left: `${50 + 48 * Math.cos(angle * Math.PI / 180)}%`,
          top: `${50 + 48 * Math.sin(angle * Math.PI / 180)}%`,
        },
      };
    });
  const selectedEvent = ringEvents.find((event) => event.id === selectedEventId) ?? null;
  const markerText =
    model.gestation && (status === "VERT" || status === "ROSE")
      ? model.gestation.remainingDays >= 0
        ? `J-${model.gestation.remainingDays}`
        : `J+${Math.abs(model.gestation.remainingDays)}`
      : `J+${model.trackedDays}`;

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
                className="h-full w-full overflow-visible"
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
                        stroke={stage.displayColor}
                        strokeWidth={stage.current ? 17 : 13}
                        strokeLinecap="round"
                        strokeDasharray={`${stage.length} ${RING_CIRCUMFERENCE - stage.length}`}
                        strokeDashoffset={-stage.offset}
                        transform="rotate(-90 100 100)"
                        className="transition-all duration-500"
                      >
                        <title>{stage.label} · {pluralDays(stage.days)}</title>
                      </circle>
                    );
                  })}
                </g>
                <g aria-hidden="true">
                  {elapsedRing.map((stage) => {
                    const segmentRatio = stage.days / model.scaleDays;
                    const isShort = segmentRatio < 0.075;
                    const radians = stage.midAngle * Math.PI / 180;
                    const labelRadius = isShort ? 111 : RING_RADIUS;
                    const x = 100 + labelRadius * Math.cos(radians);
                    const y = 100 + labelRadius * Math.sin(radians);
                    let rotation = stage.midAngle + 90;
                    if (rotation > 90 && rotation < 270) rotation += 180;
                    return (
                      <text
                        key={`${stage.id}-label`}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={isShort ? undefined : `rotate(${rotation} ${x} ${y})`}
                        className="font-extrabold tracking-wide [paint-order:stroke] [stroke-width:2px]"
                        style={{
                          fill: stage.current ? "#ffffff" : "#475569",
                          stroke: stage.current ? stage.color : "#ffffff",
                          fontSize: isShort ? "4.8px" : "5.6px",
                        }}
                      >
                        {isShort ? stage.shortLabel ?? stage.label : stage.shortLabel ?? stage.label}
                      </text>
                    );
                  })}
                </g>
              </svg>

              {ringEvents.map((event) => {
                const selected = selectedEventId === event.id;
                return (
                  <div key={`${event.label}-${event.date.toISOString()}`} className={`group absolute -translate-x-1/2 -translate-y-1/2 ${selected ? "z-40" : "z-20"}`} style={event.position}>
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                      aria-expanded={selected}
                      aria-label={`${event.label}, ${formatDate(event.date)}. Afficher les détails`}
                      className={`flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 ${selected ? "scale-110 border-[4px] shadow-lg ring-4 ring-white" : "border-[3px]"}`}
                      style={{ borderColor: event.color, color: event.color }}
                      title={`${event.label} · ${formatDate(event.date)}`}
                    >
                      <EventIcon kind={event.kind} />
                    </button>
                    {event.kind === "calving" && (
                      <span className="pointer-events-none absolute left-1/2 top-[-1.25rem] w-max -translate-x-1/2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
                        Début du cycle
                      </span>
                    )}
                    <span className="pointer-events-none absolute left-1/2 top-12 hidden w-max max-w-40 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-center text-[10px] font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
                      {event.label} · {formatDate(event.date)}
                    </span>
                  </div>
                );
              })}

              <div className="absolute z-30 -translate-x-1/2 -translate-y-1/2" style={markerPosition}>
                <span className="flex min-h-10 min-w-10 items-center justify-center rounded-full border-[3px] bg-white px-2 text-[11px] font-extrabold shadow-md" style={{ borderColor: activeColor, color: activeColor }}>
                  {markerText}
                </span>
              </div>

              <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-white px-4 text-center shadow-[inset_0_0_0_1px_#f1f5f9]">
                {selectedEvent ? (
                  <>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">Événement</span>
                    <span className="mt-1" style={{ color: selectedEvent.color }}><EventIcon kind={selectedEvent.kind} /></span>
                    <strong className="mt-1 text-sm leading-tight text-slate-900 sm:text-lg">{selectedEvent.label}</strong>
                    <span className="mt-0.5 text-[11px] font-bold text-slate-700 sm:text-xs">{formatDate(selectedEvent.date)}</span>
                    {selectedEvent.details.map((detail) => (
                      <span key={detail} className="mt-0.5 line-clamp-1 max-w-[92%] text-[9px] leading-snug text-slate-500 sm:text-[11px]">
                        {detail}
                      </span>
                    ))}
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]" style={{ color: selectedEvent.color }}>
                      {selectedEvent.transition}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-medium text-slate-400 sm:text-xs">Aujourd’hui</span>
                    <span className={`mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] sm:text-sm ${model.tone}`}>
                      {model.title}
                    </span>
                    <strong className="mt-1 text-lg leading-tight text-slate-900 sm:text-2xl">{model.main}</strong>
                    <span className="mt-2 line-clamp-2 max-w-[90%] text-[9px] leading-snug text-slate-500 sm:text-[11px]">
                      {model.secondary}
                    </span>
                    {model.usefulDate && (
                      <span className="mt-1 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                        {model.usefulDate}
                      </span>
                    )}
                  </>
                )}
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
