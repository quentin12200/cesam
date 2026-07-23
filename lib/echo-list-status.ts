export interface EchoListStatus {
  label: "Bientôt prête pour l’échographie" | "À échographier";
  countdown: string;
  sortGroup: 0 | 1 | 2 | 3;
}

export function getEchoListEntryDays(timing: {
  usePreparationPhase: boolean;
  listFromDays: number;
  dueFromDays: number;
}) {
  return timing.usePreparationPhase ? timing.listFromDays : timing.dueFromDays;
}

export function getEchoListStatus(daysSinceBreeding: number, dueFromDays: number): EchoListStatus {
  const remainingDays = dueFromDays - daysSinceBreeding;
  if (remainingDays < 0) {
    const overdueDays = Math.abs(remainingDays);
    return {
      label: "À échographier",
      countdown: `En retard de ${overdueDays} jour${overdueDays > 1 ? "s" : ""}`,
      sortGroup: 0,
    };
  }
  if (remainingDays === 0) {
    return { label: "À échographier", countdown: "Prête aujourd’hui", sortGroup: 1 };
  }
  if (remainingDays === 1) {
    return { label: "Bientôt prête pour l’échographie", countdown: "Prête demain", sortGroup: 2 };
  }
  return {
    label: "Bientôt prête pour l’échographie",
    countdown: `Prête dans ${remainingDays} jours`,
    sortGroup: remainingDays <= 5 ? 2 : 3,
  };
}
