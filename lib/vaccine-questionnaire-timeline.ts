export type ResumeFriseQuestionnaire = {
  etapesInitiales: string[];
  afficherDelaiRappel: boolean;
  initialTermine: boolean;
  entretien: boolean;
};

export function resumeFriseQuestionnaire(
  demarrage: "DOSE_UNIQUE" | "PRIMO_RAPPEL" | null,
  avancement: { rappelDefini: boolean; initialTermine: boolean; entretienDefini: boolean },
): ResumeFriseQuestionnaire {
  if (!demarrage) return { etapesInitiales: [], afficherDelaiRappel: false, initialTermine: false, entretien: false };
  return {
    etapesInitiales: demarrage === "DOSE_UNIQUE" ? ["Dose unique"] : ["Primo", "Rappel"],
    afficherDelaiRappel: demarrage === "PRIMO_RAPPEL" && avancement.rappelDefini,
    initialTermine: avancement.initialTermine,
    entretien: avancement.entretienDefini,
  };
}
