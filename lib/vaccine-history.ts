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
