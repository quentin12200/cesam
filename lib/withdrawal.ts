import { addDays } from "date-fns";

/**
 * Fin de traitement = date de début + durée en jours (convention utilisée dans
 * toute l'application, y compris le carnet sanitaire).
 */
export function getDateFinTraitement(dateDebut: Date, dureeJours: number): Date {
  return addDays(dateDebut, dureeJours);
}

/**
 * Formule canonique du délai d'attente : point de départ = fin de traitement,
 * +1 jour pour la viande (convention déjà en usage dans le carnet sanitaire),
 * sans +1 pour le lait.
 */
export function getDateFinAttenteViande(dateFin: Date, delaiAttenteViandeJ: number | null | undefined): Date | null {
  if (delaiAttenteViandeJ == null) return null;
  return addDays(dateFin, delaiAttenteViandeJ + 1);
}

export function getDateFinAttenteLait(dateFin: Date, delaiAttenteLaitJ: number | null | undefined): Date | null {
  if (delaiAttenteLaitJ == null) return null;
  return addDays(dateFin, delaiAttenteLaitJ);
}

export interface AttenteInfo {
  dateFinAttenteViande: Date | null;
  dateFinAttenteLait: Date | null;
  enAttenteViande: boolean;
  enAttenteLait: boolean;
  enAttente: boolean;
}

/**
 * dateFin = fin du traitement (dernière administration réellement réalisée).
 * Si un traitement n'a pas de délai propre (delaiAttenteViandeJ/LaitJ), on retombe
 * sur celui du médicament catalogué.
 */
export function getAttenteInfo(
  dateFin: Date,
  delaiAttenteViandeJ: number | null | undefined,
  delaiAttenteLaitJ: number | null | undefined,
  now: Date = new Date()
): AttenteInfo {
  const dateFinAttenteViande = getDateFinAttenteViande(dateFin, delaiAttenteViandeJ);
  const dateFinAttenteLait = getDateFinAttenteLait(dateFin, delaiAttenteLaitJ);
  const enAttenteViande = dateFinAttenteViande ? now < dateFinAttenteViande : false;
  const enAttenteLait = dateFinAttenteLait ? now < dateFinAttenteLait : false;
  return {
    dateFinAttenteViande,
    dateFinAttenteLait,
    enAttenteViande,
    enAttenteLait,
    enAttente: enAttenteViande || enAttenteLait,
  };
}

export interface TraitementDelaiInput {
  dateDebut: Date;
  dureeJours: number;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
  notes?: string | null;
  medicament?: { delaiAttenteViandeJ?: number | null; delaiAttenteLaitJ?: number | null } | null;
}

/**
 * Le délai propre au traitement prime (il a pu être ajusté ou prescrit
 * spécifiquement) ; à défaut on retombe sur celui du médicament catalogué.
 */
export function getAttenteInfoForTraitement(t: TraitementDelaiInput, now: Date = new Date()): AttenteInfo {
  const dateFin = getDateFinTraitement(new Date(t.dateDebut), t.dureeJours);
  const delaiViande = delaisInconnus(t).viande ? null : t.delaiAttenteViandeJ ?? t.medicament?.delaiAttenteViandeJ ?? null;
  const delaiLait = delaisInconnus(t).lait ? null : t.delaiAttenteLaitJ ?? t.medicament?.delaiAttenteLaitJ ?? null;
  return getAttenteInfo(dateFin, delaiViande, delaiLait, now);
}

// Un délai absent sur l'acte et sur le catalogue ne constitue pas un délai nul.
// Les actes signalés à compléter gardent leur incertitude même après édition de la fiche.
export function delaisInconnus(t: TraitementDelaiInput & {notes?:string|null}) {
 const explicite = t.notes?.includes("[DELAIS_A_COMPLETER]") === true;
 return {viande: (t.delaiAttenteViandeJ ?? (explicite ? null : t.medicament?.delaiAttenteViandeJ)) == null,
 lait: (t.delaiAttenteLaitJ ?? (explicite ? null : t.medicament?.delaiAttenteLaitJ)) == null};
}
export function delaiSaisi(v:unknown): v is number {
 return typeof v==="number" && Number.isSafeInteger(v) && v>=0;
}
export type AffichageDelaiAttente = "VIANDE" | "LAIT" | "LES_DEUX";

export function doitAfficherViande(affichage: string | null | undefined): boolean {
  return affichage !== "LAIT";
}

export function doitAfficherLait(affichage: string | null | undefined): boolean {
  return affichage === "LAIT" || affichage === "LES_DEUX" || !affichage;
}
