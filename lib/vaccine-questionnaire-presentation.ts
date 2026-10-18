import type { DureeQuestionnaire, RegleTemporelleQuestionnaire } from "./vaccine-protocol-questionnaire";
import { LIBELLES_CATEGORIES_VACCINS, sexeImpliciteCategorieVaccinale } from "./vaccine-category-selection.ts";

export function listeFrancaise(elements: readonly string[]): string {
  if (elements.length <= 1) return elements[0] ?? "";
  if (elements.length === 2) return `${elements[0]} et ${elements[1]}`;
  return `${elements.slice(0, -1).join(", ")} et ${elements.at(-1)}`;
}

export function resumeCibleQuestionnaire(tous: boolean, categories: readonly string[]): string {
  if (tous) return "Ce protocole pourra concerner tous les bovins.";
  const libelles = categories.map((categorie) => LIBELLES_CATEGORIES_VACCINS[categorie]).filter(Boolean);
  return libelles.length > 0
    ? `Ce protocole sera proposé ${listeFrancaise(libelles.map((libelle) => `aux ${libelle}`))}.`
    : "Choisis au moins une catégorie animale.";
}

export function sexeImplicite(categories: readonly string[]): "F" | "M" | null {
  return sexeImpliciteCategorieVaccinale(categories);
}

export function texteDureeQuestionnaire(duree: DureeQuestionnaire): string {
  const valeur = String(duree.valeur).replace(".", ",");
  const unite = duree.unite === "JOUR"
    ? (duree.valeur === 1 ? "jour" : "jours")
    : duree.unite === "SEMAINE"
      ? (duree.valeur === 1 ? "semaine" : "semaines")
      : "mois";
  return `${valeur} ${unite}`;
}

export function texteFenetreAvantVelage(
  fenetre: Extract<RegleTemporelleQuestionnaire, { type: "AVANT_VELAGE" }>,
): string {
  return `entre ${texteDureeQuestionnaire(fenetre.debutAvant)} et ${texteDureeQuestionnaire(fenetre.finAvant)} avant le vêlage`;
}
