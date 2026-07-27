"use client";

import { useMemo, useState } from "react";
import { addDays, startOfDay, subDays } from "date-fns";
import { GESTATION_REFERENCE_DAYS } from "@/lib/gestation-progress";
import ReproductiveCycleTimeline, {
  type ReproductiveCycleTimelineProps,
} from "./ReproductiveCycleTimeline";

type ScenarioId =
  | "real"
  | "rest"
  | "breeding"
  | "delay"
  | "waiting"
  | "pre-echo"
  | "echo-due"
  | "echo-negative"
  | "pregnant"
  | "imminent"
  | "close-events";

export interface ReproductionPreviewRules {
  breedingStartDays: number;
  reproductionDelayDays: number;
  echoPreparationEnabled: boolean;
  echoPreparationDays: number;
  echoDueDays: number;
  imminentCalvingDays: number;
}

interface Props {
  realProps: ReproductiveCycleTimelineProps;
  rules: ReproductionPreviewRules;
}

function boundedPreferred(preferred: number, minimum: number, maximum: number) {
  return Math.min(Math.max(preferred, minimum), Math.max(minimum, maximum));
}

function scenarioTiming(rules: ReproductionPreviewRules) {
  const breedingStartDays = Math.max(1, rules.breedingStartDays);
  const reproductionDelayDays = Math.max(breedingStartDays + 1, rules.reproductionDelayDays);
  const echoDueDays = Math.max(1, rules.echoDueDays);
  const echoPreparationDays = rules.echoPreparationEnabled
    ? Math.min(Math.max(0, rules.echoPreparationDays), echoDueDays)
    : echoDueDays;

  return {
    restDays: Math.min(34, Math.max(1, breedingStartDays - 1)),
    breedingDays: boundedPreferred(65, breedingStartDays, reproductionDelayDays - 1),
    delayDays: Math.max(85, reproductionDelayDays + 4),
    waitingDays: Math.min(20, Math.max(1, echoPreparationDays - 1)),
    preEchoDays: rules.echoPreparationEnabled && echoPreparationDays < echoDueDays
      ? boundedPreferred(37, echoPreparationDays, echoDueDays - 1)
      : Math.max(1, echoDueDays - 1),
    echoDueDays: Math.max(52, echoDueDays + 12),
    echoThresholdDays: echoDueDays,
    imminentDays: Math.min(3, Math.max(1, rules.imminentCalvingDays)),
  };
}

function simulatedBase(
  realProps: ReproductiveCycleTimelineProps,
  lastCalvingDate: Date
): ReproductiveCycleTimelineProps {
  return {
    ...realProps,
    status: "REPOS",
    breedingDate: null,
    breedingType: null,
    dueDate: null,
    echoDate: null,
    echoResult: null,
    echoObservation: null,
    lastCalvingDate,
    calfNumber: "TEST",
    calfSex: "F",
    calfBirthDate: lastCalvingDate,
    calfSevreDone: true,
    breedingReference: null,
    statusModifiedAt: lastCalvingDate,
    dryOffDone: true,
    dryOffDate: null,
  };
}

