// Types partagés entre le scan IA, la création de brouillon et l'écran de
// vérification. Une ordonnance peut couvrir plusieurs pages (photos) et lister
// plusieurs médicaments ; à la validation, chaque médicament devient une
// Ordonnance distincte.

export interface MedicamentPropose {
  medicamentNom: string | null;
  numeroLot: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  frequence: string | null;
  dureeJours: number | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  precautions: string | null;
  rappels: string | null;
}

export interface PropositionOrdonnance {
  dateDebut?: string | null;
  ordonnanceNumero?: string | null;
  veterinaire?: string | null;
  motif?: string | null;
  medicaments?: MedicamentPropose[];

  // Champs « à plat » des anciens brouillons (un seul médicament).
  medicamentNom?: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  frequence?: string | null;
  dureeJours?: number | null;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
  precautions?: string | null;
  rappels?: string | null;
}

export function medicamentVide(): MedicamentPropose {
  return {
    medicamentNom: null,
    numeroLot: null,
    voie: null,
    dose: null,
    uniteDosage: null,
    frequence: null,
    dureeJours: null,
    delaiAttenteViandeJ: null,
    delaiAttenteLaitJ: null,
    precautions: null,
    rappels: null,
  };
}

/** Renvoie toujours au moins un médicament, en reconstruisant depuis les
 *  anciens champs à plat si nécessaire (rétrocompatibilité des brouillons). */
export function medicamentsDepuisProposition(prop: PropositionOrdonnance | null | undefined): MedicamentPropose[] {
  if (!prop || typeof prop !== "object") return [medicamentVide()];
  if (Array.isArray(prop.medicaments) && prop.medicaments.length > 0) {
    return prop.medicaments.map((m) => ({ ...medicamentVide(), ...m }));
  }
  return [
    {
      ...medicamentVide(),
      medicamentNom: prop.medicamentNom ?? null,
      voie: prop.voie ?? null,
      dose: prop.dose ?? null,
      uniteDosage: prop.uniteDosage ?? null,
      frequence: prop.frequence ?? null,
      dureeJours: prop.dureeJours ?? null,
      delaiAttenteViandeJ: prop.delaiAttenteViandeJ ?? null,
      delaiAttenteLaitJ: prop.delaiAttenteLaitJ ?? null,
      precautions: prop.precautions ?? null,
      rappels: prop.rappels ?? null,
    },
  ];
}

/** Décode le champ documentUrls (JSON) en repliant sur documentUrl unique. */
export function parseDocumentUrls(documentUrls: string | null | undefined, documentUrl: string): string[] {
  if (documentUrls) {
    try {
      const parsed = JSON.parse(documentUrls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((u): u is string => typeof u === "string");
      }
    } catch {
      /* ignore, repli ci-dessous */
    }
  }
  return documentUrl ? [documentUrl] : [];
}
