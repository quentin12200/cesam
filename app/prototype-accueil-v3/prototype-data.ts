export type PrototypeCategoryId = "reproduction" | "sante" | "troupeau" | "pesee";

export type PrototypeAction = {
  id: string;
  label: string;
  intention: string;
  icon: "thermometer" | "heart" | "stethoscope" | "hoof" | "scale" | "echo" | "baby" | "pill" | "scan" | "tag" | "scissors" | "dna" | "plus" | "logout" | "grid";
  tone: "rose" | "fuchsia" | "blue" | "amber" | "green" | "cyan" | "violet" | "slate" | "red";
  category: PrototypeCategoryId;
  destination: string;
};

export type PrototypeCategory = {
  id: PrototypeCategoryId;
  label: string;
  actions: PrototypeAction[];
};

export const ACTION_CATALOG = {
  chaleur: { id: "chaleur", label: "Chaleur", intention: "Sélectionner l’animal puis ouvrir le formulaire chaleur", icon: "thermometer", tone: "rose", category: "reproduction", destination: "/reproduction" },
  saillie: { id: "saillie", label: "Saillie / IA", intention: "Sélectionner l’animal puis ouvrir le formulaire de saillie ou d’IA", icon: "heart", tone: "fuchsia", category: "reproduction", destination: "/reproduction" },
  echographie: { id: "echographie", label: "Échographie", intention: "Afficher les femelles à échographier et saisir rapidement le résultat", icon: "echo", tone: "amber", category: "reproduction", destination: "/reproduction" },
  velage: { id: "velage", label: "Vêlage", intention: "Ouvrir directement le formulaire de déclaration de vêlage", icon: "baby", tone: "violet", category: "reproduction", destination: "/velage" },
  nouvelEvenement: { id: "nouvel-evenement", label: "Nouvel événement sanitaire", intention: "Ouvrir directement la saisie d’un événement sanitaire", icon: "stethoscope", tone: "blue", category: "sante", destination: "/sanitaire/nouvel-evenement" },
  parage: { id: "parage", label: "Parage", intention: "Ajouter un animal à la liste de parage", icon: "hoof", tone: "amber", category: "sante", destination: "/parage" },
  pharmacie: { id: "pharmacie", label: "Pharmacie", intention: "Ouvrir la pharmacie de l’élevage", icon: "pill", tone: "cyan", category: "sante", destination: "/pharmacie" },
  scannerOrdonnance: { id: "scanner-ordonnance", label: "Scanner une ordonnance", intention: "Ouvrir directement le scanner d’ordonnance", icon: "scan", tone: "slate", category: "sante", destination: "/ordonnances" },
  identification: { id: "identification", label: "Identification", intention: "Ouvrir le suivi des animaux à identifier", icon: "tag", tone: "violet", category: "troupeau", destination: "/troupeau/identification" },
  sevrage: { id: "sevrage", label: "Sevrage", intention: "Ouvrir le suivi du sevrage et du tarissement", icon: "scissors", tone: "cyan", category: "troupeau", destination: "/troupeau/sevrage" },
  genealogie: { id: "genealogie", label: "Généalogie", intention: "Consulter la généalogie du troupeau", icon: "dna", tone: "green", category: "troupeau", destination: "/troupeau/genealogie" },
  ajouterAnimal: { id: "ajouter-animal", label: "Ajouter un animal", intention: "Ouvrir directement le formulaire d’ajout", icon: "plus", tone: "green", category: "troupeau", destination: "/troupeau" },
  sortirAnimal: { id: "sortir-animal", label: "Sortir un animal", intention: "Choisir un animal et renseigner son motif de sortie", icon: "logout", tone: "red", category: "troupeau", destination: "/troupeau" },
  peseeRapide: { id: "pesee-rapide", label: "Pesée rapide", intention: "Démarrer ou reprendre une séance de pesée", icon: "scale", tone: "green", category: "pesee", destination: "/troupeau/pesee" },
  seancesPesee: { id: "seances-pesee", label: "Séances de pesée", intention: "Consulter l’historique des séances de pesée", icon: "grid", tone: "slate", category: "pesee", destination: "/troupeau/pesee/sessions" },
} as const satisfies Record<string, PrototypeAction>;

export const ALL_PROTOTYPE_ACTIONS: PrototypeAction[] = Object.values(ACTION_CATALOG);

export const MAX_FAVORITES = 3;

export const DEFAULT_FAVORITES: PrototypeAction[] = [
  ACTION_CATALOG.chaleur,
  ACTION_CATALOG.saillie,
  ACTION_CATALOG.nouvelEvenement,
];

export const PROTOTYPE_CATEGORIES: PrototypeCategory[] = [
  { id: "reproduction", label: "Reproduction", actions: [ACTION_CATALOG.chaleur, ACTION_CATALOG.saillie, ACTION_CATALOG.echographie, ACTION_CATALOG.velage] },
  { id: "sante", label: "Santé et soins", actions: [ACTION_CATALOG.nouvelEvenement, ACTION_CATALOG.parage, ACTION_CATALOG.pharmacie, ACTION_CATALOG.scannerOrdonnance] },
  { id: "troupeau", label: "Troupeau", actions: [ACTION_CATALOG.identification, ACTION_CATALOG.sevrage, ACTION_CATALOG.genealogie, ACTION_CATALOG.ajouterAnimal, ACTION_CATALOG.sortirAnimal] },
  { id: "pesee", label: "Pesée", actions: [ACTION_CATALOG.peseeRapide, ACTION_CATALOG.seancesPesee] },
];

export const PROTOTYPE_ANIMALS = [
  { number: "9260", name: "Java", detail: "Femelle · 10 mois" },
  { number: "9220", name: "Marius", detail: "Mâle · 11 mois" },
  { number: "9242", name: "Nina", detail: "Femelle · 8 mois" },
  { number: "6393", name: "Lilas", detail: "Vache · pleine" },
];

export const PROTOTYPE_EXIT_REASONS = [
  "B — Boucherie", "C — Autoconsommation", "E — Élevage ou vente", "H — Prêt ou pension", "M — Mort",
];

export function addFavorite(items: PrototypeAction[], action: PrototypeAction): PrototypeAction[] {
  if (items.length >= MAX_FAVORITES || items.some((item) => item.id === action.id)) return items;
  return [...items, action];
}

export function removeFavorite(items: PrototypeAction[], id: string): PrototypeAction[] {
  if (items.length <= 1 || !items.some((item) => item.id === id)) return items;
  return items.filter((item) => item.id !== id);
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

export function getSortableAutoScrollDelta(pointerY: number, top: number, bottom: number): number {
  const edge = 56;
  const maximumStep = 12;
  if (pointerY < top + edge) {
    return -Math.min(maximumStep, Math.max(0, Math.ceil((top + edge - pointerY) / 4)));
  }
  if (pointerY > bottom - edge) {
    return Math.min(maximumStep, Math.max(0, Math.ceil((pointerY - (bottom - edge)) / 4)));
  }
  return 0;
}

export function filterPrototypeAnimals(query: string) {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) return PROTOTYPE_ANIMALS;
  return PROTOTYPE_ANIMALS.filter((animal) =>
    `${animal.number} ${animal.name}`.toLocaleLowerCase("fr-FR").includes(normalized)
  );
}
