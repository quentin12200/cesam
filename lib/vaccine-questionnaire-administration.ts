export type AdministrationQuestionnaire = {
  id: string;
  statut: string;
  dose: number | null;
  unite: string | null;
  voie: string | null;
};

export function administrationUtilisable(preconisation: AdministrationQuestionnaire): boolean {
  return preconisation.statut === "VALIDE"
    && preconisation.dose != null
    && Boolean(preconisation.unite?.trim())
    && Boolean(preconisation.voie?.trim());
}

export function classerAdministrations<T extends AdministrationQuestionnaire>(preconisations: readonly T[]) {
  const valides = preconisations.filter(administrationUtilisable);
  const aVerifier = preconisations.filter((preconisation) => preconisation.statut === "A_VERIFIER");
  return { valides, aVerifier, proposerCreation: valides.length === 0 && aVerifier.length === 0 };
}
