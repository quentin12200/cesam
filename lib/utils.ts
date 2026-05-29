import { differenceInMonths, differenceInDays, addMonths, addDays } from "date-fns";

// ── Catégories métier ────────────────────────────────────────────────────────
export type CategorieAnimal =
  | "VEAU_M"
  | "VELLE"
  | "PRESELECTION_GENISSE"
  | "PETITE_GENISSE"
  | "MOYENNE_GENISSE"
  | "GRANDE_GENISSE"
  | "TAUREAU"
  | "VACHE";

export const CATEGORIES_LABELS: Record<CategorieAnimal, string> = {
  VEAU_M: "Veau",
  VELLE: "Velle",
  PRESELECTION_GENISSE: "Présélection génisse",
  PETITE_GENISSE: "Petite génisse",
  MOYENNE_GENISSE: "Moyenne génisse",
  GRANDE_GENISSE: "Grande génisse",
  TAUREAU: "Taureau",
  VACHE: "Vache",
};

export const CATEGORIES_FEMELLES: CategorieAnimal[] = [
  "VELLE", "PRESELECTION_GENISSE",
  "PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "VACHE",
];

export const CATEGORIES_MALES: CategorieAnimal[] = ["VEAU_M", "TAUREAU"];

/** Calcule la catégorie automatique si non définie manuellement. */
export function getCategorieAuto(sexbov: string, danais: Date, estGenisse: boolean): CategorieAnimal {
  const ageMois = differenceInMonths(new Date(), danais);
  if (sexbov === "M") {
    return ageMois >= 15 ? "TAUREAU" : "VEAU_M";
  }
  // Toute femelle < 12 mois est VELLE par défaut — passage en génisse = action manuelle
  if (ageMois < 12) return "VELLE";
  if (!estGenisse) return "VACHE";
  if (ageMois < 24) return "MOYENNE_GENISSE";
  return "GRANDE_GENISSE";
}

/** Retourne la catégorie effective (manuelle prioritaire). */
export function getCategorie(
  sexbov: string, danais: Date, estGenisse: boolean, categorie?: string | null
): CategorieAnimal {
  if (categorie && categorie in CATEGORIES_LABELS) return categorie as CategorieAnimal;
  return getCategorieAuto(sexbov, danais, estGenisse);
}

export function getCategorieLabel(
  sexbov: string, danais: Date, estGenisse: boolean, categorie?: string | null
): string {
  const cat = getCategorie(sexbov, danais, estGenisse, categorie);
  return CATEGORIES_LABELS[cat];
}

