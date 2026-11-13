import { lireConfigurationQuestionnaire } from "./vaccine-protocol-questionnaire.ts";

/**
 * Vue de compatibilité pour les anciens protocoles Rotavec « Dose unique + Entretien ».
 * L'entretien avant vêlage représente en réalité la dose du PROCHAIN cycle,
 * pas une seconde injection pour la gestation actuelle.
 * Aucune modification du protocole enregistré, des injections ou du stock.
 */
export function rotavecUneDoseParGestation<T extends {
  nom: string;
  label: string;
  configurationQuestionnaireJson: string | null;
  etapes: { id: string }[];
}>(protocole: T): T {
  const configuration = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
  if (!configuration || configuration.demarrage.type !== "DOSE_UNIQUE"
    || !configuration.entretien.actif
    || !/ROTAVEC(?:\s+CORONA)?/i.test(`${protocole.nom} ${protocole.label}`)) return protocole;

  // Un entretien annuel calendaire n'est pas converti arbitrairement en suivi de gestation.
  const initiale = configuration.demarrage.calendrier;
  const entretien = configuration.entretien.calendrier;
  const regleVelage = initiale.type === "AVANT_VELAGE" ? initiale
    : entretien.type === "AVANT_VELAGE" ? entretien : null;
  if (!regleVelage) return protocole;
  const demarrage = configuration.demarrage;
  if (demarrage.type !== "DOSE_UNIQUE") return protocole;
  const dose = protocole.etapes.find((etape) => etape.id === demarrage.etapeDoseId);
  if (!dose) return protocole;
  const configurationCycle = {
    ...configuration,
    demarrage: { ...configuration.demarrage, calendrier: regleVelage },
    entretien: { actif: false as const },
  };
  return {
    ...protocole,
    configurationQuestionnaireJson: JSON.stringify(configurationCycle),
    etapes: [dose],
  };
}
