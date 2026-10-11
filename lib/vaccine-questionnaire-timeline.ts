export type ResumeFriseQuestionnaire = {
  etapesInitiales: string[];
  initialTermine: boolean;
  entretien: boolean;
};

export function resumeFriseQuestionnaire(
  demarrage: "DOSE_UNIQUE" | "PRIMO_RAPPEL" | null,
  entretien: boolean,
): ResumeFriseQuestionnaire {
  if (!demarrage) return { etapesInitiales: [], initialTermine: false, entretien: false };
  return {
    etapesInitiales: demarrage === "DOSE_UNIQUE" ? ["Dose unique"] : ["Primo", "Rappel"],
    initialTermine: true,
    entretien,
  };
}