function buildScenarioProps(
  scenario: ScenarioId,
  realProps: ReproductiveCycleTimelineProps,
  rules: ReproductionPreviewRules,
  today: Date
): ReproductiveCycleTimelineProps {
  if (scenario === "real") return realProps;

  const timing = scenarioTiming(rules);
  const calvingBeforeBreeding = (breedingDate: Date) =>
    subDays(breedingDate, Math.max(1, realProps.restObjectiveDays));
  const withBreeding = (
    breedingDate: Date,
    breedingType: "IA" | "SAILLIE" = "IA"
  ) => ({
    ...simulatedBase(realProps, calvingBeforeBreeding(breedingDate)),
    breedingDate,
    breedingType,
    breedingReference: breedingType === "IA" ? "TEST-IA" : "TEST-TAUREAU",
  });

  if (scenario === "rest") {
    const lastCalvingDate = subDays(today, timing.restDays);
    return simulatedBase(realProps, lastCalvingDate);
  }

  if (scenario === "breeding") {
    const lastCalvingDate = subDays(today, timing.breedingDays);
    return {
      ...simulatedBase(realProps, lastCalvingDate),
      status: "ROUGE",
      statusModifiedAt: addDays(lastCalvingDate, realProps.restObjectiveDays),
    };
  }

  if (scenario === "delay") {
    const lastCalvingDate = subDays(today, timing.delayDays);
    return {
      ...simulatedBase(realProps, lastCalvingDate),
      status: "ROUGE",
      statusModifiedAt: addDays(lastCalvingDate, realProps.restObjectiveDays),
    };
  }

  if (scenario === "waiting" || scenario === "pre-echo" || scenario === "echo-due") {
    const breedingAge =
      scenario === "waiting"
        ? timing.waitingDays
        : scenario === "pre-echo"
          ? timing.preEchoDays
          : timing.echoDueDays;
    return {
      ...withBreeding(subDays(today, breedingAge)),
      status: scenario === "echo-due" ? "JAUNE" : "GRIS",
      statusModifiedAt: subDays(today, breedingAge),
    };
  }

  if (scenario === "echo-negative") {
    const echoDate = subDays(today, 4);
    const breedingDate = subDays(echoDate, timing.echoThresholdDays);
    return {
      ...withBreeding(breedingDate, "SAILLIE"),
      status: "ROUGE",
      echoDate,
      echoResult: "VIDE",
      echoObservation: "Observation de test",
      statusModifiedAt: echoDate,
    };
  }

  if (scenario === "pregnant") {
    const echoDate = subDays(today, 150);
    const breedingDate = subDays(echoDate, timing.echoThresholdDays);
    return {
      ...withBreeding(breedingDate),
      status: "VERT",
      echoDate,
      echoResult: "PLEINE",
      echoObservation: "Gestation confirmée — scénario de test",
      dueDate: addDays(breedingDate, GESTATION_REFERENCE_DAYS),
      statusModifiedAt: echoDate,
    };
  }

  if (scenario === "imminent") {
    const dueDate = addDays(today, timing.imminentDays);
    const breedingDate = subDays(dueDate, GESTATION_REFERENCE_DAYS);
    const echoDate = addDays(breedingDate, timing.echoThresholdDays);
    return {
      ...withBreeding(breedingDate, "SAILLIE"),
      status: "ROSE",
      echoDate,
      echoResult: "PLEINE",
      echoObservation: "Gestation confirmée — scénario de test",
      dueDate,
      statusModifiedAt: echoDate,
    };
  }

  const breedingDate = subDays(today, 12);
  const echoDate = addDays(breedingDate, 3);
  return {
    ...withBreeding(breedingDate),
    status: "VERT",
    echoDate,
    echoResult: "PLEINE",
    echoObservation: "Événements rapprochés — scénario de test",
    dueDate: addDays(breedingDate, GESTATION_REFERENCE_DAYS),
    statusModifiedAt: echoDate,
  };
}

export default function ReproductiveCyclePreview({ realProps, rules }: Props) {
  const [scenario, setScenario] = useState<ScenarioId>("real");
  const [previewToday] = useState(() => startOfDay(new Date()));
  const timing = useMemo(() => scenarioTiming(rules), [rules]);
  const displayedProps = useMemo(
    () => buildScenarioProps(scenario, realProps, rules, previewToday),
    [previewToday, realProps, rules, scenario]
  );

  const options: Array<{ id: ScenarioId; label: string }> = [
    { id: "real", label: "Données réelles" },
    { id: "rest", label: `Repos post-vêlage — J${timing.restDays}` },
    { id: "breeding", label: `Mise à la reproduction — J${timing.breedingDays}` },
    { id: "delay", label: `Retard repro — J${timing.delayDays}` },
    { id: "waiting", label: `Attente post-saillie — saillie depuis ${timing.waitingDays} jours` },
    { id: "pre-echo", label: `Bientôt prête pour l’échographie — saillie depuis ${timing.preEchoDays} jours` },
    { id: "echo-due", label: `À échographier — saillie depuis ${timing.echoDueDays} jours` },
    { id: "echo-negative", label: "Échographie négative — réalisée depuis 4 jours" },
    { id: "pregnant", label: "Gestante — gestation confirmée depuis 150 jours" },
    { id: "imminent", label: `Vêlage imminent — J-${timing.imminentDays}` },
    { id: "close-events", label: "Événements rapprochés — saillie et échographie proches" },
  ];

  return (
    <>
      <section className="mb-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3 shadow-sm" aria-label="Prévisualisation du cycle">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-violet-900">Prévisualisation du cycle</p>
            <p className="text-[11px] text-violet-700">Vache test 0000 · affichage uniquement</p>
          </div>
          <label className="min-w-0 sm:w-[min(100%,430px)]">
            <span className="sr-only">Scénario de test</span>
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as ScenarioId)}
              className="min-h-11 w-full rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        {scenario !== "real" && (
          <p className="mt-2 rounded-lg bg-violet-700 px-3 py-2 text-center text-xs font-extrabold uppercase tracking-wide text-white">
            Mode test — aucune donnée enregistrée
          </p>
        )}
      </section>
      <ReproductiveCycleTimeline key={scenario} {...displayedProps} />
    </>
  );
}
