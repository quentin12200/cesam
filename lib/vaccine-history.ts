export interface VaccinationHistorique {
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
}

function nomComparable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr");
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
