"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, differenceInCalendarDays, subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock3, Syringe } from "lucide-react";
import {
  ECHOGRAPHY_WAIT_DAYS,
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
  calfBirthDate: Date | null;
  calfSevreDone: boolean;
  breedingReference: string | null;
  statusModifiedAt: Date | null;
  restObjectiveDays: number;
  dryOffCalfAgeMonths: number;
  dryOffDone: boolean;
  dryOffDate: Date | null;
}

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

interface OverlaySegment extends Segment {
  startDays: number;
}

interface CycleAlert {
  id: "repro-delay" | "dry-off";
  title: string;
  lines: string[];
  action: string;
  color: string;
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
const RING_RADIUS = 78;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAIN_RING_WIDTH = 18;
const ACTIVE_RING_WIDTH = 20;
const PAST_RING_WIDTH = 17;
const ECHO_OVERLAY_RADIUS = 91;
const ECHO_OVERLAY_CIRCUMFERENCE = 2 * Math.PI * ECHO_OVERLAY_RADIUS;
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
  if (kind === "calving") return <CalvingEventIcon size={21} />;
  if (kind === "natural") return <NaturalServiceIcon size={20} />;
  if (kind === "ia") return <Syringe size={20} strokeWidth={2.2} />;
  return <UltrasoundEventIcon positive={kind === "echo-positive"} size={22} />;
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
  calfBirthDate,
  calfSevreDone,
  breedingReference,
  statusModifiedAt,
  restObjectiveDays,
  dryOffCalfAgeMonths,
  dryOffDone,
  dryOffDate,
}: Props) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const model = useMemo(() => {
    const today = new Date();
    const segments: Segment[] = [];
    const overlaySegments: OverlaySegment[] = [];
    const events: EventItem[] = [];
    const alerts: CycleAlert[] = [];
    const safeRestObjectiveDays = Math.max(1, restObjectiveDays);
    const daysSinceBreeding = breedingDate ? elapsedDays(breedingDate, today) : null;
    const daysSinceCalving = lastCalvingDate ? elapsedDays(lastCalvingDate, today) : null;
    const calvingIsLatest = Boolean(lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate));
    const isPostCalvingDelay =
      status === "ROUGE" &&
      calvingIsLatest &&
      daysSinceCalving !== null &&
      daysSinceCalving > safeRestObjectiveDays;
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

    if (lastCalvingDate && daysSinceCalving !== null && calvingIsLatest && daysSinceCalving > safeRestObjectiveDays && !breedingDate) {
      const delayDays = daysSinceCalving - safeRestObjectiveDays;
      alerts.push({
        id: "repro-delay",
        title: "RETARD REPRO",
        lines: [
          `Repos réel : ${pluralDays(daysSinceCalving)}`,
          `+${delayDays} j par rapport à l’objectif`,
        ],
        action: "Remise à la reproduction à prévoir",
        color: STAGE_COLORS.delay,
      });
    }

    if (calfBirthDate && !dryOffDone && !calfSevreDone) {
      const advisedDryOffDate = addMonths(calfBirthDate, Math.max(1, dryOffCalfAgeMonths));
      if (advisedDryOffDate <= today) {
        alerts.push({
          id: "dry-off",
          title: "TARISSEMENT À PRÉVOIR",
          lines: [
            calfNumber ? `Veau ${calfNumber}` : "Dernier veau",
            `Conseillé le ${formatDate(advisedDryOffDate)}`,
          ],
          action: "Confirmer seulement si le tarissement est réalisé",
          color: STAGE_COLORS.imminent,
        });
      }
    }

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
      const restDays = Math.min(daysSinceCalving, safeRestObjectiveDays);
      addSegment(segments, {
        id: "repos",
        label: "Repos",
        days: restDays || 1,
        color: STAGE_COLORS.rest,
        current: status === "REPOS",
        detail: `Depuis le ${formatDate(lastCalvingDate)}`,
      });

      if (isPostCalvingDelay) {
        const delayDays = daysSinceCalving - safeRestObjectiveDays;
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
        main = `+${delayDays} j`;
        secondary = "Retard de remise à la reproduction";
        usefulDate = formatDate(addDays(lastCalvingDate, safeRestObjectiveDays));
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
      const cycleStartDate = lastCalvingDate && lastCalvingDate < breedingDate ? lastCalvingDate : breedingDate;

      if (lastCalvingDate && lastCalvingDate < breedingDate) {
        const restBeforeBreedingDays = elapsedDays(lastCalvingDate, breedingDate);
        const normalRestDays = Math.min(restBeforeBreedingDays, safeRestObjectiveDays);
        addSegment(segments, {
          id: "repos-post-velage",
          label: "Repos",
          days: normalRestDays,
          color: STAGE_COLORS.rest,
          detail: `Du vêlage au ${breedingType === "IA" ? "début IA" : "début saillie"}`,
        });
        if (restBeforeBreedingDays > safeRestObjectiveDays) {
          const delayDays = restBeforeBreedingDays - safeRestObjectiveDays;
          addSegment(segments, {
            id: "retard-resolu",
            label: "Retard repro",
            shortLabel: "Retard",
            days: delayDays,
            color: STAGE_COLORS.delay,
            detail: `Repos réel : ${pluralDays(restBeforeBreedingDays)}`,
          });
          alerts.push({
            id: "repro-delay",
            title: "RETARD REPRO",
            lines: [
              `Repos trop long : ${pluralDays(restBeforeBreedingDays)}`,
              `+${delayDays} j par rapport à l’objectif`,
            ],
            action: "Remise à la repro réalisée",
            color: STAGE_COLORS.delay,
          });
        }
      }

      const waitingEnd = conclusionDate ?? today;
      const waitingDays = elapsedDays(breedingDate, waitingEnd);

      addSegment(segments, {
        id: "attente",
        label: "Attente",
        days: waitingDays || (daysSinceBreeding === 0 ? 1 : 0),
        color: STAGE_COLORS.waiting,
        current: status === "GRIS" || status === "JAUNE",
        detail: `Attente post-${breedingType === "IA" ? "IA" : "saillie"} jusqu’au ${formatDate(expectedEchoDate)}`,
      });

      const echoWaitingEnd = conclusionDate
        ? conclusionDate > expectedEchoDate ? conclusionDate : expectedEchoDate
        : today;
      const echoWaitingDays =
        echoWaitingEnd > expectedEchoDate ? elapsedDays(expectedEchoDate, echoWaitingEnd) : 0;
      if (echoWaitingDays > 0 || status === "JAUNE") {
        overlaySegments.push({
          id: "echo-wait",
          label: "À échographier",
          shortLabel: "Écho",
          startDays: elapsedDays(cycleStartDate, expectedEchoDate),
          days: echoWaitingDays || 1,
          color: STAGE_COLORS.scan,
          current: status === "JAUNE",
          detail: `Échographie possible depuis le ${formatDate(expectedEchoDate)}`,
        });
      }

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
      overlaySegments,
      alerts,
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
  }, [status, breedingDate, breedingType, breedingReference, calfBirthDate, calfNumber, calfSevreDone, calfSex, dryOffCalfAgeMonths, dryOffDone, dueDate, echoDate, echoObservation, echoResult, lastCalvingDate, restObjectiveDays, statusModifiedAt]);

  const activeStage =
    status === "GRIS" ? "waiting"
      : status === "JAUNE" ? "scan"
      : status === "VERT" ? "pregnant"
      : status === "ROSE" && model.gestation?.remainingDays && model.gestation.remainingDays < 0 ? "delay"
      : status === "ROSE" ? "imminent"
      : status === "REPOS" ? "rest"
      : "delay";

  const activeSegment = model.segments.find((segment) => segment.current);
  const activeColor =
    status === "JAUNE"
      ? STAGE_COLORS.scan
      : activeSegment?.color ?? (status === "ROUGE" ? STAGE_COLORS.service : STAGE_COLORS[activeStage]);
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
      length: Math.max(2, slot - 7),
      offset: ringOffset,
      midAngle: (startRatio + segment.days / model.scaleDays / 2) * 360 - 90,
      displayColor: segment.current ? softenColor(segment.color, 0.12) : softenColor(segment.color, 0.58),
    };
    ringOffset += slot;
    return item;
  });
  const overlayRing = model.overlaySegments.map((segment) => {
    const slot = (segment.days / model.scaleDays) * ECHO_OVERLAY_CIRCUMFERENCE;
    const offset = (segment.startDays / model.scaleDays) * ECHO_OVERLAY_CIRCUMFERENCE;
    return {
      ...segment,
      length: Math.max(2, slot - 5),
      offset,
      midAngle: ((segment.startDays + segment.days / 2) / model.scaleDays) * 360 - 90,
      displayColor: segment.current ? softenColor(segment.color, 0.1) : softenColor(segment.color, 0.44),
    };
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
        angle,
        cycleDay: elapsedDays(eventStart, event.date),
        position: {
          left: `${50 + 45.5 * Math.cos(angle * Math.PI / 180)}%`,
          top: `${50 + 45.5 * Math.sin(angle * Math.PI / 180)}%`,
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
  const restActualDays =
    lastCalvingDate ? elapsedDays(lastCalvingDate, breedingDate && breedingDate > lastCalvingDate ? breedingDate : today) : null;
  const restDelayDays = restActualDays !== null ? Math.max(0, restActualDays - restObjectiveDays) : 0;
  const echoSummary =
    echoDate
      ? echoResult === "PLEINE"
        ? "Écho positive"
        : echoResult === "VIDE"
          ? "Écho négative"
          : "Écho réalisée"
      : status === "JAUNE"
        ? "Écho à réaliser"
        : "Écho à venir";
  const summaryCards = [
    {
      id: "repos",
      title: "Repos",
      icon: Clock3,
      color: STAGE_COLORS.rest,
      main: restActualDays !== null ? `${restActualDays} j — objectif ${restObjectiveDays}` : `Objectif ${restObjectiveDays} j`,
      detail: restDelayDays > 0 ? `+${restDelayDays} j de retard` : "Dans l’objectif",
    },
    {
      id: "service",
      title: breedingType === "IA" ? "IA" : "Saillie",
      icon: Syringe,
      color: STAGE_COLORS.service,
      main: breedingDate ? `${breedingType === "IA" ? "IA" : "Saillie"} réalisée` : "Non enregistrée",
      detail: breedingDate
        ? `${formatDate(breedingDate)}${lastCalvingDate ? ` — J${elapsedDays(lastCalvingDate, breedingDate)}` : ""}`
        : "À renseigner",
    },
    {
      id: "echo",
      title: "Échographie",
      icon: CheckCircle2,
      color: echoResult === "VIDE" ? STAGE_COLORS.delay : STAGE_COLORS.pregnant,
      main: echoSummary,
      detail: echoDate ? formatDate(echoDate) : `Dès J+${ECHOGRAPHY_WAIT_DAYS}`,
    },
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
        <div className={`mx-auto grid max-w-5xl items-center gap-4 ${model.alerts.length > 0 ? "lg:grid-cols-[190px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
          {model.alerts.length > 0 && (
            <aside className="order-2 space-y-2 lg:order-1">
              {model.alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" style={{ color: alert.color }}>
                      <AlertTriangle size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: alert.color }}>{alert.title}</p>
                      {alert.lines.map((line) => (
                        <p key={line} className="mt-1 text-[11px] font-semibold text-red-800/80">{line}</p>
                      ))}
                      <p className="mt-2 text-[11px] font-extrabold" style={{ color: alert.color }}>{alert.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </aside>
          )}

          <div className="order-1 min-w-0 lg:order-2">
            <div className="relative mx-auto aspect-square w-[min(94vw,460px)] sm:w-[500px]">
              <svg
                viewBox="0 0 200 200"
                className="h-full w-full overflow-visible"
                role="img"
                aria-label={`${model.title} : ${model.main}`}
              >
                <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke={STAGE_COLORS.future} strokeWidth={MAIN_RING_WIDTH} />
                <circle cx="100" cy="100" r={ECHO_OVERLAY_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="2.4 3.2" />
                <circle cx="100" cy="100" r="67" fill="none" stroke="#eef2f7" strokeWidth="0.8" />
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
                        strokeWidth={stage.current ? ACTIVE_RING_WIDTH : PAST_RING_WIDTH}
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
                <g aria-label="Surcouche des échographies">
                  {overlayRing.map((stage) => {
                    return (
                      <circle
                        key={`${stage.id}-overlay`}
                        cx="100"
                        cy="100"
                        r={ECHO_OVERLAY_RADIUS}
                        fill="none"
                        stroke={stage.displayColor}
                        strokeWidth={stage.current ? 5 : 4}
                        strokeLinecap="round"
                        strokeDasharray={`${stage.length} ${ECHO_OVERLAY_CIRCUMFERENCE - stage.length}`}
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
                    const dotX = 100 + 91 * Math.cos(radians);
                    const dotY = 100 + 91 * Math.sin(radians);
                    const x = 100 + 101 * Math.cos(radians);
                    const y = 100 + 101 * Math.sin(radians);
                    return (
                      <g key={`${stage.id}-label`}>
                        <circle cx={dotX} cy={dotY} r={stage.current ? 2 : 1.6} fill={stage.displayColor} />
                        <text
                          x={x}
                          y={y}
                          textAnchor={x < 92 ? "end" : x > 108 ? "start" : "middle"}
                          dominantBaseline="central"
                          className="font-bold [paint-order:stroke] [stroke-width:2.8px]"
                          style={{
                            fill: stage.current ? stage.color : "#64748b",
                            stroke: "#ffffff",
                            fontSize: isShort ? "4.3px" : "4.8px",
                          }}
                        >
                          {stage.shortLabel ?? stage.label}
                        </text>
                      </g>
                    );
                  })}
                  {overlayRing.map((stage) => {
                    const radians = stage.midAngle * Math.PI / 180;
                    const dotX = 100 + 94 * Math.cos(radians);
                    const dotY = 100 + 94 * Math.sin(radians);
                    const x = 100 + 105 * Math.cos(radians);
                    const y = 100 + 105 * Math.sin(radians);
                    return (
                      <g key={`${stage.id}-overlay-label`}>
                        <circle cx={dotX} cy={dotY} r={1.7} fill={stage.displayColor} />
                        <text
                          x={x}
                          y={y}
                          textAnchor={x < 92 ? "end" : x > 108 ? "start" : "middle"}
                          dominantBaseline="central"
                          className="font-bold [paint-order:stroke] [stroke-width:2.8px]"
                          style={{
                            fill: "#b45309",
                            stroke: "#ffffff",
                            fontSize: "4.6px",
                          }}
                        >
                          {stage.shortLabel ?? stage.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {ringEvents.map((event) => {
                const selected = selectedEventId === event.id;
                const showText = event.kind !== "calving";
                return (
                  <div key={`${event.label}-${event.date.toISOString()}`} className={`group absolute -translate-x-1/2 -translate-y-1/2 ${selected ? "z-40" : "z-20"}`} style={event.position}>
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                      aria-expanded={selected}
                      aria-label={`${event.label}, ${formatDate(event.date)}. Afficher les détails`}
                      className={`flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 ${selected ? "scale-110 border-[4px] shadow-lg ring-4 ring-white" : "border-[3px]"}`}
                      style={{ borderColor: event.color, color: event.color }}
                      title={`${event.label} · ${formatDate(event.date)}`}
                    >
                      <EventIcon kind={event.kind} />
                    </button>
                    {event.kind === "calving" && (
                      <span className="pointer-events-none absolute left-1/2 top-[-1.25rem] w-max -translate-x-1/2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
                        Vêlage J0
                      </span>
                    )}
                    {showText && (
                      <span className="pointer-events-none absolute left-1/2 top-12 w-max max-w-[7.5rem] -translate-x-1/2 text-center">
                        <span className="block text-[10px] font-extrabold leading-tight" style={{ color: event.color }}>{event.label}</span>
                        <span className="block text-[9px] font-semibold leading-tight text-slate-500">J{event.cycleDay}</span>
                      </span>
                    )}
                    <span className="pointer-events-none absolute left-1/2 top-10 hidden w-max max-w-40 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-center text-[10px] font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
                      {event.label} · {formatDate(event.date)}
                    </span>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
                style={markerPosition}
                aria-label="Revenir à la situation actuelle"
              >
                <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full border-2 bg-white px-1.5 text-[10px] font-extrabold shadow-sm ring-4 ring-white/90" style={{ borderColor: activeColor, color: activeColor }}>
                  {markerText}
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectedEvent && setSelectedEventId(null)}
                className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-white px-5 text-center shadow-[inset_0_0_0_1px_#eef2f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
                aria-label={selectedEvent ? "Revenir à la situation actuelle" : `${model.title} : ${model.main}`}
              >
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-100" style={{ color: activeColor }}>
                      <CheckCircle2 size={23} strokeWidth={2.6} />
                    </span>
                    <span className={`mt-2 text-lg font-extrabold leading-none sm:text-2xl ${model.tone}`}>
                      {model.title}
                    </span>
                    <strong className="mt-2 rounded-full px-3 py-1 text-sm leading-tight sm:text-base" style={{ backgroundColor: softenColor(activeColor, 0.82), color: activeColor }}>
                      {model.main}
                    </strong>
                    <span className="mt-3 h-px w-1/2 bg-slate-200" />
                    <span className="mt-2 line-clamp-2 max-w-[92%] text-[10px] leading-snug text-slate-600 sm:text-xs">
                      {model.secondary}
                    </span>
                    {model.usefulDate && (
                      <span className="mt-1 text-[9px] font-semibold text-slate-400 sm:text-[11px]">
                        {model.usefulDate}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            <div className="mx-auto mt-4 grid max-w-3xl gap-2 sm:grid-cols-3">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.id} className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50" style={{ color: card.color }}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-extrabold text-slate-700">{card.title}</span>
                      <span className="block truncate text-[10px] font-semibold text-slate-600">{card.main}</span>
                      <span className="block truncate text-[10px] text-slate-500">{card.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
