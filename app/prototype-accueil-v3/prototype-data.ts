export type PrototypeAction = { id: string; label: string; intention: string };

export type PrototypeCategory = {
  id: "reproduction" | "sante" | "troupeau" | "pesee";
  label: string;
  actions: PrototypeAction[];
};

export const DEFAULT_FAVORITES: PrototypeAction[] = [
  { id: "chaleur", label: "Chaleur", intention: "Sélectionner l’animal puis ouvrir le formulaire chaleur" },
  { id: "saillie", label: "Saillie / IA", intention: "Sélectionner l’animal puis ouvrir le formulaire de saillie ou d’IA" },
  { id: "nouvel-evenement", label: "Nouvel événement sanitaire", intention: "Ouvrir directement la saisie d’un événement sanitaire" },
  { id: "parage", label: "Parage", intention: "Ajouter un animal à la liste de parage" },
  { id: "pesee-rapide", label: "Pesée rapide", intention: "Démarrer ou reprendre une séance de pesée" },
];

export const PROTOTYPE_CATEGORIES: PrototypeCategory[] = [
  { id: "reproduction", label: "Reproduction", actions: [
    DEFAULT_FAVORITES[0], DEFAULT_FAVORITES[1],
    { id: "echographie", label: "Échographie", intention: "Afficher les femelles à échographier et saisir rapidement le résultat" },
    { id: "velage", label: "Vêlage", intention: "Ouvrir directement le formulaire de déclaration de vêlage" },
  ] },
  { id: "sante", label: "Santé et soins", actions: [
    DEFAULT_FAVORITES[2], DEFAULT_FAVORITES[3],
    { id: "pharmacie", label: "Pharmacie", intention: "Ouvrir la pharmacie de l’élevage" },
    { id: "scanner-ordonnance", label: "Scanner une ordonnance", intention: "Ouvrir directement le scanner d’ordonnance" },
  ] },
  { id: "troupeau", label: "Troupeau", actions: [
    { id: "identification", label: "Identification", intention: "Ouvrir le suivi des animaux à identifier" },
    { id: "sevrage", label: "Sevrage", intention: "Ouvrir le suivi du sevrage et du tarissement" },
    { id: "genealogie", label: "Généalogie", intention: "Consulter la généalogie du troupeau" },
    { id: "ajouter-animal", label: "Ajouter un animal", intention: "Ouvrir directement le formulaire d’ajout" },
    { id: "sortir-animal", label: "Sortir un animal", intention: "Choisir un animal et renseigner son motif de sortie" },
  ] },
  { id: "pesee", label: "Pesée", actions: [
    DEFAULT_FAVORITES[4],
    { id: "seances-pesee", label: "Séances de pesée", intention: "Consulter l’historique des séances de pesée" },
  ] },
];

export const PROTOTYPE_ANIMALS = [
  { number: "9260", name: "Java", detail: "Femelle · 10 mois" },
  { number: "9220", name: "Marius", detail: "Mâle · 11 mois" },
  { number: "9242", name: "Nina", detail: "Femelle · 8 mois" },
  { number: "6393", name: "Lilas", detail: "Vache · pleine" },
];

export const PROTOTYPE_EXIT_REASONS = [
  "B — Boucherie",
  "C — Autoconsommation",
  "E — Élevage ou vente",
  "H — Prêt ou pension",
  "M — Mort",
];

export function moveFavorite<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderActions<T extends { id: string }>(items: T[], draggedId: string, targetId: string): T[] {
  const from = items.findIndex((item) => item.id === draggedId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [dragged] = next.splice(from, 1);
  next.splice(to, 0, dragged);
  return next;
}

export function filterPrototypeAnimals(query: string) {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) return PROTOTYPE_ANIMALS;
  return PROTOTYPE_ANIMALS.filter((animal) =>
    `${animal.number} ${animal.name}`.toLocaleLowerCase("fr-FR").includes(normalized)
  );
}
