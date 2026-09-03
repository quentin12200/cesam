import type {
  ReproductionStatus,
  WorkspaceAction,
  WorkspaceAnimal,
  WorkspaceAnimalKind,
  WorkspaceCompletedState,
  WorkspaceRow,
  WorkspaceView,
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
  vaccination: "Vaccination",
  echo: "Échographie",
  weaning: "Sevrage",
  move: "Changement de lot",
  weight: "Pesée",
  sale: "Sortie / vente",
};

export const REPRODUCTION_LABELS: Record<ReproductionStatus, string> = {
  PREGNANT: "Gestante",
  EMPTY: "Vide",
  TO_CHECK: "À contrôler",
  NOT_APPLICABLE: "—",
};

export const EMPTY_COMPLETED_STATE: WorkspaceCompletedState = {
  treatment: [],
  vaccination: [],
  echo: [],
  weaning: [],
  move: [],
  weight: [],
  sale: [],
};

export function formatAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);

  if (months < 24) {
    const monthAnniversary = new Date(
      birth.getFullYear(),
      birth.getMonth() + months,
      birth.getDate(),
    );
    const days = Math.max(
      0,
      Math.floor((now.getTime() - monthAnniversary.getTime()) / 86_400_000),
    );
    return `${months} m ${days} j`;
  }

  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years} ans ${remainder} m` : `${years} ans`;
}

export function buildWorkspaceRows(
  view: WorkspaceView,
  animals: WorkspaceAnimal[],
  completed: WorkspaceCompletedState,
): WorkspaceRow[] {
  const byId = new Map(animals.map((animal) => [animal.id, animal]));
  const isYoung = (animal: WorkspaceAnimal) =>
    animal.kind === "VEAU" || animal.kind === "VELLE";
  const isFemaleAdult = (animal: WorkspaceAnimal) =>
    animal.kind === "VACHE" || animal.kind === "GENISSE";

  let primaryAnimals: WorkspaceAnimal[];
  if (view === "young-related") {
    primaryAnimals = animals.filter(isYoung);
  } else if (view === "weaning") {
    primaryAnimals = animals.filter(
      (animal) =>
        isYoung(animal) &&
        animal.weaningDue &&
        !completed.weaning.includes(animal.id),
    );
  } else if (view === "cows") {
    primaryAnimals = animals.filter((animal) => animal.kind === "VACHE");
  } else if (view === "reproduction") {
    primaryAnimals = animals.filter(isFemaleAdult);
  } else if (view === "today") {
    const linkedMotherIds = new Set(
      animals
        .filter(isYoung)
        .map((animal) => animal.motherId)
        .filter((id): id is string => Boolean(id)),
    );
    primaryAnimals = animals.filter((animal) => {
      if (isYoung(animal)) {
        return (
          animal.treatmentDue ||
          animal.vaccinationDue ||
          animal.weaningDue ||
          animal.weightDue
        );
      }
      return animal.echoDue && !linkedMotherIds.has(animal.id);
    });
  } else {
    primaryAnimals = animals;
  }

  return primaryAnimals.map((primary) => {
    const relatedId = isYoung(primary) ? primary.motherId : primary.calfId;
    return {
      id: `${view}:${primary.id}`,
      primary,
      related: relatedId ? byId.get(relatedId) ?? null : null,
    };
  });
}

export function compatibleAnimals(
  action: WorkspaceAction,
  animals: WorkspaceAnimal[],
  completedIds: Set<string>,
): WorkspaceAnimal[] {
  return animals.filter((animal) => {
    if (action === "weaning") {
      return (
        (animal.kind === "VEAU" || animal.kind === "VELLE") &&
        !completedIds.has(animal.id)
      );
    }
    if (action === "echo") {
      return animal.kind === "VACHE" || animal.kind === "GENISSE";
    }
    return true;
  });
}

export function animalActionsDue(animal: WorkspaceAnimal): WorkspaceAction[] {
  const actions: WorkspaceAction[] = [];
  if (animal.treatmentDue) actions.push("treatment");
  if (animal.vaccinationDue) actions.push("vaccination");
  if (animal.echoDue) actions.push("echo");
  if (animal.weaningDue) actions.push("weaning");
  if (animal.weightDue) actions.push("weight");
  return actions;
}

export function completedActionsForAnimal(
  animalId: string,
  completed: WorkspaceCompletedState,
): WorkspaceAction[] {
  return (Object.keys(completed) as WorkspaceAction[]).filter((action) =>
    completed[action].includes(animalId),
  );
}
