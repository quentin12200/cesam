export interface VaccinationHistorique {
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
  statut?: string;
}

function nomComparable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr");
}

/** Une seule injection non rattachée peut être la primo si le produit est exact et
 * si les deux étapes initiales utilisent ce même produit. Les autres cas restent à vérifier. */
export function rattacherPrimoNonLiee<T extends VaccinationHistorique>(
  vaccinations: readonly T[],
  protocole: {
    id: string;
    etapes: readonly {
      id: string;
      ordre: number;
      cycle: string;
      reference: string;
      medicaments: readonly { medicament: { id: string; nom: string } }[];
    }[];
  },
): { vaccinations: T[]; rattachee: T | null } {
  const liees = vaccinations.filter((v) => v.protocoleId === protocole.id && v.etapeProtocoleId);
  const initiales = protocole.etapes.filter((e) => e.cycle !== "ENTRETIEN").sort((a, b) => a.ordre - b.ordre);
  if (liees.length || initiales.length !== 2 || initiales[1].reference !== "ETAPE_PRECEDENTE") {
    return { vaccinations: [...liees], rattachee: null };
  }
  const noms = initiales.map((e) => new Set(e.medicaments.map((m) => nomComparable(m.medicament.nom))));
  const ids = initiales.map((e) => new Set(e.medicaments.map((m) => m.medicament.id)));
  if (!noms[0].size || !noms[1].size ||
      ![...noms[0]].some((nom) => noms[1].has(nom))) {
    return { vaccinations: [...liees], rattachee: null };
  }
  const candidates = vaccinations.filter((v) => {
    if (v.statut && v.statut !== "FAIT") return false;
    if (v.protocoleId && v.protocoleId !== protocole.id) return false;
    if (v.etapeProtocoleId) return false;
    const nom = nomComparable(v.vaccin);
    return (noms[0].has(nom) && noms[1].has(nom)) ||
      (v.medicamentId != null && ids[0].has(v.medicamentId) && ids[1].has(v.medicamentId));
  });
  if (candidates.length !== 1) return { vaccinations: [...liees], rattachee: null };
  const rattachee = { ...candidates[0], protocoleId: protocole.id, etapeProtocoleId: initiales[0].id };
  return { vaccinations: [...liees, rattachee], rattachee: candidates[0] };
}

/**
 * Rattache une injection orpheline (sans protocoleId/etapeProtocoleId, ex: saisie en Traitement
 * libre) quand c'est possible sans ambiguïté :
 * - Primo + rappel (2 étapes partageant le même médicament) : voir rattacherPrimoNonLiee.
 * - Sinon, s'il n'existe qu'UNE SEULE injection orpheline pour ce protocole, elle ne peut être
 *   que la primo — un rappel suppose toujours une primo déjà faite, aucune ambiguïté sur le
 *   compte même quand l'étape exacte n'est pas fiable en base (ex: une étape sans médicament
 *   lié empêchant rattacherPrimoNonLiee de trancher).
 * Jamais appliqué à un protocole lié au vêlage ni à un médicament partagé avec un autre
 * protocole (options à la charge de l'appelant, qui seul connaît les autres protocoles).
 * Fonction centrale : utilisée à la fois par la grille (lib/vaccine-grid.ts) et par la
 * préparation de séance (lib/vaccine-preparation-data.ts) pour qu'elles répondent pareil.
 */
export function rattacherInjectionOrpheline<T extends VaccinationHistorique>(
  vaccinations: readonly T[],
  protocole: {
    id: string;
    noms: readonly string[];
    medicamentIds: readonly string[];
    etapes: readonly {
      id: string;
      ordre: number;
      cycle: string;
      reference: string;
      medicaments: readonly { medicament: { id: string; nom: string } }[];
    }[];
  },
  options: { protocoleLieAuVelage: boolean; medicamentPartage: boolean },
): T | null {
  const etapesInitiales = protocole.etapes.filter((e) => e.cycle !== "ENTRETIEN");
  const peutInferer = !options.protocoleLieAuVelage && !options.medicamentPartage
    && protocole.etapes.length === etapesInitiales.length && etapesInitiales.length > 0;
  if (!peutInferer) return null;

  if (etapesInitiales.length === 2 && etapesInitiales[1].reference === "ETAPE_PRECEDENTE") {
    const rattachee = rattacherPrimoNonLiee(vaccinations.filter((v) => !v.protocoleId || v.protocoleId === protocole.id), protocole).rattachee;
    if (rattachee) return rattachee;
  }
  const candidats = vaccinationsSansEtapeFiable(vaccinations, {
    id: protocole.id, noms: protocole.noms, medicamentIds: protocole.medicamentIds,
    etapeIds: protocole.etapes.map((e) => e.id),
  }) as T[];
  return candidats.length === 1 ? candidats[0] : null;
}

/** Un vaccin ancien sans étape ne prouve pas quelle injection du protocole a été faite. */
export function vaccinationsSansEtapeFiable(
  vaccinations: readonly VaccinationHistorique[],
  protocole: { id: string; noms: readonly string[]; medicamentIds: readonly string[]; etapeIds: readonly string[] },
): VaccinationHistorique[] {
  const noms = new Set(protocole.noms.map(nomComparable));
  const medicamentIds = new Set(protocole.medicamentIds);
  const etapeIds = new Set(protocole.etapeIds);

  return vaccinations.filter((vaccination) => {
    if (vaccination.protocoleId === protocole.id) {
      return !vaccination.etapeProtocoleId || !etapeIds.has(vaccination.etapeProtocoleId);
    }
    if (vaccination.protocoleId) return false;
    return (vaccination.medicamentId != null && medicamentIds.has(vaccination.medicamentId))
      || noms.has(nomComparable(vaccination.vaccin));
  });
}
