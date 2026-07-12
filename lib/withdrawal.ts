import { addDays } from "date-fns";

/**
 * Formule canonique du délai d'attente : point de départ = dernière administration
 * réellement réalisée (fin de traitement), +1 jour pour la viande (le jour de la
 * dernière administration compte comme jour 0), sans +1 pour le lait (convention
 * déjà en usage dans le carnet sanitaire).
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

export type AffichageDelaiAttente = "VIANDE" | "LAIT" | "LES_DEUX";

export function doitAfficherViande(affichage: string | null | undefined): boolean {
  return affichage !== "LAIT";
}

export function doitAfficherLait(affichage: string | null | undefined): boolean {
  return affichage === "LAIT" || affichage === "LES_DEUX" || !affichage;
}
