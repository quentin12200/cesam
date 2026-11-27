type Preconisation = {
  id: string;
  statut: string;
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
};

export type ReferenceDose = {
  id: string;
  dose: number;
  unite: string;
  baseKg: number;
};

export function referencePourCalcul(preconisations: Preconisation[], voie: string): ReferenceDose | null {
  const validees = preconisations.filter((item) => item.statut === "VALIDE");
  if (validees.length !== 1) return null;
  const reference = validees[0];
  const unite = reference.unite?.trim();
  const base = reference.doseBase?.trim().toUpperCase();
  const multiple = base?.match(/^(\d+(?:[.,]\d+)?)\s*KG$/);
  const baseKg = base === "KG" ? 1 : Number(multiple?.[1].replace(",", "."));
  if (!reference.dose || reference.dose <= 0 || !Number.isFinite(reference.dose) || !unite ||
      !Number.isFinite(baseKg) || baseKg <= 0) return null;
  if (reference.voie && reference.voie.trim().toUpperCase() !== voie.trim().toUpperCase()) return null;
  return { id: reference.id, dose: reference.dose, unite, baseKg };
}

export function calculerDose(reference: ReferenceDose, valeurPoids: string): string | null {
  const poids = Number(valeurPoids.replace(",", "."));
  if (!Number.isFinite(poids) || poids <= 0) return null;
  const dose = poids * reference.dose / reference.baseKg;
  return Number.isFinite(dose) && dose > 0 ? String(Number(dose.toPrecision(12))) : null;
}

function rangExecutant(nom: string): number {
  const prenom = nom.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/)[0];
  if (prenom === "celine") return 0;
  if (prenom === "samuel") return 1;
  return 2;
}

export function preparerExecutants<T extends { nom: string }>(intervenants: T[]): {
  ordonnes: T[];
  parDefaut: string;
} {
  const ordonnes = [...intervenants].sort((a, b) =>
    rangExecutant(a.nom) - rangExecutant(b.nom) || a.nom.localeCompare(b.nom, "fr"));
  const candidates = ordonnes.filter((personne) => rangExecutant(personne.nom) === 0);
  return { ordonnes, parDefaut: candidates.length === 1 ? candidates[0].nom : "" };
}
