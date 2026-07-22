import {
  ECHOGRAPHY_WAIT_DAYS,
  POST_CALVING_REST_DAYS,
  REPRODUCTIVE_CYCLE_COLORS,
  VELAGE_IMMINENT_DAYS,
} from "@/lib/utils";

export const REPRODUCTION_RULES_VERSION = 1;

export const REPRODUCTION_COLOR_PALETTE = {
  blue: { label: "Bleu", value: REPRODUCTIVE_CYCLE_COLORS.rest },
  pink: { label: "Rose", value: "#ec4899" },
  red: { label: "Rouge", value: REPRODUCTIVE_CYCLE_COLORS.delay },
  gray: { label: "Gris", value: REPRODUCTIVE_CYCLE_COLORS.waiting },
  yellow: { label: "Jaune", value: REPRODUCTIVE_CYCLE_COLORS.scan },
  green: { label: "Vert", value: REPRODUCTIVE_CYCLE_COLORS.pregnant },
  orange: { label: "Orange", value: REPRODUCTIVE_CYCLE_COLORS.imminent },
  fuchsia: { label: "Fuchsia", value: REPRODUCTIVE_CYCLE_COLORS.service },
} as const;

export type ReproductionColorKey = keyof typeof REPRODUCTION_COLOR_PALETTE;
export type ReproductionPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReproductionUnit = "DAYS" | "WEEKS" | "MONTHS";
export type ReproductionDirection = "BEFORE" | "AFTER";
export type AnimalCategory = "ALL" | "COW" | "HEIFER";
export type ReproductionReference =
  | "CALVING"
  | "BREEDING"
  | "POSITIVE_ECHO"
  | "EXPECTED_CALVING"
  | "BIRTH"
  | "CUSTOM_DATE";
export type ExistingReproductionAction =
  | "NONE"
  | "RECORD_BREEDING"
  | "RECORD_ECHO"
  | "VIEW_FOLLOW_UP"
  | "PREPARE_CALVING"
  | "RECORD_CALVING"
  | "RECORD_HEALTH_EVENT";

export interface ReproductionPhaseRule {
  id: string;
  fundamental: true;
  displayedName: string;
  color: ReproductionColorKey;
  reference: ReproductionReference;
  direction: ReproductionDirection;
  start: number;
  end: number | null;
  unit: ReproductionUnit;
  mainMessage: string;
  priority: ReproductionPriority;
  showOnHome: boolean;
  enabledAlert: boolean;
  action: ExistingReproductionAction;
}

export interface ReproductionActionWindow {
  id: string;
  fundamental: boolean;
  name: string;
  reference: ReproductionReference;
  direction: ReproductionDirection;
  start: number;
  end: number | null;
  unit: ReproductionUnit;
  categories: AnimalCategory[];
  priority: ReproductionPriority;
  showOnHome: boolean;
  showOnCycle: boolean;
  action: ExistingReproductionAction;
}

export interface ReproductionEventRule {
  id: string;
  fundamental: boolean;
  name: string;
  icon: string;
  color: ReproductionColorKey;
  fields: string[];
  showOnCycle: boolean;
  createsReminder: boolean;
}

export interface ReproductionRulesConfig {
  version: number;
  phases: ReproductionPhaseRule[];
  alerts: {
    reproductionDelay: boolean;
    echoDue: boolean;
    imminentCalving: boolean;
    dryOff: boolean;
  };
  actionWindows: ReproductionActionWindow[];
  events: ReproductionEventRule[];
  categoryRules: Array<{
    id: string;
    category: AnimalCategory;
    phaseId: string;
    start?: number;
    end?: number | null;
  }>;
}

