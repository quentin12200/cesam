import type { WorkspaceAnimal } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const DEMO_REFERENCE_DATE = new Date("2026-09-02T08:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(DEMO_REFERENCE_DATE.getTime() - days * DAY).toISOString();
}

const motherNames = [
  "Lilas",
  "Daisy",
  "Naya",
  "Prune",
  "Jade",
  "Rumba",
  "Maya",
  "Olive",
  "Perle",
  "Nina",
  "Tess",
  "Java",
  "Pivoine",
  "Roxane",
  "Salsa",
];

const motherStatuses = motherNames.map((_, index) => {
  if (index < 3) return "TO_CHECK" as const;
  if (index < 5) return "EMPTY" as const;
  return "PREGNANT" as const;
});

const mothers: WorkspaceAnimal[] = motherNames.map((name, index) => ({
  id: `demo-mother-${index + 1}`,
  nutrav: String(6201 + index),
  name,
  birthDate: isoDaysAgo((5 + (index % 6)) * 365 + index * 17),
  sex: "F",
  kind: "VACHE",
  groupName: index < 8 ? "Lot des mères" : "Pâture du haut",
  motherId: null,
  motherNutrav: null,
  calfId: `demo-calf-${index + 1}`,
  calfNutrav: String(8101 + index),
  reproductionStatus: motherStatuses[index],
  pregnantMonths: motherStatuses[index] === "PREGNANT" ? 2 + (index % 6) : null,
  echoDue: motherStatuses[index] === "TO_CHECK",
  weaningDue: false,
  treatmentDue: false,
  vaccinationDue: false,
  weightDue: false,
  saleBlocked: index === 3,
  lastWeightKg: null,
  priority: motherStatuses[index] === "EMPTY" ? 3 : motherStatuses[index] === "TO_CHECK" ? 2 : 0,
}));

const calves: WorkspaceAnimal[] = Array.from({ length: 15 }, (_, index) => {
  const mother = mothers[index];
  const weaningDue = index < 8;
  const motherNeedsAttention =
    mother.reproductionStatus === "EMPTY" || mother.reproductionStatus === "TO_CHECK";

  return {
    id: `demo-calf-${index + 1}`,
    nutrav: String(8101 + index),
    name:
      index % 4 === 0
        ? ["Ulysse", "Uma", "Uno", "Uriel"][Math.floor(index / 4)]
        : null,
    birthDate: isoDaysAgo(188 + index * 8),
    sex: index % 3 === 0 ? "F" : "M",
    kind: index % 3 === 0 ? "VELLE" : "VEAU",
    groupName: "Lot des veaux 2026",
    motherId: mother.id,
    motherNutrav: mother.nutrav,
    calfId: null,
    calfNutrav: null,
    reproductionStatus: "NOT_APPLICABLE",
    pregnantMonths: null,
    echoDue: false,
    weaningDue,
    treatmentDue: true,
    vaccinationDue: index === 2 || index === 9,
    weightDue: index >= 8,
    saleBlocked: false,
    lastWeightKg: 305 + index * 9,
    priority: weaningDue && motherNeedsAttention ? 3 : weaningDue ? 2 : 1,
  } satisfies WorkspaceAnimal;
});

const heifers: WorkspaceAnimal[] = Array.from({ length: 6 }, (_, index) => ({
  id: `demo-heifer-${index + 1}`,
  nutrav: String(7301 + index),
  name: ["Suzie", "Sibelle", "Tina", "Toscane", "Soline", "Tulipe"][index],
  birthDate: isoDaysAgo(470 + index * 64),
  sex: "F",
  kind: "GENISSE",
  groupName: index < 3 ? "Génisses 2025" : "Génisses 2024",
  motherId: null,
  motherNutrav: null,
  calfId: null,
  calfNutrav: null,
  reproductionStatus: index === 4 ? "TO_CHECK" : index < 2 ? "PREGNANT" : "EMPTY",
  pregnantMonths: index < 2 ? 3 + index : null,
  echoDue: index === 4,
  weaningDue: false,
  treatmentDue: false,
  vaccinationDue: false,
  weightDue: index === 2 || index === 3,
  saleBlocked: index === 1,
  lastWeightKg: 438 + index * 17,
  priority: index === 4 ? 3 : index >= 2 ? 2 : 0,
}));

export const DEMO_WORKSPACE_ANIMALS: WorkspaceAnimal[] = [
  ...calves,
  ...mothers,
  ...heifers,
];

export const DEMO_SCENARIO_CALF_IDS = calves.map((animal) => animal.id);
export const DEMO_SCENARIO_WEANING_IDS = calves
  .filter((animal) => animal.weaningDue)
  .map((animal) => animal.id);
export const DEMO_SCENARIO_MOTHER_IDS = mothers.slice(0, 8).map((animal) => animal.id);
export const DEMO_SCENARIO_ECHO_MOTHER_IDS = mothers
  .filter((animal) => animal.echoDue)
  .map((animal) => animal.id);
