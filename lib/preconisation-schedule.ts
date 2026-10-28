/** Fréquence conservée dans le champ texte existant, sans convertir les anciennes données. */
export type FrequenceMode = "" | "DOSE_UNIQUE" | "JOUR" | "HEURE" | "INTERVALLE_JOURS" | "AUTRE";

export function lireFrequence(value: string | null | undefined): { mode: FrequenceMode; valeur: string; moments: string } {
  if (!value) return { mode: "", valeur: "", moments: "" };
  if (value === "DOSE_UNIQUE" || value === "Dose unique") return { mode: "DOSE_UNIQUE", valeur: "", moments: "" };
  const quotidien = value.match(/^(\d+)_PAR_JOUR$/);
  if (quotidien) return { mode: "JOUR", valeur: quotidien[1], moments: "" };
  const avecMoments = value.match(/^(\d+) fois par jour \((.+)\)$/);
  if (avecMoments) return { mode: "JOUR", valeur: avecMoments[1], moments: avecMoments[2] };
  const heures = value.match(/^1_PAR_(\d+)H$/);
  if (heures) return { mode: "HEURE", valeur: heures[1], moments: "" };
  const jours = value.match(/^1_PAR_(\d+)_JOURS$/);
  if (jours) return { mode: "INTERVALLE_JOURS", valeur: jours[1], moments: "" };
  if (value === "1_PAR_SEMAINE") return { mode: "INTERVALLE_JOURS", valeur: "7", moments: "" };
  return { mode: "AUTRE", valeur: value, moments: "" };
}

export function ecrireFrequence(mode: FrequenceMode, valeur = "", moments = ""): string {
  if (mode === "DOSE_UNIQUE") return "DOSE_UNIQUE";
  if (mode === "AUTRE") return valeur;
  if (!valeur) return "";
  if (mode === "JOUR") return moments.trim() ? `${valeur} fois par jour (${moments.trim()})` : `${valeur}_PAR_JOUR`;
  if (mode === "HEURE") return `1_PAR_${valeur}H`;
  if (mode === "INTERVALLE_JOURS") return `1_PAR_${valeur}_JOURS`;
  return "";
}

export function formatFrequence(value: string | null | undefined): string {
  const frequence = lireFrequence(value);
  if (frequence.mode === "DOSE_UNIQUE") return "Dose unique";
  if (frequence.mode === "JOUR") return `${frequence.valeur} fois par jour${frequence.moments ? ` (${frequence.moments})` : ""}`;
  if (frequence.mode === "HEURE") return `Toutes les ${frequence.valeur} h`;
  if (frequence.mode === "INTERVALLE_JOURS") return `Tous les ${frequence.valeur} jours`;
  return value || "Non renseignée";
}

const UNITES_DUREE: Record<string, string> = {
  JOUR: "jour(s)", HEURE: "heure(s)", "48H": "période(s) de 48 h", SEMAINE: "semaine(s)", MOIS: "mois",
};

export function formatDureePreconisation(valeur: number, unite: string | null): string {
  return `${valeur} ${UNITES_DUREE[unite ?? "JOUR"] ?? unite}`;
}

export function erreurRythmePreconisation(body: Record<string, unknown>): string | null {
  if (body.frequence != null && typeof body.frequence !== "string") return "La fréquence doit être un texte.";
  const frequence = lireFrequence(body.frequence as string | null | undefined);
  if (["JOUR", "HEURE", "INTERVALLE_JOURS"].includes(frequence.mode)) {
    const valeur = Number(frequence.valeur);
    if (!Number.isSafeInteger(valeur) || valeur < 1) return "La fréquence doit contenir un nombre entier supérieur à zéro.";
  }
  if (frequence.mode === "DOSE_UNIQUE") return null;
  for (const field of ["dureeValeur", "nombreAdministrations"] as const) {
    const valeur = body[field];
    if (valeur === undefined || valeur === null || valeur === "") continue;
    if ((typeof valeur !== "number" && typeof valeur !== "string") || !Number.isSafeInteger(Number(valeur)) || Number(valeur) < 1) {
      return field === "dureeValeur" ? "La durée doit être un nombre entier supérieur à zéro." : "Le nombre total de prises doit être un entier supérieur à zéro.";
    }
  }
  return null;
}