export const CESAM_REPRODUCTION_RULES: ReproductionRulesConfig = {
  version: REPRODUCTION_RULES_VERSION,
  phases: [
    { id: "post_calving_rest", fundamental: true, displayedName: "Repos post-vêlage", color: "blue", reference: "CALVING", direction: "AFTER", start: 0, end: POST_CALVING_REST_DAYS, unit: "DAYS", mainMessage: "Repos post-vêlage normal", priority: "NORMAL", showOnHome: true, enabledAlert: true, action: "NONE" },
    { id: "breeding_period", fundamental: true, displayedName: "Mise à la reproduction", color: "fuchsia", reference: "CALVING", direction: "AFTER", start: POST_CALVING_REST_DAYS + 1, end: 80, unit: "DAYS", mainMessage: "Mise à la reproduction recommandée", priority: "NORMAL", showOnHome: true, enabledAlert: true, action: "RECORD_BREEDING" },
    { id: "reproduction_delay", fundamental: true, displayedName: "Retard repro", color: "red", reference: "CALVING", direction: "AFTER", start: 81, end: null, unit: "DAYS", mainMessage: "Remise à la reproduction nécessaire", priority: "URGENT", showOnHome: true, enabledAlert: true, action: "RECORD_BREEDING" },
    { id: "post_breeding_wait", fundamental: true, displayedName: "Attente après saillie / IA", color: "gray", reference: "BREEDING", direction: "AFTER", start: 0, end: ECHOGRAPHY_WAIT_DAYS - 1, unit: "DAYS", mainMessage: "Attente avant diagnostic", priority: "LOW", showOnHome: false, enabledAlert: false, action: "VIEW_FOLLOW_UP" },
    { id: "echo_due", fundamental: true, displayedName: "À échographier", color: "yellow", reference: "BREEDING", direction: "AFTER", start: 40, end: null, unit: "DAYS", mainMessage: "Échographie à réaliser", priority: "HIGH", showOnHome: true, enabledAlert: true, action: "RECORD_ECHO" },
    { id: "pregnancy", fundamental: true, displayedName: "Gestation", color: "green", reference: "POSITIVE_ECHO", direction: "AFTER", start: 0, end: null, unit: "DAYS", mainMessage: "Gestation confirmée", priority: "NORMAL", showOnHome: true, enabledAlert: false, action: "VIEW_FOLLOW_UP" },
    { id: "imminent_calving", fundamental: true, displayedName: "Vêlage imminent", color: "orange", reference: "EXPECTED_CALVING", direction: "BEFORE", start: VELAGE_IMMINENT_DAYS, end: 0, unit: "DAYS", mainMessage: "Préparer le vêlage", priority: "URGENT", showOnHome: true, enabledAlert: true, action: "PREPARE_CALVING" },
  ],
  alerts: { reproductionDelay: true, echoDue: true, imminentCalving: true, dryOff: true },
  actionWindows: [
    { id: "pre_echo", fundamental: true, name: "Pré-écho", reference: "BREEDING", direction: "AFTER", start: ECHOGRAPHY_WAIT_DAYS, end: 39, unit: "DAYS", categories: ["COW", "HEIFER"], priority: "NORMAL", showOnHome: false, showOnCycle: true, action: "VIEW_FOLLOW_UP" },
  ],
  events: [
    { id: "calving", fundamental: true, name: "Vêlage", icon: "calf-heart", color: "pink", fields: ["date", "sexe", "numéro du veau"], showOnCycle: true, createsReminder: false },
    { id: "natural_service", fundamental: true, name: "Saillie naturelle", icon: "female-male", color: "fuchsia", fields: ["date", "taureau"], showOnCycle: true, createsReminder: false },
    { id: "artificial_insemination", fundamental: true, name: "IA", icon: "syringe", color: "fuchsia", fields: ["date", "référence"], showOnCycle: true, createsReminder: false },
    { id: "positive_echo", fundamental: true, name: "Échographie positive", icon: "ultrasound-check", color: "green", fields: ["date", "observation"], showOnCycle: true, createsReminder: false },
    { id: "negative_echo", fundamental: true, name: "Échographie négative", icon: "ultrasound-x", color: "red", fields: ["date", "observation"], showOnCycle: true, createsReminder: false },
  ],
  categoryRules: [],
};

function cloneDefaults(): ReproductionRulesConfig {
  return JSON.parse(JSON.stringify(CESAM_REPRODUCTION_RULES)) as ReproductionRulesConfig;
}

