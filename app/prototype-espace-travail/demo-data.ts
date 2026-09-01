import type { WorkspaceAnimal } from "./types";

const DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
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
  calfNutrav: String(8101 + index),
  echoDue: index < 3,
  weaningDue: false,
  saleBlocked: false,
}));

const calves: WorkspaceAnimal[] = Array.from({ length: 15 }, (_, index) => ({
  id: `demo-calf-${index + 1}`,
  nutrav: String(8101 + index),
  name:
    index % 4 === 0
      ? ["Ulysse", "Uma", "Uno", "Uriel"][Math.floor(index / 4)]
      : null,
  birthDate: isoDaysAgo(182 + index * 8),
  sex: index % 3 === 0 ? "F" : "M",
  kind: index % 3 === 0 ? "VELLE" : "VEAU",
  groupName: "Lot des veaux 2026",
  motherId: mothers[index].id,
  motherNutrav: mothers[index].nutrav,
  calfNutrav: null,
  echoDue: false,
  weaningDue: index < 8,
  saleBlocked: false,
}));

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
  calfNutrav: null,
  echoDue: index === 4,
  weaningDue: false,
  saleBlocked: index === 1,
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
