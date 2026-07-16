export const PATTES_PARAGE = [
  { code: "AVD", label: "Avant droit" },
  { code: "AVG", label: "Avant gauche" },
  { code: "ARD", label: "Arrière droit" },
  { code: "ARG", label: "Arrière gauche" },
] as const;

export type PatteParage = (typeof PATTES_PARAGE)[number]["code"];

const CODES = new Set<string>(PATTES_PARAGE.map((patte) => patte.code));

export function normaliserPattes(value: unknown): PatteParage[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((patte): patte is PatteParage => typeof patte === "string" && CODES.has(patte)))];
}

export function lirePattes(value: string): PatteParage[] {
  try {
    return normaliserPattes(JSON.parse(value));
  } catch {
    return normaliserPattes(value.split(/[;,\s]+/));
  }
}