export function getCategorieColor(cat: CategorieAnimal | string): string {
  switch (cat) {
    case "VACHE": return "bg-purple-100 text-purple-800";
    case "TAUREAU": return "bg-blue-100 text-blue-800";
    case "VEAU_M": return "bg-sky-100 text-sky-800";
    case "VELLE": return "bg-orange-100 text-orange-800";
    case "PRESELECTION_GENISSE": return "bg-yellow-100 text-yellow-800";
    case "PETITE_GENISSE": return "bg-lime-100 text-lime-800";
    case "MOYENNE_GENISSE": return "bg-emerald-100 text-emerald-800";
    case "GRANDE_GENISSE": return "bg-teal-100 text-teal-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

/** Catégories disponibles selon sexe pour le sélecteur de changement. */
export function getCategoriesDisponibles(sexbov: string): CategorieAnimal[] {
  if (sexbov === "M") return CATEGORIES_MALES;
  return CATEGORIES_FEMELLES;
}

// ── Causes de mortalité ────────────────────────────────────────────────────
export const CAUSES_MORTALITE = [
  "ACCIDENT",
  "DIARRHEE",
  "GRIPPE",
  "PNEUMONIE",
  "METEORISATION",
  "AUTRE",
] as const;

export const CAUSES_MORTALITE_LABELS: Record<string, string> = {
  ACCIDENT: "Accident",
  DIARRHEE: "Diarrhée",
  GRIPPE: "Grippe",
  PNEUMONIE: "Pneumonie",
  METEORISATION: "Météorisation",
  AUTRE: "Autre",
};

export function formatAge(danais: Date): string {
  const now = new Date();
  const totalMois = differenceInMonths(now, danais);
  if (totalMois >= 24) {
    const ans = Math.floor(totalMois / 12);
    const moisRestants = totalMois % 12;
    if (moisRestants === 0) return `${ans} an${ans > 1 ? "s" : ""}`;
    return `${ans} an${ans > 1 ? "s" : ""} ${moisRestants} m`;
  }
  const joursRestants = differenceInDays(now, addMonths(danais, totalMois));
  return `${totalMois} m ${joursRestants} j`;
}

export function formatAgeCompact(danais: Date): string {
  const now = new Date();
  const totalMois = differenceInMonths(now, danais);
  if (totalMois >= 24) {
    const ans = Math.floor(totalMois / 12);
    const m = totalMois % 12;
    return m === 0 ? `${ans}a` : `${ans}a${m}m`;
  }
  const j = differenceInDays(now, addMonths(danais, totalMois));
  return j === 0 ? `${totalMois}m` : `${totalMois}m${j}j`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR");
}

export function formatDateShort(date: Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type EtatGestation = "GRIS" | "JAUNE" | "VERT" | "ROUGE" | "ROSE";

export function getEtatGestation(
  derniereSaillie: Date | null,
  gestationEtat: string | null,
  dateVelagePrevue: Date | null,
  dernierVelage: Date | null
): EtatGestation {
  const now = new Date();

  // Vide explicitement confirmé par écho ou annulation manuelle — priorité absolue
  if (gestationEtat === "ROUGE") return "ROUGE";

  // Pleine confirmée par écho
  if (gestationEtat === "VERT") {
    // Vélage imminent (< 30 j)
    if (dateVelagePrevue) {
      const diffJours = differenceInDays(dateVelagePrevue, now);
      if (diffJours >= 0 && diffJours <= 30) return "ROSE";
    }
    return "VERT";
  }

  // Pas de saillie enregistrée
  if (!derniereSaillie) {
    if (dernierVelage) {
      const joursDepuisVelage = differenceInDays(now, dernierVelage);
      if (joursDepuisVelage > 60) return "ROUGE";
    }
    return "ROUGE";
  }

  // Saillie enregistrée — calcul par délai
  // ROUGE ne vient jamais du délai seul : uniquement d'un écho VIDE ou d'un marquage manuel
  const joursDepuisSaillie = differenceInDays(now, derniereSaillie);
  if (joursDepuisSaillie < 35) return "GRIS";
  return "JAUNE";
}

export function getBadgeClass(etat: EtatGestation): string {
  switch (etat) {
    case "VERT": return "bg-green-500 text-white";
    case "JAUNE": return "bg-yellow-400 text-black";
    case "ROUGE": return "bg-red-500 text-white";
    case "ROSE": return "bg-pink-400 text-white";
    case "GRIS": return "bg-gray-400 text-white";
    default: return "bg-gray-400 text-white";
  }
}

export function getEtatLabel(etat: EtatGestation): string {
  switch (etat) {
    case "VERT": return "Pleine confirmée";
    case "JAUNE": return "À échographier";
    case "ROUGE": return "Vide";
    case "ROSE": return "Vélage imminent";
    case "GRIS": return "Saillie récente";
    default: return "Inconnu";
  }
}

// Protocoles vaccins veaux
// ── Protocoles vaccinaux configurables ───────────────────────────────────────

export type ProtocoleVaccinConfig = {
  id: string;
  nom: string;
  label: string;
  ordre: number;
  ageMinJours: number;
  urgenceJours: number | null;
  estRappel: boolean;
  primoNom: string | null;
  delaiRappelJours: number | null;
  urgenceRappelJours: number | null;
  obligatoireVente: boolean;
  voiePrimo: string;
  voieRappel: string;
  rappelAnnuel: boolean;
  actif: boolean;
};

export const DEFAULT_PROTOCOLES: ProtocoleVaccinConfig[] = [
  { id: "proto_1", nom: "NASALGEN",         label: "Nasalgen",         ordre: 1, ageMinJours: 0,  urgenceJours: 7,    estRappel: false, primoNom: null,           delaiRappelJours: null, urgenceRappelJours: null, obligatoireVente: false, voiePrimo: "IN", voieRappel: "IM", rappelAnnuel: false, actif: true },
  { id: "proto_2", nom: "NASALGEN_RAPPEL",  label: "Nasalgen rappel",  ordre: 2, ageMinJours: 0,  urgenceJours: null, estRappel: true,  primoNom: "NASALGEN",     delaiRappelJours: 90,   urgenceRappelJours: 105,  obligatoireVente: false, voiePrimo: "IM", voieRappel: "IM", rappelAnnuel: true,  actif: true },
  { id: "proto_3", nom: "HIPRABOVIS",       label: "Hiprabovis",       ordre: 3, ageMinJours: 30, urgenceJours: 60,   estRappel: false, primoNom: null,           delaiRappelJours: null, urgenceRappelJours: null, obligatoireVente: false, voiePrimo: "SC", voieRappel: "SC", rappelAnnuel: false, actif: true },
  { id: "proto_4", nom: "HIPRABOVIS_RAPPEL",label: "Hiprabovis rappel",ordre: 4, ageMinJours: 0,  urgenceJours: null, estRappel: true,  primoNom: "HIPRABOVIS",   delaiRappelJours: 21,   urgenceRappelJours: 35,   obligatoireVente: false, voiePrimo: "SC", voieRappel: "SC", rappelAnnuel: true,  actif: true },
  { id: "proto_5", nom: "MHE",              label: "MHE primo",        ordre: 5, ageMinJours: 60, urgenceJours: 60,   estRappel: false, primoNom: null,           delaiRappelJours: null, urgenceRappelJours: null, obligatoireVente: true,  voiePrimo: "SC", voieRappel: "SC", rappelAnnuel: false, actif: true },
  { id: "proto_6", nom: "MHE_RAPPEL",       label: "MHE rappel",       ordre: 6, ageMinJours: 0,  urgenceJours: null, estRappel: true,  primoNom: "MHE",          delaiRappelJours: 21,   urgenceRappelJours: 35,   obligatoireVente: true,  voiePrimo: "SC", voieRappel: "SC", rappelAnnuel: true,  actif: true },
];

export type VaccinInfo = {
  vaccin: string;
  raison: string;
  urgent: boolean;
};

export function getVaccinsManquants(
  danais: Date,
  vaccinations: { vaccin: string; date: Date }[],
  protocoles: ProtocoleVaccinConfig[] = DEFAULT_PROTOCOLES
): VaccinInfo[] {
  const now = new Date();
  const ageJours = differenceInDays(now, danais);
  const manquants: VaccinInfo[] = [];
  const aVaccin = (nom: string) => vaccinations.some((v) => v.vaccin === nom);
  const actifs = protocoles.filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);

  for (const proto of actifs) {
    if (proto.estRappel) {
      const primo = proto.primoNom ? vaccinations.find((v) => v.vaccin === proto.primoNom) : null;
      if (!primo || aVaccin(proto.nom)) continue;
      const joursDepuis = differenceInDays(now, primo.date);
      const delai = proto.delaiRappelJours ?? 21;
      const urgence = proto.urgenceRappelJours ?? delai + 14;
      if (joursDepuis >= delai) {
        manquants.push({ vaccin: proto.nom, raison: `${proto.label} (+${delai}j)`, urgent: joursDepuis > urgence });
      }
    } else {
      if (ageJours >= proto.ageMinJours && !aVaccin(proto.nom)) {
        const urgence = proto.urgenceJours ?? proto.ageMinJours;
        manquants.push({ vaccin: proto.nom, raison: proto.label, urgent: ageJours > urgence });
      }
    }
  }

  return manquants;
}

export function isMheVendable(vaccinations: { vaccin: string; date: Date }[]): {
  vendable: boolean;
  reason: string;
} {
  const mhe = vaccinations.find((v) => v.vaccin === "MHE");
  const mheRappel = vaccinations.find((v) => v.vaccin === "MHE_RAPPEL");

  if (!mhe) return { vendable: false, reason: "MHE primo manquant" };
  if (!mheRappel) return { vendable: false, reason: "MHE rappel manquant" };

  const joursDepuisRappel = differenceInDays(new Date(), mheRappel.date);
  if (joursDepuisRappel < 10) {
    return { vendable: false, reason: `J+${joursDepuisRappel}/10 après rappel MHE` };
  }
  return { vendable: true, reason: "MHE complet" };
}

// Protocol vaccinal — statut visuel par étape
export type StepStatus = "done" | "due" | "pending" | "not_eligible";

export interface ProtocolStep {
  vaccin: string;
  label: string;
  status: StepStatus;
  doneDate?: Date;
  eligibleDate?: Date;
  dueFrom?: Date;
  isRappel: boolean;
  isMandatory: boolean;
  isUrgent: boolean;
  voie: string;
}

export function getVaccinProtocolSteps(
  danais: Date,
  vaccinations: { vaccin: string; date: Date }[],
  protocoles: ProtocoleVaccinConfig[] = DEFAULT_PROTOCOLES
): ProtocolStep[] {
  const now = new Date();
  const ageJours = differenceInDays(now, danais);
  const steps: ProtocolStep[] = [];
  const get = (nom: string) => vaccinations.find((v) => v.vaccin === nom);
  const actifs = protocoles.filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);

  for (const proto of actifs) {
    if (proto.estRappel) {
      const primo = proto.primoNom ? get(proto.primoNom) : null;
      if (!primo) continue;
      const joursDepuis = differenceInDays(now, primo.date);
      const delai = proto.delaiRappelJours ?? 21;
      const urgence = proto.urgenceRappelJours ?? delai + 14;
      const rappel = get(proto.nom);
      steps.push({
        vaccin: proto.nom,
        label: proto.label,
        status: rappel ? "done" : joursDepuis >= delai ? "due" : "pending",
        doneDate: rappel?.date,
        eligibleDate: joursDepuis < delai ? addDays(primo.date, delai) : undefined,
        dueFrom: !rappel && joursDepuis >= delai ? addDays(primo.date, delai) : undefined,
        isRappel: true,
        isMandatory: proto.obligatoireVente,
        isUrgent: !rappel && joursDepuis > urgence,
        voie: proto.voieRappel ?? "IM",
      });
    } else {
      const vacc = get(proto.nom);
      const eligible = ageJours >= proto.ageMinJours;
      const urgence = proto.urgenceJours ?? proto.ageMinJours;
      steps.push({
        vaccin: proto.nom,
        label: proto.label,
        status: vacc ? "done" : eligible ? "due" : "not_eligible",
        doneDate: vacc?.date,
        eligibleDate: !eligible ? addDays(danais, proto.ageMinJours) : undefined,
        dueFrom: !vacc && eligible ? addDays(danais, proto.ageMinJours) : undefined,
        isRappel: false,
        isMandatory: proto.obligatoireVente,
        isUrgent: !vacc && ageJours > urgence,
        voie: proto.voiePrimo ?? "IM",
      });
    }
  }

  return steps;
}

// unused but exported for convenience
export { addDays };
