import { lireConfigurationQuestionnaire } from "./vaccine-protocol-questionnaire.ts";
import { vaccinationAppartientAuCycleCourant } from "./vaccination-session.ts";

export interface VaccinationHistorique {
  sourceType?: "VACCINATION" | "TRAITEMENT";
  sourceId?: string | null;
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
  gestationId?: string | null;
  statut?: string;
}
interface EtapeHistorique {
  id: string; ordre: number; cycle: string; reference: string;
  medicaments: readonly { medicament: { id: string; nom: string } }[];
}
interface ProtocoleHistorique {
  id: string;
  etapes: readonly EtapeHistorique[];
  configurationQuestionnaireJson?: string | null;
}
interface CorrespondanceHistorique {
  id: string; noms: readonly string[]; medicamentIds: readonly string[]; etapeIds: readonly string[];
}
export function nomVaccinComparable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr");
}
const fait = (v: VaccinationHistorique) => !v.statut || v.statut === "FAIT";
function initiales(protocole: ProtocoleHistorique): readonly EtapeHistorique[] {
  const config = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
  if (!config) return protocole.etapes.filter((e) => e.cycle !== "ENTRETIEN").sort((a, b) => a.ordre - b.ordre);
  const d = config.demarrage;
  const ids = d.type === "DOSE_UNIQUE" ? [d.etapeDoseId] : [d.etapePrimoId, d.etapeRappelId];
  return ids.flatMap((id, i) => {
    const etape = protocole.etapes.find((e) => e.id === id);
    return etape ? [{ ...etape, reference: i === 1 ? "ETAPE_PRECEDENTE" : etape.reference }] : [];
  });
}
function produitCompatible(v: VaccinationHistorique, produits: readonly { id: string; nom: string }[]): boolean {
  return v.medicamentId != null
    ? produits.some((m) => m.id === v.medicamentId)
    : produits.some((m) => nomVaccinComparable(m.nom) === nomVaccinComparable(v.vaccin));
}

/** Interprétation en lecture seulement : produit certain, chaîne initiale et chronologie.
 * Un Entretien configuré ne bloque pas la chaîne initiale ; un Entretien déjà fait la rend ambiguë. */
export function rattacherPrimoNonLiee<T extends VaccinationHistorique>(
  vaccinations: readonly T[], protocole: ProtocoleHistorique,
): { vaccinations: T[]; rattachee: T | null } {
  const liees = vaccinations.filter((v) => fait(v) && v.protocoleId === protocole.id && protocole.etapes.some((e) => e.id === v.etapeProtocoleId));
  const etapes = initiales(protocole);
  const sansInference = () => ({ vaccinations: [...liees], rattachee: null });
  if (etapes.length !== 2 || etapes[1].reference !== "ETAPE_PRECEDENTE") return sansInference();
  // Les actes d'entretien sont indépendants de l'initial : ils ne doivent ni
  // bloquer l'inférence du Primo, ni servir de borne chronologique au Rappel.
  const etapesInitialesIds = new Set(etapes.map((e) => e.id));
  const initialesLiees = liees.filter((v) => v.etapeProtocoleId && etapesInitialesIds.has(v.etapeProtocoleId));
  if (initialesLiees.some((v) => v.etapeProtocoleId !== etapes[1].id)) return sansInference();
  const rappels = initialesLiees.filter((v) => v.etapeProtocoleId === etapes[1].id);
  // Le médicament de Primo peut être distinct de celui du Rappel. La liaison du
  // Primo doit être certaine ; si un Rappel est déjà connu, il doit confirmer ce produit.
  const candidatsCompatibles = vaccinationsSansEtapeFiable(vaccinations, {
    id: protocole.id, noms: etapes[0].medicaments.map((m) => m.medicament.nom),
    medicamentIds: etapes[0].medicaments.map((m) => m.medicament.id), etapeIds: protocole.etapes.map((e) => e.id),
  }).filter((v) => produitCompatible(v, etapes[0].medicaments.map((m) => m.medicament)));
  const premierRappel = rappels.reduce<Date | null>((premier, v) => !premier || v.date < premier ? v.date : premier, null);
  const candidats = premierRappel ? candidatsCompatibles.filter((v) => v.date < premierRappel) : candidatsCompatibles;
  if (candidats.length !== 1
    || rappels.some((v) => !produitCompatible(candidats[0], [{ id: v.medicamentId ?? "", nom: v.vaccin }]))) return sansInference();
  return { vaccinations: [...liees, { ...candidats[0], protocoleId: protocole.id, etapeProtocoleId: etapes[0].id }], rattachee: candidats[0] };
}

/** Même inférence pour grille et préparation. Jamais de lien automatique à une gestation,
 * ni de choix entre protocoles partageant un produit. Aucun objet d'entrée n'est modifié. */
