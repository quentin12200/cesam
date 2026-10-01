/**
 * Validation pure du rattachement d'un ancien `Traitement` vaccinal à un protocole/étape.
 * Ne modifie jamais le médicament réel : l'acte est refusé s'il n'est pas compatible.
 */
export interface ProtocoleRattachement {
  etapes: readonly {
    id: string;
    reference: string;
    medicaments: readonly { medicamentId: string }[];
  }[];
}

export function medicamentCompatibleAvecEtape(
  protocole: ProtocoleRattachement,
  etapeId: string,
  medicamentId: string,
): boolean {
  const etape = protocole.etapes.find((item) => item.id === etapeId);
  if (!etape) return false;
  if (etape.medicaments.some((liaison) => liaison.medicamentId === medicamentId)) return true;
  // Étape sans médicament lié : acceptée seulement si le protocole utilise ce médicament ailleurs.
  return etape.medicaments.length === 0
    && protocole.etapes.some((item) => item.medicaments.some((liaison) => liaison.medicamentId === medicamentId));
}

export function protocoleLieAuVelage(protocole: ProtocoleRattachement): boolean {
  return protocole.etapes.some((etape) => etape.reference === "VELAGE");
}
