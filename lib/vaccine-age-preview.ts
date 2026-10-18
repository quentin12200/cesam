import { differenceInCalendarDays } from "date-fns";
import { ajouterDureeQuestionnaire, type DureeQuestionnaire } from "./vaccine-protocol-questionnaire.ts";
import { estAnimalConcerneParProtocole } from "./vaccine-eligibility.ts";

export type AnimalApercuAge = {
  danaisIso: string;
  categorie: string;
  sexe: string;
  groupeNom: string | null;
  nombreVelages: number;
  gestation: boolean;
  vaccinsFaitsIds: readonly string[];
  statutsProtocoles: readonly { protocoleId: string; statut: string }[];
};

export type CibleApercuAge = {
  medicamentId: string;
  protocoleId: string | null;
  categories: readonly string[];
  sexeCible: string | null;
  gestante: boolean | null;
  rangVelageMin: number | null;
  rangVelageMax: number | null;
  lotCible: string | null;
};

export type ImpactLimiteAge = {
  deviendraientHorsProgramme: number;
  reviendraientDansProgramme: number;
  candidatsSansPremiereInjection: number;
};

/**
 * Prévisualisation du nombre de bovins ACTIFS dont une Primo non commencée change
 * d'éligibilité par la seule modification de l'âge maximal.
 * Ne modifie aucune donnée, ne simule pas une vaccination et n'est pas un décompte
 * des flacons à sortir. La vérité historique reste la source des actes FAIT.
 */
export function previsualiserLimiteAge({
  animaux, cible, ancienneLimite, nouvelleLimite, date,
}: {
  animaux: readonly AnimalApercuAge[];
  cible: CibleApercuAge;
  ancienneLimite: DureeQuestionnaire | null;
  nouvelleLimite: DureeQuestionnaire | null;
  date: Date;
}): ImpactLimiteAge {
  let deviendraientHorsProgramme = 0;
  let reviendraientDansProgramme = 0;
  let candidatsSansPremiereInjection = 0;
  const horsAge = (naissance: Date, ageMax: DureeQuestionnaire | null): boolean =>
    ageMax != null && differenceInCalendarDays(date, ajouterDureeQuestionnaire(naissance, ageMax)) > 0;
  for (const animal of animaux) {
    const eligible = estAnimalConcerneParProtocole({
      categorie: animal.categorie, sexbov: animal.sexe,
      groupeNom: animal.groupeNom, nombreVelages: animal.nombreVelages,
      gestation: animal.gestation,
    }, {
      categoriesJson: JSON.stringify(cible.categories), sexeCible: cible.sexeCible,
      gestante: cible.gestante, rangVelageMin: cible.rangVelageMin,
      rangVelageMax: cible.rangVelageMax, lotCible: cible.lotCible,
    });
    if (!eligible) continue;
    // En présence d'une preuve de vaccination, ne JAMAIS proposer de masquer le rappel.
    if (animal.vaccinsFaitsIds.includes(cible.medicamentId)) continue;
    const etat = cible.protocoleId
      ? animal.statutsProtocoles.find((item) => item.protocoleId === cible.protocoleId)?.statut
      : null;
    // Tout état d'historique incertain ou déjà commencé exige une revue, non une exclusion.
    if (etat === "A_CONFIRMER" || etat === "PROTOCOLE_ACQUIS" || etat === "PRIMO_EN_COURS") continue;
    candidatsSansPremiereInjection++;
    const naissance = new Date(animal.danaisIso);
    const avant = horsAge(naissance, ancienneLimite);
    const apres = horsAge(naissance, nouvelleLimite);
    if (!avant && apres) deviendraientHorsProgramme++;
    if (avant && !apres) reviendraientDansProgramme++;
  }
  return { deviendraientHorsProgramme, reviendraientDansProgramme, candidatsSansPremiereInjection };
}