export function rattacherInjectionOrpheline<T extends VaccinationHistorique>(
  vaccinations: readonly T[],
  protocole: ProtocoleHistorique & { noms: readonly string[]; medicamentIds: readonly string[] },
  options: { protocoleLieAuVelage: boolean; medicamentPartage: boolean },
): T | null {
  const etapes = initiales(protocole);
  if (options.protocoleLieAuVelage || options.medicamentPartage || !etapes.length) return null;
  const rattachee = rattacherPrimoNonLiee(vaccinations, protocole).rattachee;
  if (rattachee) return rattachee;
  // Repli legacy : une seule étape ou Primo→Rappel dont la liaison médicament du rappel manque.
  // Un acte d'entretien n'est pas une étape initiale et ne bloque pas ce repli.
  if (etapes.length > 2 || (etapes.length === 2 && etapes[1].reference !== "ETAPE_PRECEDENTE")) return null;
  const etapesInitialesIds = new Set(etapes.map((e) => e.id));
  if (vaccinations.some((v) => fait(v) && v.protocoleId === protocole.id && v.etapeProtocoleId && etapesInitialesIds.has(v.etapeProtocoleId))) return null;
  const candidats = vaccinationsSansEtapeFiable(vaccinations, { ...protocole, etapeIds: protocole.etapes.map((e) => e.id) });
  if (candidats.length !== 1) return null;
  const produitsPrimo = etapes[0].medicaments.map((m) => m.medicament);
  if (!produitsPrimo.length || !produitCompatible(candidats[0], produitsPrimo)) return null;
  const datesEntretien = vaccinations.filter((v) => fait(v) && v.protocoleId === protocole.id
    && v.etapeProtocoleId && protocole.etapes.some((e) => e.id === v.etapeProtocoleId && e.cycle === "ENTRETIEN")).map((v) => v.date);
  if (datesEntretien.length && candidats[0].date >= datesEntretien.reduce((premier, v) => v < premier ? v : premier)) return null;
  return candidats[0];
}

/** L'identifiant produit prime sur un libellé ancien. Un identifiant d'étape supprimé
 * reste un fait réel à examiner, jamais une preuve que l'injection n'a pas eu lieu. */
export function vaccinationsSansEtapeFiable<T extends VaccinationHistorique>(
  vaccinations: readonly T[], protocole: CorrespondanceHistorique,
): T[] {
  const noms = new Set(protocole.noms.map(nomVaccinComparable));
  return vaccinations.filter((v) => {
    if (!fait(v)) return false;
    if (v.protocoleId === protocole.id) return !v.etapeProtocoleId || !protocole.etapeIds.includes(v.etapeProtocoleId);
    if (v.protocoleId) return false;
    return v.medicamentId != null ? protocole.medicamentIds.includes(v.medicamentId) : noms.has(nomVaccinComparable(v.vaccin));
  });
}

/** Partition centrale des faits : fiables (tous cycles), calculables (cycle courant),
 * ou à confirmer. Utilisée avant le planner, y compris pour un questionnaire. */
export function interpreterHistoriqueVaccinal<T extends VaccinationHistorique>(
  actes: readonly T[], protocole: ProtocoleHistorique & { noms: readonly string[]; medicamentIds: readonly string[] },
  options: { protocoleLieAuVelage: boolean; medicamentPartage: boolean; gestationId: string | null },
) {
  const ids = protocole.etapes.map((e) => e.id);
  const fiables = actes.filter((v) => fait(v) && v.protocoleId === protocole.id && v.etapeProtocoleId && ids.includes(v.etapeProtocoleId));
  const acteInfere = rattacherInjectionOrpheline(actes, protocole, options);
  const historique = acteInfere ? [...fiables, { ...acteInfere, protocoleId: protocole.id, etapeProtocoleId: initiales(protocole)[0].id }] : fiables;
  return {
    acteInfere,
    historique,
    vaccinations: historique.filter((v) => vaccinationAppartientAuCycleCourant(options.protocoleLieAuVelage, v.gestationId ?? null, options.gestationId)),
    aConfirmer: vaccinationsSansEtapeFiable(actes, { ...protocole, etapeIds: ids }).filter((v) => v !== acteInfere),
  };
}

/** Tous les produits, pas seulement le premier médicament du protocole. Un nom sans ID
 * est une preuve suffisante seulement si les autres protocoles ne partagent pas ce nom. */
export function medicamentPartageEntreProtocoles(protocole: ProtocoleHistorique, protocoles: readonly ProtocoleHistorique[]): boolean {
  const produits = protocole.etapes.flatMap((e) => e.medicaments.map((m) => m.medicament));
  return protocoles.some((p) => p.id !== protocole.id && p.etapes.some((e) => e.medicaments.some(({ medicament: m }) => produits.some((v) => v.id === m.id || nomVaccinComparable(v.nom) === nomVaccinComparable(m.nom)))));
}
