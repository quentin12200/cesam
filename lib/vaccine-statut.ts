import type { StatutProtocoleVaccinal } from "./vaccine-planner.ts";

interface EtapeStatut {
  id: string;
  cycle: string;
  obligatoire?: boolean;
}

type ActeEtapeFait = { etapeProtocoleId: string | null };

/** Preuve historique indépendante du cycle courant : initial complet ou entretien réel. */
export function protocoleInitialAcquisDepuisHistorique(
  etapes: readonly EtapeStatut[],
  actes: ReadonlyArray<ActeEtapeFait>,
): boolean {
  const etapesFaites = new Set(actes.map((acte) => acte.etapeProtocoleId).filter((id): id is string => Boolean(id)));
  if (etapes.some((etape) => etape.cycle === "ENTRETIEN" && etapesFaites.has(etape.id))) return true;
  const initialesRequises = etapes.filter((etape) => etape.cycle !== "ENTRETIEN" && etape.obligatoire !== false);
  return initialesRequises.length > 0 && initialesRequises.every((etape) => etapesFaites.has(etape.id));
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
 * les étapes initiales obligatoires sont faites, ou si un entretien prouve que l'initial était acquis.
 * Retourne null si aucune étape n'est faite (rien à déduire).
 */
export function statutDepuisEtapesFaites(
  etapes: readonly EtapeStatut[],
  etapesFaites: ReadonlySet<string>,
): Extract<StatutProtocoleVaccinal, "PROTOCOLE_ACQUIS" | "PRIMO_EN_COURS"> | null {
  if (!etapes.some((etape) => etapesFaites.has(etape.id))) return null;
  return protocoleInitialAcquisDepuisHistorique(
    etapes,
    [...etapesFaites].map((etapeProtocoleId) => ({ etapeProtocoleId })),
  ) ? "PROTOCOLE_ACQUIS" : "PRIMO_EN_COURS";
}
