import type { StatutProtocoleVaccinal } from "./vaccine-planner.ts";

interface EtapeStatut {
  id: string;
  cycle: string;
  obligatoire: boolean;
}

/** Même règle que l'enregistrement d'une séance : type d'injection déduit de l'étape configurée. */
export function typeInjectionPourEtape(etapes: readonly { id: string; ordre: number; cycle: string }[], etapeId: string): "PRIMO_1" | "RAPPEL" | "ENTRETIEN" | null {
  const etape = etapes.find((item) => item.id === etapeId);
  if (!etape) return null;
  if (etape.cycle === "ENTRETIEN") return "ENTRETIEN";
  const premiere = etapes.filter((item) => item.cycle !== "ENTRETIEN").sort((a, b) => a.ordre - b.ordre)[0];
  return premiere?.id === etapeId ? "PRIMO_1" : "RAPPEL";
}

/**
 * Statut du protocole déduit uniquement des étapes réellement faites : acquis seulement si toutes
 * les étapes initiales obligatoires sont faites. Un entretien seul ne vaut pas protocole acquis.
 * Retourne null si aucune étape n'est faite (rien à déduire).
 */
export function statutDepuisEtapesFaites(
  etapes: readonly EtapeStatut[],
  etapesFaites: ReadonlySet<string>,
): Extract<StatutProtocoleVaccinal, "PROTOCOLE_ACQUIS" | "PRIMO_EN_COURS"> | null {
  if (!etapes.some((etape) => etapesFaites.has(etape.id))) return null;
  const initialesRequises = etapes.filter((etape) => etape.cycle !== "ENTRETIEN" && etape.obligatoire);
  return initialesRequises.every((etape) => etapesFaites.has(etape.id)) ? "PROTOCOLE_ACQUIS" : "PRIMO_EN_COURS";
}