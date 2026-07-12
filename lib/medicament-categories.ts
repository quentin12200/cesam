/**
 * Taxonomie des catégories de médicaments du répertoire Pharmacie.
 * Chaque médicament a UNE catégorie principale, utilisée pour le classement
 * et l'identification visuelle. La couleur ne remplace jamais le texte :
 * le nom de la catégorie doit toujours être écrit à côté.
 */

export interface CategorieMedicament {
  code: string;
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const CATEGORIES_MEDICAMENT: CategorieMedicament[] = [
  { code: "ANTIBIOTIQUE", label: "Antibiotique", bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
  { code: "ANTI_INFLAMMATOIRE", label: "Anti-inflammatoire", bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" },
  { code: "VACCIN", label: "Vaccin", bg: "#ffe4e6", text: "#be123c", border: "#fecdd3" },
  { code: "ANTIPARASITAIRE", label: "Antiparasitaire", bg: "#f0e0d0", text: "#6b4423", border: "#e0c4a0" },
  { code: "COMPLEMENT_ALIMENTAIRE", label: "Complément alimentaire", bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" },
  { code: "DIURETIQUE", label: "Diurétique", bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
  { code: "CORTISONE", label: "Cortisone", bg: "#fef9c3", text: "#a16207", border: "#fef08a" },
  { code: "DIURETIQUE_CORTISONE", label: "Diurétique + cortisone", bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  { code: "REHYDRATANT", label: "Réhydratant", bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  { code: "ANTISEPTIQUE", label: "Antiseptique", bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
  { code: "HORMONAL", label: "Hormonal", bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
  { code: "ANESTHESIQUE", label: "Anesthésique", bg: "#cffafe", text: "#0e7490", border: "#a5f3fc" },
  { code: "DIGESTIF", label: "Digestif", bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  { code: "AUTRE", label: "Autre", bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
];

const CATEGORIE_MAP = new Map(CATEGORIES_MEDICAMENT.map((c) => [c.code, c]));

export function getCategorieMedicament(code: string | null | undefined): CategorieMedicament {
  return CATEGORIE_MAP.get(code || "AUTRE") ?? CATEGORIE_MAP.get("AUTRE")!;
}

const VOIE_LABELS: Record<string, string> = {
  IM: "Intramusculaire",
  IV: "Intraveineuse",
  SC: "Sous-cutanée",
  PO: "Orale",
  IMM: "Intramammaire",
  IU: "Intra-utérine",
  TOPIQUE: "Topique",
  ORALE: "Orale",
  INTRAMUSCULAIRE: "Intramusculaire",
  INTRAVEINEUSE: "Intraveineuse",
  "SOUS-CUTANEE": "Sous-cutanée",
  "SOUS CUTANEE": "Sous-cutanée",
};

/** Convertit un code ou texte libre de voie d'administration en mot clair. */
export function formatVoie(voie: string | null | undefined): string | null {
  if (!voie) return null;
  const key = voie.trim().toUpperCase();
  return VOIE_LABELS[key] || voie.trim();
}

const DOSE_BASE_LABELS: Record<string, string> = {
  ANIMAL: "par animal",
  KG: "par kg",
  "100KG": "par 100 kg",
  QUARTIER: "par quartier",
};

export function formatDoseBase(doseBase: string | null | undefined): string | null {
  if (!doseBase) return null;
  return DOSE_BASE_LABELS[doseBase] || doseBase.toLowerCase();
}

/**
 * Reformule les mentions techniques abrégées des précautions en phrases
 * claires, lisibles dans la fiche de consultation quotidienne.
 */
export function formatPrecautions(precautions: string | null | undefined): string | null {
  if (!precautions) return null;
  let text = precautions;
  const replacements: [RegExp, string][] = [
    [/PAS SUR LAITI[EÈ]RES?/gi, "Ne pas utiliser chez les vaches laitières."],
    [/INTERDIT (CHEZ LES )?LAITI[EÈ]RES?/gi, "Interdit chez les vaches laitières."],
    [/NE PAS UTILISER CHEZ LES? GESTANTES?/gi, "Ne pas utiliser chez les femelles gestantes."],
    [/CONTRE[- ]INDIQU[EÉ] GESTATION/gi, "Contre-indiqué pendant la gestation."],
  ];
  for (const [re, repl] of replacements) {
    text = text.replace(re, repl);
  }
  return text;
}

const STATUT_CONSULTATION_LABELS: Record<string, string> = {
  A_VERIFIER: "À vérifier",
  IMPORTE: "À vérifier",
  VALIDE: "Vérifié",
  ARCHIVE: "Archivé",
};

/** Statut d'une préconisation tel qu'affiché dans la fiche de consultation (3 valeurs, sans jargon d'import). */
export function formatStatutConsultation(statut: string | null | undefined): string {
  return STATUT_CONSULTATION_LABELS[statut || ""] || "À vérifier";
}

/** Une préconisation REJETE n'a pas sa place dans la consultation quotidienne. */
export function isVisibleEnConsultation(statut: string | null | undefined): boolean {
  return statut !== "REJETE";
}
