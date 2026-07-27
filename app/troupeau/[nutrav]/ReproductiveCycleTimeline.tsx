"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { addDays, addMonths, differenceInCalendarDays, subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock3, Syringe } from "lucide-react";
import {
  ECHOGRAPHY_WAIT_DAYS,
  REPRODUCTIVE_CYCLE_COLORS,
  type EtatGestation,
} from "@/lib/utils";
import {
  GESTATION_REFERENCE_DAYS,
  formatGestationElapsed,
  getGestationProgress,
} from "@/lib/gestation-progress";

export interface ReproductiveCycleTimelineProps {
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
  breedingStartDays: number;
  reproductionDelayDays: number;
  echoPreparationEnabled: boolean;
  echoPreparationDays: number;
  echoDueDays: number;
  imminentCalvingDays: number;
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

interface PositionedEvent extends EventItem {
  angle: number;
  mobileAngle: number;
  desktopAngle: number;
  position: CSSProperties;
}

const OPEN_CYCLE_SCALE_DAYS = 365;
// Version visuelle 1 gelée après validation des scénarios reproductifs.
const RING_RADIUS = 82;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAIN_RING_WIDTH = 14;
const ACTIVE_RING_WIDTH = 15;
const PAST_RING_WIDTH = 13;
const ECHO_OVERLAY_RADIUS = 94;
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

function compactDuration(days: number) {
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays > 0 ? `${months} mois ${remainingDays} j` : `${months} mois`;
  }
  return `${days} j`;
}

