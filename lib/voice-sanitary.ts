import type { PatteParage } from "@/lib/parage";

export const VOICE_SANITARY_STORAGE_KEY = "cesam:brouillon-vocal-sanitaire";

export interface VoiceTarget {
  kind: "animal" | "lot";
  label: string;
  nutravs: string[];
}

export interface VoiceAnimalCandidate {
  nutrav: string;
  nom: string | null;
}

export interface VoiceSanitaryDraft {
  transcript: string;
  target: VoiceTarget | null;
  event: { id: string; nom: string } | null;
  date: string;
  moment: "Matin" | "Soir";
  temperature: number | null;
  pattes: PatteParage[];
  ajouterAuParage: boolean;
  medicament: { id: string; nom: string } | null;
  rappelDemande: boolean;
  traitementMentionne: boolean;
  description: string;
}

export type VoiceAnalysisResponse =
  | { outcome: "draft"; draft: VoiceSanitaryDraft }
  | { outcome: "confirm_animal"; draft: VoiceSanitaryDraft; candidates: VoiceAnimalCandidate[] }
  | { outcome: "note"; reason: string };

export function normaliserNumeroTravail(value: string): string | null {
  const chiffres = value.replace(/\D/g, "");
  if (!chiffres || chiffres.length > 4) return null;
  return chiffres.padStart(4, "0");
}

export function extraireNumeroTravail(texte: string): string | null {
  const match = texte.match(/^\s*(?:(?:animal|vache|veau|velle)\s+)?((?:\d{1,2}\s+\d{1,2})|\d{1,4})(?![\d,.])/i);
  return match ? normaliserNumeroTravail(match[1]) : null;
}

export function extraireTemperature(texteNormalise: string): number | null {
  const match = texteNormalise.match(/(?:^|\s)(3[5-9]|4[0-5])(?:[,.](\d))?(?=\s|$)/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2] ?? "0"}`);
}

export function extrairePattes(texteNormalise: string): PatteParage[] {
  const correspondances: Array<[PatteParage, RegExp]> = [
    ["AVD", /\b(?:avd|avant droit(?:e)?)\b/],
    ["AVG", /\b(?:avg|avant gauche)\b/],
    ["ARD", /\b(?:ard|arriere droit(?:e)?)\b/],
    ["ARG", /\b(?:arg|arriere gauche)\b/],
  ];
  return correspondances.filter(([, expression]) => expression.test(texteNormalise)).map(([patte]) => patte);
}
