export type CategorieEvenementId =
  | "SYMPTOME"
  | "MALADIE"
  | "PREVENTION"
  | "INTERVENTION"
  | "ANALYSE"
  | "AUTRE";

export interface CategorieEvenement {
  id: CategorieEvenementId;
  label: string;
  couleur: string;
  evenements: string[];
}

export const CATEGORIES_EVENEMENT: CategorieEvenement[] = [
  {
    id: "SYMPTOME",
    label: "Symptôme ou problème constaté",
    couleur: "orange",
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
    evenements: [],
  },
];

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
