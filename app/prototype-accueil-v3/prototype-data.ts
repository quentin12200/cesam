export type PrototypeAction = { id: string; label: string };

export type PrototypeCategory = {
  id: "reproduction" | "sante" | "troupeau" | "pesee";
  label: string;
  actions: PrototypeAction[];
};

export const DEFAULT_FAVORITES: PrototypeAction[] = [
  { id: "chaleur", label: "Chaleur" },
  { id: "saillie", label: "Saillie / IA" },
  { id: "evenement", label: "Événement" },
  { id: "parage", label: "Parage" },
  { id: "pesee-rapide", label: "Pesée rapide" },
];

export const PROTOTYPE_CATEGORIES: PrototypeCategory[] = [
  { id: "reproduction", label: "Reproduction", actions: [
    { id: "chaleur", label: "Chaleur" }, { id: "saillie", label: "Saillie / IA" },
    { id: "velage", label: "Vêlage" }, { id: "gestation", label: "Gestation" },
    { id: "taureaux", label: "Taureaux" },
  ] },
  { id: "sante", label: "Santé et soins", actions: [
    { id: "evenement", label: "Événement" }, { id: "parage", label: "Parage" },
    { id: "pharmacie", label: "Pharmacie" }, { id: "ordonnances", label: "Ordonnances" },
    { id: "carnet-sanitaire", label: "Carnet sanitaire" },
  ] },
  { id: "troupeau", label: "Troupeau", actions: [
    { id: "identification", label: "Identification" }, { id: "sevrage", label: "Sevrage" },
    { id: "genealogie", label: "Généalogie" }, { id: "ajouter-animal", label: "Ajouter un animal" },
  ] },
  { id: "pesee", label: "Pesée", actions: [
    { id: "pesee-rapide", label: "Pesée rapide" }, { id: "seances-pesee", label: "Séances de pesée" },
  ] },
];

export const PROTOTYPE_ANIMALS = [
  { number: "9260", name: "Java", detail: "Femelle · 10 mois" },
  { number: "9220", name: "Marius", detail: "Mâle · 11 mois" },
  { number: "9242", name: "Nina", detail: "Femelle · 8 mois" },
  { number: "6393", name: "Lilas", detail: "Vache · pleine" },
];

export function moveFavorite<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function filterPrototypeAnimals(query: string) {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) return PROTOTYPE_ANIMALS;
  return PROTOTYPE_ANIMALS.filter((animal) =>
    `${animal.number} ${animal.name}`.toLocaleLowerCase("fr-FR").includes(normalized)
  );
}