function softenColor(hex: string, amount = 0.66) {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const mix = (value: number) => Math.round(value + (255 - value) * amount);
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

function delayStateColor(delayDays: number) {
  return delayDays >= ECHOGRAPHY_WAIT_DAYS ? STAGE_COLORS.delay : STAGE_COLORS.service;
}

function segmentDisplayColor(segment: Segment, scaleDays: number) {
  if (segment.current) {
    if (segment.id === "gestante") return segment.color;
    return softenColor(segment.color, 0.08);
  }
  if (segment.id === "attente") return softenColor(segment.color, 0.78);
  if (segment.id.includes("retard") || segment.id === "a-remettre") return softenColor(segment.color, 0.42);
  if (segment.id === "gestante") return softenColor(segment.color, 0.3);
  if (segment.days / scaleDays > 0.28) return softenColor(segment.color, 0.68);
  return softenColor(segment.color, 0.56);
}

function calfSexLabel(sex: string | null) {
  if (sex === "F") return "Femelle";
  if (sex === "M") return "Mâle";
  return null;
}

function angularPosition(angle: number, radius: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: radius * Math.cos(radians),
    y: radius * Math.sin(radians),
  };
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function angularDistance(left: number, right: number) {
  const rawDistance = Math.abs((left - right) % 360);
  return Math.min(rawDistance, 360 - rawDistance);
}

function avoidRingCollisions(
  events: Array<EventItem & { angle: number }>,
  radius: number,
  markerAngle: number,
  markerRadius: number,
  minimumEventDistance: number,
  minimumMarkerDistance: number,
  maximumDisplacement: number
) {
  const marker = angularPosition(markerAngle, markerRadius);
  const minimumAngleGap =
    2 * Math.asin(Math.min(1, minimumEventDistance / (2 * radius))) * 180 / Math.PI;
  const maximumAngleShift =
    2 * Math.asin(Math.min(1, maximumDisplacement / (2 * radius))) * 180 / Math.PI;
  const sorted = events
    .map((event, index) => ({ event, index, displayAngle: event.angle }))
    .sort((left, right) => left.event.angle - right.event.angle);

  for (let clusterStart = 0; clusterStart < sorted.length;) {
    let clusterEnd = clusterStart;
    while (
      clusterEnd + 1 < sorted.length
      && sorted[clusterEnd + 1].event.angle - sorted[clusterEnd].event.angle < minimumAngleGap
    ) {
      clusterEnd += 1;
    }

    if (clusterEnd > clusterStart) {
      const cluster = sorted.slice(clusterStart, clusterEnd + 1);
      const rawCenter =
        cluster.reduce((sum, item) => sum + item.event.angle, 0) / cluster.length;
      const firstTarget = rawCenter - minimumAngleGap * (cluster.length - 1) / 2;
      const shifts = cluster.map((item, index) =>
        firstTarget + index * minimumAngleGap - item.event.angle
      );
      const largestShift = Math.max(...shifts.map((shift) => Math.abs(shift)));
      const scale = largestShift > maximumAngleShift ? maximumAngleShift / largestShift : 1;

      cluster.forEach((item, index) => {
        item.displayAngle = item.event.angle + shifts[index] * scale;
      });
    }

    clusterStart = clusterEnd + 1;
  }

  return sorted
    .map((item) => {
      let displayAngle = item.displayAngle;
      let point = angularPosition(displayAngle, radius);

      if (distanceBetween(point, marker) < minimumMarkerDistance) {
        const backwardAngle = item.event.angle - maximumAngleShift;
        const forwardAngle = item.event.angle + maximumAngleShift;
        const backwardPoint = angularPosition(backwardAngle, radius);
        const forwardPoint = angularPosition(forwardAngle, radius);
        const useBackward =
          distanceBetween(backwardPoint, marker) > distanceBetween(forwardPoint, marker);
        displayAngle = useBackward ? backwardAngle : forwardAngle;
        point = useBackward ? backwardPoint : forwardPoint;
      }

      return { index: item.index, angle: displayAngle, point };
    })
    .sort((left, right) => left.index - right.index);
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
  breedingStartDays,
  reproductionDelayDays,
  echoPreparationEnabled,
  echoPreparationDays,
  echoDueDays,
  imminentCalvingDays,
  dryOffCalfAgeMonths,
  dryOffDone,
  dryOffDate,
}: ReproductiveCycleTimelineProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const model = useMemo(() => {
    const today = new Date();
    const segments: Segment[] = [];
    const overlaySegments: OverlaySegment[] = [];
    const events: EventItem[] = [];
    const alerts: CycleAlert[] = [];
    const safeRestObjectiveDays = Math.max(1, restObjectiveDays);
    const safeBreedingStartDays = Math.max(safeRestObjectiveDays + 1, breedingStartDays);
    const safeReproductionDelayDays = Math.max(safeBreedingStartDays + 1, reproductionDelayDays);
    const safeEchoDueDays = Math.max(1, echoDueDays);
    const safeEchoPreparationDays = echoPreparationEnabled
      ? Math.min(Math.max(0, echoPreparationDays), safeEchoDueDays)
      : safeEchoDueDays;
    const safeImminentCalvingDays = Math.max(1, imminentCalvingDays);
    const daysSinceBreeding = breedingDate ? elapsedDays(breedingDate, today) : null;
    const daysSinceCalving = lastCalvingDate ? elapsedDays(lastCalvingDate, today) : null;
    const calvingIsLatest = Boolean(lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate));
    const isPostCalvingFollowUp =
      status === "ROUGE" &&
      calvingIsLatest &&
      daysSinceCalving !== null;
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

    if (lastCalvingDate && daysSinceCalving !== null && calvingIsLatest && daysSinceCalving >= safeReproductionDelayDays && !breedingDate) {
      const delayDays = daysSinceCalving - safeReproductionDelayDays + 1;
      const delayColor = delayStateColor(delayDays);
      alerts.push({
        id: "repro-delay",
        title: "Retard repro",
        lines: [
          `Depuis vêlage : ${daysSinceCalving} j`,
          `Retard à partir de J${safeReproductionDelayDays}`,
        ],
        action: "Remise à la reproduction à prévoir",
        color: delayColor,
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
        transition: isIa ? "Début de l’attente post-IA" : "Début de l’attente post-saillie",
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

    if ((status === "REPOS" || isPostCalvingFollowUp) && lastCalvingDate && daysSinceCalving !== null) {
      const restEndDay = safeBreedingStartDays - 1;
      const breedingEndDay = safeReproductionDelayDays - 1;
      const restDays = Math.min(daysSinceCalving, restEndDay);
      addSegment(segments, {
        id: "repos",
        label: "Repos",
        days: restDays || 1,
        color: STAGE_COLORS.rest,
        current: daysSinceCalving < safeBreedingStartDays,
        detail: `Depuis le ${formatDate(lastCalvingDate)}`,
      });

      if (daysSinceCalving >= safeBreedingStartDays) {
        const breedingPhaseDays =
          Math.min(daysSinceCalving, breedingEndDay) - safeBreedingStartDays + 1;
        addSegment(segments, {
          id: "mise-repro",
          label: "Mise à la reproduction",
          days: breedingPhaseDays,
          color: STAGE_COLORS.service,
          current: daysSinceCalving < safeReproductionDelayDays,
          detail: `Du J${safeBreedingStartDays} au J${breedingEndDay}`,
        });
      }

      if (daysSinceCalving >= safeReproductionDelayDays) {
        const delayDays = daysSinceCalving - safeReproductionDelayDays + 1;
        const delayColor = delayStateColor(delayDays);
        addSegment(segments, {
          id: "retard",
          label: "Retard",
          days: delayDays,
          color: delayColor,
          current: true,
          striped: true,
          detail: `Remise à la reproduction attendue depuis ${pluralDays(delayDays)}`,
        });
        title = "Retard";
        main = `+${delayDays} j`;
        secondary = `Remise à la reproduction attendue depuis le ${formatDate(addDays(lastCalvingDate, safeReproductionDelayDays))}`;
        usefulDate = null;
        tone = "text-red-700";
      } else if (daysSinceCalving >= safeBreedingStartDays) {
        title = "Mise à la reproduction";
        main = `${daysSinceCalving} j`;
        secondary = `Mise à la reproduction recommandée depuis le ${formatDate(addDays(lastCalvingDate, safeBreedingStartDays))}`;
        usefulDate = null;
        tone = "text-fuchsia-700";
      } else {
        title = "Repos post-vêlage";
        main = pluralDays(daysSinceCalving);
        secondary = `Vêlage le ${formatDate(lastCalvingDate)}`;
        usefulDate = null;
        tone = "text-sky-700";
      }
    } else if (breedingDate && daysSinceBreeding !== null) {
      const expectedEchoDate = addDays(breedingDate, safeEchoDueDays);
      const echoOverlayStartDate = addDays(breedingDate, safeEchoPreparationDays);
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
        const restEndDay = safeBreedingStartDays - 1;
        const breedingEndDay = safeReproductionDelayDays - 1;
        const normalRestDays = Math.min(restBeforeBreedingDays, restEndDay);
        addSegment(segments, {
          id: "repos-post-velage",
          label: "Repos",
          days: normalRestDays,
          color: STAGE_COLORS.rest,
          detail: `Du vêlage au ${breedingType === "IA" ? "début IA" : "début saillie"}`,
        });

        if (restBeforeBreedingDays >= safeBreedingStartDays) {
          addSegment(segments, {
            id: "mise-repro-resolue",
            label: "Mise à la reproduction",
            days: Math.min(restBeforeBreedingDays, breedingEndDay) - safeBreedingStartDays + 1,
            color: STAGE_COLORS.service,
            detail: `Du J${safeBreedingStartDays} au J${breedingEndDay}`,
          });
        }

        if (restBeforeBreedingDays >= safeReproductionDelayDays) {
          const delayDays = restBeforeBreedingDays - safeReproductionDelayDays + 1;
          const delayColor = delayStateColor(delayDays);
          addSegment(segments, {
            id: "retard-resolu",
            label: "Retard repro",
            shortLabel: "Retard",
            days: delayDays,
            color: delayColor,
            detail: `Repos réel : ${pluralDays(restBeforeBreedingDays)}`,
          });
          alerts.push({
            id: "repro-delay",
            title: "Retard repro passé",
            lines: [
              `Depuis vêlage : ${restBeforeBreedingDays} j`,
              `Retard à partir de J${safeReproductionDelayDays}`,
            ],
            action: "Remise à la repro réalisée",
            color: delayColor,
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
        ? conclusionDate > echoOverlayStartDate ? conclusionDate : echoOverlayStartDate
        : today;
      const echoWaitingDays =
        echoWaitingEnd > echoOverlayStartDate ? elapsedDays(echoOverlayStartDate, echoWaitingEnd) : 0;
      if (echoWaitingDays > 0 || status === "JAUNE") {
        overlaySegments.push({
          id: "echo-wait",
          label: "À échographier",
          shortLabel: "Écho",
          startDays: elapsedDays(cycleStartDate, echoOverlayStartDate),
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
          label: "Retard",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
          detail: `Disponible depuis le ${formatDate(emptySince)}`,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = effectiveEchoDate ? `Échographie négative le ${formatDate(effectiveEchoDate)}` : "Cycle ouvert";
        usefulDate = null;
        tone = "text-fuchsia-700";
      } else if ((status === "VERT" || status === "ROSE") && gestation) {
        const confirmedAt = gestationConfirmedAt ?? expectedEchoDate;
        const calculatedDueDate = dueDate ?? addDays(breedingDate, GESTATION_REFERENCE_DAYS);
        const imminentAt = subDays(calculatedDueDate, safeImminentCalvingDays);
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
          secondary = `Vêlage prévu le ${formatDate(calculatedDueDate)}`;
          usefulDate = null;
          tone = gestation.remainingDays < 0 ? "text-red-700" : "text-orange-700";
        } else {
          title = "Gestante";
          main = formatGestationElapsed(gestation.elapsedDays);
          secondary = `Vêlage prévu le ${formatDate(calculatedDueDate)}`;
          usefulDate = null;
          tone = "text-green-700";
        }
      } else if (status === "JAUNE") {
        const waitingForEchoDays = Math.max(0, daysSinceBreeding - safeEchoDueDays);
        title = "À échographier";
        main = waitingForEchoDays === 0 ? "Dès aujourd’hui" : `Depuis ${pluralDays(waitingForEchoDays)}`;
        secondary = `Écho possible depuis le ${formatDate(expectedEchoDate)}`;
        usefulDate = null;
        tone = "text-amber-700";
      } else if (status === "GRIS") {
        const remaining = Math.max(0, safeEchoDueDays - daysSinceBreeding);
        title = `Repos post-${breedingType === "IA" ? "IA" : "saillie"}`;
        main = remaining === 0 ? "Échographie possible" : `Encore ${pluralDays(remaining)}`;
        secondary = `Écho possible à partir du ${formatDate(expectedEchoDate)}`;
        usefulDate = null;
        tone = "text-slate-700";
      } else if (status === "ROUGE") {
        const availableSince = statusModifiedAt ?? breedingDate;
        const availableDays = elapsedDays(availableSince, today);
        addSegment(segments, {
          id: "a-remettre",
          label: "Retard",
          days: availableDays || 1,
          color: STAGE_COLORS.service,
          current: true,
        });
        title = "À remettre à la reproduction";
        main = `Depuis ${pluralDays(availableDays)}`;
        secondary = "Animal disponible";
        usefulDate = null;
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
  }, [status, breedingDate, breedingType, breedingReference, breedingStartDays, calfBirthDate, calfNumber, calfSevreDone, calfSex, dryOffCalfAgeMonths, dryOffDone, dueDate, echoDate, echoDueDays, echoObservation, echoPreparationDays, echoPreparationEnabled, echoResult, imminentCalvingDays, lastCalvingDate, reproductionDelayDays, restObjectiveDays, statusModifiedAt]);

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

  const today = new Date();
  const displayBreedingStartDays = Math.max(restObjectiveDays + 1, breedingStartDays);
  const displayReproductionDelayDays = Math.max(displayBreedingStartDays + 1, reproductionDelayDays);
  const displayEchoDueDays = Math.max(1, echoDueDays);
  const displayImminentCalvingDays = Math.max(1, imminentCalvingDays);
  const projectedCalvingDate =
    dueDate ?? (breedingDate ? addDays(breedingDate, GESTATION_REFERENCE_DAYS) : null);
  const expectedEchoDate = breedingDate ? addDays(breedingDate, displayEchoDueDays) : null;
  let ringOffset = 0;
  const elapsedRing = model.segments.map((segment) => {
    const slot = (segment.days / model.scaleDays) * RING_CIRCUMFERENCE;
    const startRatio = ringOffset / RING_CIRCUMFERENCE;
    const item = {
      ...segment,
      length: Math.max(2, slot - 7),
      offset: ringOffset,
      midAngle: (startRatio + segment.days / model.scaleDays / 2) * 360 - 90,
      displayColor: segmentDisplayColor(segment, model.scaleDays),
      labelDetail:
        segment.id.startsWith("repos")
          ? `objectif ${restObjectiveDays} j`
          : segment.id.startsWith("mise-repro")
            ? null
            : segment.id.includes("retard")
              ? null
            : segment.id === "attente"
              ? null
              : segment.id === "gestante"
                ? null
                : segment.id === "imminent"
                  ? `environ J-${displayImminentCalvingDays}`
                  : null,
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
  const eventAngles = model.events
    .filter((event) => event.date >= eventStart && event.date <= eventEnd)
    .map((event) => {
      const ratio = Math.min(1, Math.max(0, elapsedDays(eventStart, event.date) / eventSpan));
      const angle = ratio * 360 - 90;
      return { ...event, angle };
    });
  const markerMobileRadius = 28.5;
  const markerDesktopRadius = 29;
  const markerPosition = {
    "--marker-x-mobile": `${markerMobileRadius * Math.cos(markerAngle * Math.PI / 180)}%`,
    "--marker-y-mobile": `${markerMobileRadius * Math.sin(markerAngle * Math.PI / 180)}%`,
    "--marker-x-desktop": `${markerDesktopRadius * Math.cos(markerAngle * Math.PI / 180)}%`,
    "--marker-y-desktop": `${markerDesktopRadius * Math.sin(markerAngle * Math.PI / 180)}%`,
  } as CSSProperties;
  const mobileEventLayout = avoidRingCollisions(eventAngles, 43.5, markerAngle, markerMobileRadius, 10.8, 10, 5.2);
  const desktopEventLayout = avoidRingCollisions(eventAngles, 43.5, markerAngle, markerDesktopRadius, 8.8, 8.3, 4.1);
  const ringEvents: PositionedEvent[] = eventAngles.map((event, index) => ({
    ...event,
    mobileAngle: event.kind === "calving" ? -90 : mobileEventLayout[index].angle,
    desktopAngle: event.kind === "calving" ? -90 : desktopEventLayout[index].angle,
    position: {
      "--event-x-mobile": `${event.kind === "calving" ? 0 : mobileEventLayout[index].point.x}%`,
      "--event-y-mobile": `${event.kind === "calving" ? -41 : mobileEventLayout[index].point.y}%`,
      "--event-x-desktop": `${event.kind === "calving" ? 0 : desktopEventLayout[index].point.x}%`,
      "--event-y-desktop": `${event.kind === "calving" ? -41 : desktopEventLayout[index].point.y}%`,
    } as CSSProperties,
  }));
  const selectedEvent = ringEvents.find((event) => event.id === selectedEventId) ?? null;
  const currentPostCalvingDays =
    lastCalvingDate && (!breedingDate || lastCalvingDate > breedingDate)
      ? elapsedDays(lastCalvingDate, today)
      : null;
  const markerText = (() => {
    if (currentPostCalvingDays !== null) {
      return currentPostCalvingDays >= displayReproductionDelayDays
        ? `+${currentPostCalvingDays - displayReproductionDelayDays + 1} j`
        : `${currentPostCalvingDays} j`;
    }
    if (model.gestation && status === "ROSE") {
      return model.gestation.remainingDays >= 0
        ? `J-${model.gestation.remainingDays}`
        : `Depuis ${Math.abs(model.gestation.remainingDays)} j`;
    }
    if (model.gestation && status === "VERT") return compactDuration(model.gestation.elapsedDays);
    if (status === "JAUNE" && expectedEchoDate) return `Depuis ${elapsedDays(expectedEchoDate, today)} j`;
    if (status === "GRIS" && breedingDate) return `${elapsedDays(breedingDate, today)} j`;
    if (activeSegment?.current) {
      return activeSegment.id === "a-remettre"
        ? `Depuis ${activeSegment.days} j`
        : `${activeSegment.days} j`;
    }
    return "Aujourd’hui";
  })();
  const restActualDays =
    lastCalvingDate ? elapsedDays(lastCalvingDate, breedingDate && breedingDate > lastCalvingDate ? breedingDate : today) : null;
  const restPhaseDays = restActualDays !== null
    ? Math.min(restActualDays, displayBreedingStartDays - 1)
    : null;
  const restDelayDays = restActualDays !== null
    ? Math.max(0, restActualDays - displayReproductionDelayDays + 1)
    : 0;
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
      main: restPhaseDays !== null ? `${restPhaseDays} j — objectif ${restObjectiveDays}` : `Objectif ${restObjectiveDays} j`,
      detail:
        restDelayDays > 0
          ? breedingDate ? "Remise à la repro réalisée" : "Remise à la repro à prévoir"
          : restActualDays !== null && restActualDays >= displayBreedingStartDays
            ? "Mise à la reproduction"
            : "Dans l’objectif",
    },
    {
      id: "service",
      title: breedingType === "IA" ? "IA" : "Saillie",
      icon: Syringe,
      color: STAGE_COLORS.service,
      main: breedingDate ? `${breedingType === "IA" ? "IA" : "Saillie"} réalisée` : "Non enregistrée",
      detail: breedingDate
        ? `${formatDate(breedingDate)}${breedingReference ? ` · ${breedingReference}` : ""}`
        : "À renseigner",
    },
    {
      id: "echo",
      title: "Échographie",
      icon: CheckCircle2,
      color: echoResult === "VIDE" ? STAGE_COLORS.delay : STAGE_COLORS.pregnant,
      main: echoSummary,
      detail: echoDate
        ? formatDate(echoDate)
        : expectedEchoDate
          ? `Dès le ${formatDate(expectedEchoDate)}`
          : "Après saillie / IA",
    },
  ];
  const mobilePhaseLabels = elapsedRing.filter(
    (stage, index, stages) => stages.findIndex((candidate) => candidate.label === stage.label) === index
  );

  return (
    <section
      className="mt-3 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label={`Cycle reproductif : ${model.title}, ${model.main}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
        <div>
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:block">Reproduction</p>
          <h3 className="whitespace-nowrap text-sm font-bold text-slate-900 sm:text-base">Cycle reproductif</h3>
        </div>
        <span className={`min-w-0 truncate rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold ${model.tone}`}>
          {model.title}
        </span>
      </div>

      <div className="px-1.5 py-2.5 sm:px-5 sm:py-4">
        <div className={`mx-auto grid max-w-5xl items-center gap-2.5 sm:gap-4 ${model.alerts.length > 0 ? "lg:grid-cols-[190px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
          {model.alerts.length > 0 && (
            <aside className="order-2 space-y-2 lg:order-1">
              {model.alerts.map((alert) => {
                const alertSoftColor = softenColor(alert.color, 0.9);
                const alertBorderColor = softenColor(alert.color, 0.68);
                return (
                  <div
                    key={alert.id}
                    className="rounded-xl border p-2.5 shadow-sm"
                    style={{ backgroundColor: alertSoftColor, borderColor: alertBorderColor }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" style={{ color: alert.color }}>
                        <AlertTriangle size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold leading-tight tracking-wide" style={{ color: alert.color }}>{alert.title}</p>
                        {alert.lines.map((line) => (
                          <p key={line} className="mt-0.5 text-[10px] font-semibold leading-tight text-slate-700">{line}</p>
                        ))}
                        <p className="mt-1 text-[10px] font-extrabold leading-tight" style={{ color: alert.color }}>{alert.action}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </aside>
          )}

          <div className="order-1 min-w-0 lg:order-2">
            <div className="relative mx-auto my-3 aspect-square w-[min(88vw,390px)] sm:w-[430px]">
              <svg
                viewBox="-14 -14 228 228"
                className="h-full w-full overflow-hidden sm:overflow-visible"
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
                <g aria-hidden="true" className="hidden sm:block">
                  {elapsedRing.map((stage) => {
                    const segmentRatio = stage.days / model.scaleDays;
                    const isShort = segmentRatio < 0.075;
                    const label = stage.shortLabel ?? stage.label;
                    const isLongLabel = label.length > 16;
                    const radians = stage.midAngle * Math.PI / 180;
                    const stageIndex = elapsedRing.findIndex((candidate) => candidate.id === stage.id);
                    const nearbyLabelCount = elapsedRing
                      .slice(0, stageIndex)
                      .filter((candidate) => angularDistance(candidate.midAngle, stage.midAngle) < 14)
                      .length;
                    const nearEvent = desktopEventLayout.some((event) => angularDistance(event.angle, stage.midAngle) < 24);
                    const nearMarker = angularDistance(markerAngle, stage.midAngle) < 16;
                    const labelRadius = 114 + nearbyLabelCount * 12 + (nearEvent ? 12 : 0) + (nearMarker ? 10 : 0);
                    const dotX = 100 + 91 * Math.cos(radians);
                    const dotY = 100 + 91 * Math.sin(radians);
                    const lineX = 100 + 99 * Math.cos(radians);
                    const lineY = 100 + 99 * Math.sin(radians);
                    const startZoneShift = angularDistance(stage.midAngle, -90) < 18
                      ? (Math.cos(radians) >= 0 ? 14 : -14)
                      : 0;
                    const x = 100 + labelRadius * Math.cos(radians) + startZoneShift;
                    const y = 100 + labelRadius * Math.sin(radians);
                    return (
                      <g key={`${stage.id}-label`}>
                        <line x1={dotX} y1={dotY} x2={lineX} y2={lineY} stroke={stage.displayColor} strokeWidth="0.8" strokeLinecap="round" />
                        <circle cx={dotX} cy={dotY} r={stage.current ? 2 : 1.6} fill={stage.displayColor} />
                        <text
                          x={x}
                          y={y - 3.8}
                          textAnchor={x < 92 ? "end" : x > 108 ? "start" : "middle"}
                          dominantBaseline="central"
                          className="font-bold [paint-order:stroke] [stroke-width:2.8px]"
                          style={{
                            fill: stage.current ? stage.color : "#64748b",
                            stroke: "#ffffff",
                            fontSize: isLongLabel ? "5.6px" : isShort ? "6.8px" : "7.6px",
                          }}
                        >
                          {label}
                        </text>
                        {stage.labelDetail && (
                          <text
                            x={x}
                            y={y + 5.4}
                            textAnchor={x < 92 ? "end" : x > 108 ? "start" : "middle"}
                            dominantBaseline="central"
                            className="font-semibold [paint-order:stroke] [stroke-width:2.5px]"
                            style={{ fill: "#64748b", stroke: "#ffffff", fontSize: "6px" }}
                          >
                            {stage.labelDetail}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {overlayRing.map((stage) => {
                    const radians = stage.midAngle * Math.PI / 180;
                    const nearEvent = desktopEventLayout.some((event) => angularDistance(event.angle, stage.midAngle) < 24);
                    const nearMarker = angularDistance(markerAngle, stage.midAngle) < 16;
                    const nearPhaseLabel = elapsedRing.some((segment) => angularDistance(segment.midAngle, stage.midAngle) < 22);
                    const labelRadius = 118 + (nearEvent ? 12 : 0) + (nearMarker ? 10 : 0) + (nearPhaseLabel ? 28 : 0);
                    const dotX = 100 + 96 * Math.cos(radians);
                    const dotY = 100 + 96 * Math.sin(radians);
                    const lineX = 100 + 103 * Math.cos(radians);
                    const lineY = 100 + 103 * Math.sin(radians);
                    const startZoneShift = angularDistance(stage.midAngle, -90) < 18
                      ? (Math.cos(radians) >= 0 ? 14 : -14)
                      : 0;
                    const x = 100 + labelRadius * Math.cos(radians) + startZoneShift;
                    const y = 100 + labelRadius * Math.sin(radians);
                    return (
                      <g key={`${stage.id}-overlay-label`}>
                        <line x1={dotX} y1={dotY} x2={lineX} y2={lineY} stroke={stage.displayColor} strokeWidth="0.8" strokeLinecap="round" />
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
                            fontSize: "7px",
                          }}
                        >
                          {stage.shortLabel ?? stage.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              <svg
                viewBox="-14 -14 228 228"
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                aria-hidden="true"
              >
                {ringEvents.map((event) => {
                  const connectorRadius = event.kind === "calving" ? 93.5 : 99.2;
                  const anchor = angularPosition(event.angle, connectorRadius);
                  const mobileDisplaced = angularPosition(event.mobileAngle, connectorRadius);
                  const desktopDisplaced = angularPosition(event.desktopAngle, connectorRadius);
                  const showMobile = distanceBetween(anchor, mobileDisplaced) >= 1;
                  const showDesktop = distanceBetween(anchor, desktopDisplaced) >= 1;
                  if (!showMobile && !showDesktop) return null;
                  return (
                    <g key={`${event.id}-connector`}>
                      {showMobile && (
                        <line
                          className="sm:hidden"
                          x1={100 + anchor.x}
                          y1={100 + anchor.y}
                          x2={100 + mobileDisplaced.x}
                          y2={100 + mobileDisplaced.y}
                          stroke={softenColor(event.color, 0.42)}
                          strokeWidth="0.9"
                          strokeLinecap="round"
                          strokeDasharray="2 2"
                        />
                      )}
                      {showDesktop && (
                        <line
                          className="hidden sm:block"
                          x1={100 + anchor.x}
                          y1={100 + anchor.y}
                          x2={100 + desktopDisplaced.x}
                          y2={100 + desktopDisplaced.y}
                          stroke={softenColor(event.color, 0.42)}
                          strokeWidth="0.9"
                          strokeLinecap="round"
                          strokeDasharray="2 2"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 text-center">
                <span className="block whitespace-nowrap bg-white/90 px-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Début cycle
                </span>
                <span className="mx-auto mt-0.5 block h-2 w-px bg-slate-300" />
              </div>

              {ringEvents.map((event) => {
                const selected = selectedEventId === event.id;
                return (
                  <div
                    key={`${event.label}-${event.date.toISOString()}`}
                    className={`group absolute left-[calc(50%+var(--event-x-mobile))] top-[calc(50%+var(--event-y-mobile))] -translate-x-1/2 -translate-y-1/2 sm:left-[calc(50%+var(--event-x-desktop))] sm:top-[calc(50%+var(--event-y-desktop))] ${selected ? "z-[25]" : "z-20"}`}
                    style={event.position}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                      aria-expanded={selected}
                      aria-label={`${event.label}, ${formatDate(event.date)}. Afficher les détails`}
                      className={`flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border-2 bg-white shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 ${selected ? "scale-110 border-[3px] shadow-md ring-2 ring-white sm:ring-4" : ""}`}
                      style={{ borderColor: event.color, color: event.color }}
                      title={`${event.label} · ${formatDate(event.date)}`}
                    >
                      <EventIcon kind={event.kind} />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="absolute z-30 left-[calc(50%+var(--marker-x-mobile))] top-[calc(50%+var(--marker-y-mobile))] -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 sm:left-[calc(50%+var(--marker-x-desktop))] sm:top-[calc(50%+var(--marker-y-desktop))]"
                style={markerPosition}
                aria-label="Revenir à la situation actuelle"
              >
                <span className="flex min-h-7 min-w-7 max-w-20 items-center justify-center rounded-full border bg-white/95 px-1.5 text-center text-[8px] font-bold leading-tight ring-2 ring-white/90 sm:text-[9px]" style={{ borderColor: activeColor, color: activeColor }}>
                  {markerText}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="absolute inset-[25%] flex flex-col items-center justify-center rounded-full bg-white px-2 text-center shadow-[inset_0_0_0_1px_#eef2f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 sm:px-5"
                aria-label={`${model.title} : ${model.secondary}`}
              >
                <span className={`max-w-[92%] font-extrabold uppercase leading-tight tracking-tight ${model.title.length > 22 ? "text-xs sm:text-lg" : "text-lg sm:text-2xl"} ${model.tone}`}>
                  {model.title}
                </span>
                <span className="mt-3 h-px w-1/2" style={{ backgroundColor: softenColor(activeColor, 0.72) }} />
                <span className="mt-3 line-clamp-3 max-w-[88%] text-[10px] font-medium leading-snug text-slate-600 sm:text-xs">
                  {model.secondary}
                </span>
              </button>
            </div>

            <div className="mx-auto mt-3 flex max-w-full gap-4 overflow-x-auto px-2 pb-1 sm:hidden" aria-label="Phases du cycle">
              {mobilePhaseLabels.map((stage) => (
                <span key={stage.id} className="flex shrink-0 items-center gap-2 text-sm font-semibold" style={{ color: stage.color }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.displayColor }} />
                  {stage.shortLabel ?? stage.label}
                </span>
              ))}
            </div>

            {selectedEvent && (
              <div
                className="mx-auto mt-2 max-w-xl rounded-xl border bg-white px-3 py-2 shadow-sm"
                style={{ borderColor: softenColor(selectedEvent.color, 0.58) }}
                aria-live="polite"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0" style={{ color: selectedEvent.color }}>
                    <EventIcon kind={selectedEvent.kind} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <strong className="text-sm text-slate-900">{selectedEvent.label}</strong>
                      <span className="text-xs font-bold text-slate-600">{formatDate(selectedEvent.date)}</span>
                    </div>
                    {selectedEvent.details.map((detail) => (
                      <p key={detail} className="truncate text-[11px] text-slate-500">{detail}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mx-auto mt-3 flex max-w-3xl snap-x overflow-x-auto border-t border-slate-100 px-1 pt-2 sm:mt-5 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pt-3">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.id} className="flex min-h-14 min-w-[72%] snap-start items-center gap-2 px-3 py-1.5 text-left sm:min-h-14 sm:min-w-0 sm:border-r sm:border-slate-100 sm:last:border-r-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center" style={{ color: card.color }}>
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-bold uppercase tracking-wide" style={{ color: card.color }}>{card.title}</span>
                      <span className="block truncate text-[10px] font-medium text-slate-600">{card.main}</span>
                      <span className="block truncate text-[9px] text-slate-400">{card.detail}</span>
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
