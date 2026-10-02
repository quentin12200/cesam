/**
 * Voie + dose d'une étape vaccinale : la Pharmacie (préconisations du médicament) est la vérité,
 * le protocole ne fait que choisir une préconisation existante. Aucune valeur n'est inventée :
 * en cas d'ambiguïté la dose reste inconnue (« dose ? ») plutôt que devinée.
 */
import { voieCourte } from "./vaccine-table-presentation.ts";

export interface PreconisationAdministration {
  id: string;
  statut: string;
  voie: string | null;
  dose: number | null;
  unite: string | null;
}

export interface AdministrationResolue {
  voie: string | null;
  dose: number | null;
  unite: string | null;
  preconisationId: string | null;
  source: "PRECONISATION_LIEE" | "PRECONISATION_UNIQUE" | "LIAISON" | "MEDICAMENT" | null;
  /** Plusieurs préconisations valides possibles et aucune ne s'impose : la dose reste à choisir. */
  ambigue: boolean;
}

const cle = (voie: string | null | undefined) => voieCourte(voie);

/**
 * Voies possibles d'un médicament, dérivées de ses préconisations validées (jamais inventées).
 * `Medicament.voie` n'est qu'un repli historique, utilisé seulement si aucune préconisation
 * ne porte de voie.
 */
export function voiesPossibles(preconisations: readonly Pick<PreconisationAdministration, "statut" | "voie">[], voieMedicament?: string | null): string[] {
  const voies = new Set<string>();
  for (const preconisation of preconisations) {
    const code = preconisation.statut === "VALIDE" ? cle(preconisation.voie) : null;
    if (code) voies.add(code);
  }
  if (voies.size === 0) {
    const legacy = cle(voieMedicament);
    if (legacy) voies.add(legacy);
  }
  return [...voies];
}

export function resoudreAdministrationEtape({
  preconisations,
  preconisationLieeId,
  voieLiaison,
  voieMedicament,
  uniteMedicament,
}: {
  preconisations: readonly PreconisationAdministration[];
  preconisationLieeId?: string | null;
  voieLiaison?: string | null;
  voieMedicament?: string | null;
  uniteMedicament?: string | null;
}): AdministrationResolue {
  const valides = preconisations.filter((item) => item.statut === "VALIDE");
  const liee = preconisationLieeId ? preconisations.find((item) => item.id === preconisationLieeId) ?? null : null;
  const voieDemandee = voieLiaison?.trim() || null;

  let choisie = liee;
  let source: AdministrationResolue["source"] = liee ? "PRECONISATION_LIEE" : null;
  let ambigue = false;
  if (!choisie) {
    // Une voie déjà choisie sur la liaison restreint le choix aux préconisations de cette voie.
    const parVoie = voieDemandee ? valides.filter((item) => cle(item.voie) === cle(voieDemandee)) : [];
    const pool = parVoie.length > 0 ? parVoie : valides;
    const dosees = pool.filter((item) => item.dose != null);
    const distinctes = new Map(dosees.map((item) => [`${cle(item.voie)}|${item.dose}|${item.unite ?? ""}`, item]));
    if (distinctes.size === 1) choisie = [...distinctes.values()][0];
    else if (distinctes.size === 0 && pool.length === 1) choisie = pool[0];
    else ambigue = pool.length > 1;
    if (choisie) source = "PRECONISATION_UNIQUE";
  }

  const voiesValides = new Set(valides.map((item) => cle(item.voie)).filter(Boolean));
  const voieUnique = voiesValides.size === 1 ? valides.find((item) => cle(item.voie))?.voie ?? null : null;
  let voie: string | null = choisie?.voie?.trim() || null;
  if (!voie && voieDemandee) { voie = voieDemandee; source = source ?? "LIAISON"; }
  if (!voie && voieUnique) voie = voieUnique;
  if (!voie && voieMedicament?.trim()) { voie = voieMedicament.trim(); source = source ?? "MEDICAMENT"; }

  return {
    voie,
    dose: choisie?.dose ?? null,
    unite: choisie?.unite || uniteMedicament || null,
    preconisationId: choisie?.id ?? null,
    source,
    ambigue: ambigue && choisie == null,
  };
}
