import type {
  WorkspaceAction,
  WorkspaceAnimal,
  WorkspaceAnimalKind,
} from "./types";

export const KIND_LABELS: Record<WorkspaceAnimalKind, string> = {
  VACHE: "Vache",
  GENISSE: "Génisse",
  VELLE: "Velle",
  VEAU: "Veau",
  TAUREAU: "Taureau",
};

export const ACTION_LABELS: Record<WorkspaceAction, string> = {
  treatment: "Traitement",
  weaning: "Sevrage",
  echo: "Échographie",
};

export function formatAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 +
      now.getMonth() -
      birth.getMonth(),
  );

  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years} ans ${remainder} m.` : `${years} ans`;
}

export function compatibleAnimals(
  action: WorkspaceAction,
  animals: WorkspaceAnimal[],
  completedIds: Set<string>,
): WorkspaceAnimal[] {
  if (action === "weaning") {
    return animals.filter(
      (animal) => animal.weaningDue && !completedIds.has(animal.id),
    );
  }
  if (action === "echo") {
    return animals.filter(
      (animal) => animal.echoDue && !completedIds.has(animal.id),
    );
  }
  return animals.filter((animal) => !completedIds.has(animal.id));
}
