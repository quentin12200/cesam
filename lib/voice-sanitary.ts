import type { PatteParage } from "@/lib/parage";
import type { VoiceActionId } from "@/lib/voice-actions";

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

export interface VoiceMedicationCandidate {
  id: string;
  nom: string;
}

export interface VoiceSanitaryDraft {
  transcript: string;
  target: VoiceTarget | null;
  numerosNonTrouves: string[];
  event: { id: string; nom: string } | null;
  date: string | null;
  moment: "Matin" | "Soir" | null;
  dateMentionnee: boolean;
  momentMentionne: boolean;
  temperature: number | null;
  poids: number | null;
  veauSexe: "M" | "F" | null;
  pattes: PatteParage[];
  ajouterAuParage: boolean;
  medicament: { id: string; nom: string } | null;
  medicamentEntendu: string | null;
  medicamentCandidates: VoiceMedicationCandidate[];
  voieAdministration: string | null;
  rappelDemande: boolean;
  traitementMentionne: boolean;
  reproductionType: "NATURELLE" | "IA" | null;
  taureau: { id: string; nom: string; present: boolean } | null;
  description: string;
  suggestedActions: VoiceActionId[];
}

export type VoiceAnalysisResponse =
  | { outcome: "draft"; draft: VoiceSanitaryDraft }
  | { outcome: "choose_action"; draft: VoiceSanitaryDraft }
  | { outcome: "confirm_animal"; draft: VoiceSanitaryDraft; candidates: VoiceAnimalCandidate[] }
  | { outcome: "note"; reason: string };

export function normaliserNumeroTravail(value: string): string | null {
  const chiffres = value.replace(/\D/g, "");
  if (!chiffres || chiffres.length > 4) return null;
  return chiffres.padStart(4, "0");
}

export function extraireNumeroTravail(texte: string): string | null {
  const match = texte.match(/(?:^|\s)((?:\d{1,2}\s+\d{1,2})|\d{1,4})(?![\d,./-])(?=\s|$|[,;])/i);
  return match ? normaliserNumeroTravail(match[1]) : null;
}

export function extraireNumerosTravail(texte: string, numerosTroupeau: string[] = []): string[] {
  const troupeau = new Set(numerosTroupeau.map(normaliserNumeroTravail).filter((numero): numero is string => Boolean(numero)));
  const suitesChiffrees = texte.match(/\d{1,4}(?:\s+\d{1,4})*/g) ?? [];
  const numeros: string[] = [];

  for (const suite of suitesChiffrees) {
    const groupes = suite.match(/\d{1,4}/g) ?? [];
    const solutions = new Array<{ score: number; numeros: string[] } | null>(groupes.length + 1).fill(null);
    solutions[groupes.length] = { score: 0, numeros: [] };

    for (let debut = groupes.length - 1; debut >= 0; debut--) {
      let chiffres = "";
      for (let fin = debut; fin < groupes.length; fin++) {
        chiffres += groupes[fin];
        if (chiffres.length > 4) break;
        const numero = normaliserNumeroTravail(chiffres);
        const suiteSolution = solutions[fin + 1];
        if (!numero || !suiteSolution) continue;
        const score = (troupeau.has(numero) ? 100 : 0) + chiffres.length * chiffres.length + suiteSolution.score;
        if (!solutions[debut] || score > solutions[debut]!.score) {
          solutions[debut] = { score, numeros: [numero, ...suiteSolution.numeros] };
        }
      }
    }

    numeros.push(...(solutions[0]?.numeros ?? []));
  }

  return numeros.filter((numero, index) => numeros.indexOf(numero) === index);
}

export function compactVoiceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function phonetiserMot(value: string): string {
  return compactVoiceText(value)
    .replace(/th/g, "t")
    .replace(/(?:ay|ai|ei)/g, "e")
    .replace(/y/g, "i")
    .replace(/eaux?|aux?/g, "o")
    .replace(/ph/g, "f")
    .replace(/qu/g, "k")
    .replace(/ck/g, "k")
    .replace(/(.)\1+/g, "$1")
    .replace(/[es]$/, "");
}

export function distanceEdition(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const precedent = Array.from({ length: b.length + 1 }, (_, index) => index);
  const courant = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    courant[0] = i;
    for (let j = 1; j <= b.length; j++) {
      courant[j] = Math.min(
        precedent[j] + 1,
        courant[j - 1] + 1,
        precedent[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) precedent[j] = courant[j];
  }
  return precedent[b.length];
}

export function meilleureDistanceDansPhrase(phrase: string, terme: string): number {
  if (!terme) return Number.POSITIVE_INFINITY;
  if (phrase.includes(terme)) return 0;
  let meilleure = Number.POSITIVE_INFINITY;
  const min = Math.max(3, terme.length - 2);
  const max = Math.min(phrase.length, terme.length + 2);
  for (let longueur = min; longueur <= max; longueur++) {
    for (let debut = 0; debut + longueur <= phrase.length; debut++) {
      meilleure = Math.min(meilleure, distanceEdition(phrase.slice(debut, debut + longueur), terme));
    }
  }
  return meilleure;
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