export function parseReproductionRules(raw: string | null | undefined): ReproductionRulesConfig {
  if (!raw) return cloneDefaults();
  try {
    const saved = JSON.parse(raw) as Partial<ReproductionRulesConfig>;
    const defaults = cloneDefaults();
    const savedPhases = Array.isArray(saved.phases) ? saved.phases : [];
    const savedWindows = Array.isArray(saved.actionWindows) ? saved.actionWindows : [];
    const savedEvents = Array.isArray(saved.events) ? saved.events : [];
    return {
      ...defaults,
      ...saved,
      version: REPRODUCTION_RULES_VERSION,
      alerts: { ...defaults.alerts, ...(saved.alerts ?? {}) },
      phases: defaults.phases.map((phase) => ({
        ...phase,
        ...(savedPhases.find((candidate) => candidate?.id === phase.id) ?? {}),
        id: phase.id,
        fundamental: true,
      })),
      actionWindows: [
        ...defaults.actionWindows.filter((windowRule) => windowRule.fundamental).map((windowRule) => ({
          ...windowRule,
          ...(savedWindows.find((candidate) => candidate?.id === windowRule.id) ?? {}),
          id: windowRule.id,
          fundamental: true,
        })),
        ...savedWindows.filter((windowRule) => windowRule && !defaults.actionWindows.some((item) => item.id === windowRule.id)).map((windowRule) => ({ ...windowRule, fundamental: false })),
      ],
      events: [
        ...defaults.events.map((event) => ({
          ...event,
          ...(savedEvents.find((candidate) => candidate?.id === event.id) ?? {}),
          id: event.id,
          fundamental: true,
        })),
        ...savedEvents.filter((event) => event && !defaults.events.some((item) => item.id === event.id)).map((event) => ({ ...event, fundamental: false })),
      ],
      categoryRules: Array.isArray(saved.categoryRules) ? saved.categoryRules : [],
    };
  } catch {
    return cloneDefaults();
  }
}

export function validateReproductionRules(config: ReproductionRulesConfig) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const defaultPhaseIds = new Set(CESAM_REPRODUCTION_RULES.phases.map((phase) => phase.id));
  const phaseIds = new Set(config.phases.map((phase) => phase.id));
  for (const id of defaultPhaseIds) if (!phaseIds.has(id)) errors.push("Une phase fondamentale est absente.");
  if (phaseIds.size !== config.phases.length) errors.push("Deux phases ne peuvent pas avoir le même identifiant.");
  if (new Set(config.actionWindows.map((windowRule) => windowRule.id)).size !== config.actionWindows.length) errors.push("Deux fenêtres d’action ne peuvent pas avoir le même identifiant.");
  if (new Set(config.events.map((event) => event.id)).size !== config.events.length) errors.push("Deux événements ne peuvent pas avoir le même identifiant.");

  for (const rule of [...config.phases, ...config.actionWindows]) {
    const ruleName = "name" in rule ? rule.name : rule.displayedName;
    if (!ruleName.trim()) errors.push("Chaque règle doit avoir un nom.");
    if (rule.start < 0 || (rule.end !== null && rule.end < 0)) errors.push("Les durées négatives sont interdites.");
    if (rule.direction === "AFTER" && rule.end !== null && rule.end < rule.start) errors.push(`La fin de « ${"name" in rule ? rule.name : rule.displayedName} » doit suivre son début.`);
    if (rule.direction === "BEFORE" && rule.end !== null && rule.end > rule.start) errors.push(`La fenêtre avant événement de « ${"name" in rule ? rule.name : rule.displayedName} » est incohérente.`);
  }

  for (const event of config.events) {
    if (!event.name.trim()) errors.push("Chaque événement doit avoir un nom.");
    if (!(event.color in REPRODUCTION_COLOR_PALETTE)) errors.push(`La couleur de « ${event.name} » n’appartient pas à la palette CESAM.`);
  }

  const rest = config.phases.find((phase) => phase.id === "post_calving_rest");
  const breeding = config.phases.find((phase) => phase.id === "breeding_period");
  const delay = config.phases.find((phase) => phase.id === "reproduction_delay");
  const wait = config.phases.find((phase) => phase.id === "post_breeding_wait");
  const echo = config.phases.find((phase) => phase.id === "echo_due");
  if (rest?.end !== null && breeding && breeding.start <= (rest?.end ?? -1)) errors.push("La mise à la reproduction doit commencer après le repos.");
  if (breeding?.end !== null && delay && delay.start <= (breeding?.end ?? -1)) errors.push("Le retard repro doit commencer après la période de mise à la reproduction.");
  if (wait?.end !== null && echo && echo.start <= (wait?.end ?? -1)) errors.push("La phase à échographier doit commencer après l’attente.");

  const windows = config.actionWindows.filter((window) => window.showOnHome || window.showOnCycle);
  for (let index = 0; index < windows.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < windows.length; otherIndex += 1) {
      const left = windows[index];
      const right = windows[otherIndex];
      if (left.reference !== right.reference || left.direction !== right.direction || left.unit !== right.unit) continue;
      const leftEnd = left.end ?? Number.POSITIVE_INFINITY;
      const rightEnd = right.end ?? Number.POSITIVE_INFINITY;
      if (left.start <= rightEnd && right.start <= leftEnd) warnings.push(`Chevauchement possible entre « ${left.name} » et « ${right.name} ».`);
    }
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
