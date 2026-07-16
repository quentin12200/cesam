export const ACCUEIL_SHORTCUT_IDS = [
  "parage",
  "troupeau",
  "reproduction",
  "velage",
  "sanitaire",
  "pharmacie",
  "ordonnances",
  "finances",
  "calendrier-gestation",
  "carnet-sanitaire",
  "identification",
  "taureaux",
] as const;

export type AccueilShortcutId = (typeof ACCUEIL_SHORTCUT_IDS)[number];

export const DEFAULT_ACCUEIL_SHORTCUTS: AccueilShortcutId[] = ["parage"];
export const MAX_ACCUEIL_SHORTCUTS = 6;

const IDS = new Set<string>(ACCUEIL_SHORTCUT_IDS);

export function normaliserAccueilShortcuts(value: unknown): AccueilShortcutId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is AccueilShortcutId => typeof id === "string" && IDS.has(id)))]
    .slice(0, MAX_ACCUEIL_SHORTCUTS);
}
