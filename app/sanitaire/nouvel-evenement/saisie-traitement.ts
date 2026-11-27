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

function baseEnKg(doseBase: string | null): number | null {
  const base = doseBase?.trim().toUpperCase();
  if (base === "KG") return 1;
  const multiple = base?.match(/^(\d+(?:[.,]\d+)?)\s*KG$/);
  const kg = Number(multiple?.[1].replace(",", "."));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

export function formatBaseKg(doseBase: string | null): string | null {
  const kg = baseEnKg(doseBase);
  if (kg === null) return null;
  return kg === 1 ? "par kg" : `par ${kg.toLocaleString("fr")} kg`;
}

export function preconisationsPourVoie<T extends { voie: string | null }>(preconisations: T[], voie: string): T[] {
  const code = voie.trim().toUpperCase();
  return code ? preconisations.filter((item) => item.voie?.trim().toUpperCase() === code) : [];
}

export function referencePourCalcul(preconisations: Preconisation[], voie: string): ReferenceDose | null {
  const pourVoie = preconisationsPourVoie(preconisations, voie);
  if (pourVoie.length !== 1) return null;
  const reference = pourVoie[0];
  const unite = reference.unite?.trim();
  const baseKg = baseEnKg(reference.doseBase);
  if (reference.statut !== "VALIDE" || !reference.dose || reference.dose <= 0 ||
      !Number.isFinite(reference.dose) || !unite || baseKg === null) return null;
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
