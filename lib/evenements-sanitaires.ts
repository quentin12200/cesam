export type CategorieEvenementId =
  | "SYMPTOME"
  | "MALADIE"
  | "PREVENTION"
  | "INTERVENTION"
  | "ANALYSE"
  | "AUTRE";

export type GroupeEvenementId = "OBSERVE" | "IDENTIFIE";

export interface GroupeEvenement {
  id: GroupeEvenementId;
  label: string;
}

export const GROUPES_EVENEMENT: GroupeEvenement[] = [
  { id: "OBSERVE", label: "Ce que j'observe" },
  { id: "IDENTIFIE", label: "Ce qui est identifié ou réalisé" },
];

export interface CategorieEvenement {
  id: CategorieEvenementId;
  label: string;
  couleur: string;
  groupe: GroupeEvenementId;
  evenements: string[];
}

export const CATEGORIES_EVENEMENT: CategorieEvenement[] = [
  {
    id: "SYMPTOME",
    label: "Symptôme ou problème constaté",
    couleur: "orange",
    groupe: "OBSERVE",
    evenements: [
      "Boiterie",
      "Diarrhée veau",
      "Toux ou essoufflement",
      "Amaigrissement",
      "Fièvre",
      "Blessure",
      "Problème de peau",
      "Troubles nerveux",
      "Gros nombril",
    ],
  },
  {
    id: "MALADIE",
    label: "Maladie ou diagnostic identifié",
    couleur: "red",
    groupe: "IDENTIFIE",
    evenements: [
      "Piroplasmose",
      "Coccidiose",
      "Mammite",
      "Métrite",
      "BVD",
      "IBR",
      "Paratuberculose",
      "Fièvre de lait",
      "Bronchite vermineuse",
    ],
  },
  {
    id: "PREVENTION",
    label: "Prévention",
    couleur: "green",
    groupe: "IDENTIFIE",
    evenements: [
      "Vaccination",
      "Traitement antiparasitaire",
      "Désinsectisation",
      "Complément en vitamines ou oligo-éléments",
      "Prophylaxie",
    ],
  },
  {
    id: "INTERVENTION",
    label: "Intervention ou soin",
    couleur: "blue",
    groupe: "IDENTIFIE",
    evenements: [
      "Parage",
      "Castration",
      "Écornage ou ébourgeonnage",
      "Pose d'un aimant",
      "Drenchage",
      "Chirurgie",
      "Euthanasie",
      "Césarienne",
      "Non-délivrance",
      "Retournement de matrice",
      "Prolapsus vaginal",
    ],
  },
  {
    id: "ANALYSE",
    label: "Analyse ou contrôle sanitaire",
    couleur: "purple",
    groupe: "IDENTIFIE",
    evenements: [
      "Analyse",
      "Prélèvement",
      "Analyse du colostrum",
      "Contrôle après traitement",
      "Observation ou surveillance",
    ],
  },
  {
    id: "AUTRE",
    label: "Autre événement",
    couleur: "gray",
    groupe: "IDENTIFIE",
    evenements: [],
  },
];

export function getCategoriesParGroupe(groupe: GroupeEvenementId): CategorieEvenement[] {
  return CATEGORIES_EVENEMENT.filter((c) => c.groupe === groupe);
}

export function findCategorieByEvenement(type: string): CategorieEvenement | undefined {
  return CATEGORIES_EVENEMENT.find((c) => c.evenements.includes(type));
}

export function getCategorieLabel(id: string | null | undefined): string {
  return CATEGORIES_EVENEMENT.find((c) => c.id === id)?.label ?? "Autre";
}

export function getMomentActuel(): "Matin" | "Soir" {
  const heure = new Date().getHours();
  return heure < 12 ? "Matin" : "Soir";
}
