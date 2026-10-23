type AnimalActe = { id: string; nutrav: string; nom: string | null };

export type VaccinationCarnet = {
  id: string; animal: AnimalActe; date: Date; statut: string; vaccin: string;
  medicamentId: string | null; medicamentNom: string | null;
  protocoleNom: string | null; etapeNom: string | null;
};

export type TraitementCarnet = {
  id: string; animal: AnimalActe; date: Date; medicamentNom: string;
  medicamentId: string | null; executant: string | null;
  protocoleNom: string | null; etapeNom: string | null;
};

export type ActeSanitaireReel = {
  id: string; animalId: string; nutrav: string; nom: string | null; date: Date;
  produit: string; medicamentId: string | null;
  source: "Vaccination" | "Traitement" | "Vaccination + Traitement";
  executant: string | null; protocoleNom: string | null; etapeNom: string | null;
};

const jour = (date: Date) => date.toISOString().slice(0, 10);
const nomComparable = (nom: string) => nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");

/** Une Vaccination FAIT et son Traitement du même produit/jour forment une seule administration.
 * Un rapprochement consomme une seule ligne de chaque source : plusieurs injections du même
 * produit le même jour ne doivent pas être effacées. Les identifiants priment sur les libellés.
 */
export function unifierActesDuCarnet(vaccinations: readonly VaccinationCarnet[], traitements: readonly TraitementCarnet[]): ActeSanitaireReel[] {
  const faites = vaccinations.filter((v) => v.statut === "FAIT");
  const animalIds = new Set([...faites.map((v) => v.animal.id), ...traitements.map((t) => t.animal.id)]);
  const resultat: ActeSanitaireReel[] = [];

  for (const animalId of animalIds) {
    const vs = faites.filter((v) => v.animal.id === animalId);
    const ts = traitements.filter((t) => t.animal.id === animalId);
    const traitementsDisponibles = new Set(ts.map((t) => t.id));
    const doublonsParVaccination = new Map<string, TraitementCarnet>();

    // L'identité stable du médicament permet d'apparier les administrations une à une.
    for (const v of vs) {
      if (!v.medicamentId) continue;
      const t = ts.find((candidate) => traitementsDisponibles.has(candidate.id)
        && jour(candidate.date) === jour(v.date) && candidate.medicamentId === v.medicamentId);
      if (!t) continue;
      doublonsParVaccination.set(v.id, t);
      traitementsDisponibles.delete(t.id);
    }

    // Le repli historique par nom ne rapproche qu'une paire unique, et jamais deux
    // identifiants de médicament différents portant par hasard le même libellé.
    for (const v of vs) {
      if (doublonsParVaccination.has(v.id)) continue;
      const correspondances = ts.filter((t) => traitementsDisponibles.has(t.id)
        && jour(t.date) === jour(v.date) && (!v.medicamentId || !t.medicamentId)
        && nomComparable(v.medicamentNom ?? v.vaccin) === nomComparable(t.medicamentNom));
      if (correspondances.length !== 1) continue;
      const t = correspondances[0];
      const vaccinationsCompatibles = vs.filter((candidate) => !doublonsParVaccination.has(candidate.id)
        && jour(candidate.date) === jour(t.date)
        && (!candidate.medicamentId || !t.medicamentId)
        && nomComparable(candidate.medicamentNom ?? candidate.vaccin) === nomComparable(t.medicamentNom));
      if (vaccinationsCompatibles.length !== 1) continue;
      doublonsParVaccination.set(v.id, t);
      traitementsDisponibles.delete(t.id);
    }

    for (const v of vs) {
      const representant = doublonsParVaccination.get(v.id);
      resultat.push({ id: `vaccination:${v.id}`, animalId, nutrav: v.animal.nutrav,
        nom: v.animal.nom, date: v.date, produit: v.medicamentNom ?? v.vaccin,
        medicamentId: v.medicamentId ?? representant?.medicamentId ?? null,
        source: representant ? "Vaccination + Traitement" : "Vaccination",
        executant: representant?.executant ?? null,
        protocoleNom: v.protocoleNom ?? representant?.protocoleNom ?? null,
        etapeNom: v.etapeNom ?? representant?.etapeNom ?? null });
    }
    for (const t of ts) {
      if (!traitementsDisponibles.has(t.id)) continue;
      resultat.push({ id: `traitement:${t.id}`, animalId, nutrav: t.animal.nutrav,
        nom: t.animal.nom, date: t.date, produit: t.medicamentNom,
        medicamentId: t.medicamentId, source: "Traitement", executant: t.executant,
        protocoleNom: t.protocoleNom, etapeNom: t.etapeNom });
    }
  }
  return resultat;
}

export type RechercheActes = {
  du?: string; au?: string; animal?: string; produit?: string;
  tri?: "date" | "animal" | "produit" | "executant";
  direction?: "asc" | "desc";
};

export function rechercherActes(actes: readonly ActeSanitaireReel[], recherche: RechercheActes): ActeSanitaireReel[] {
  const du = /^\d{4}-\d{2}-\d{2}$/.test(recherche.du ?? "") ? recherche.du : undefined;
  const au = /^\d{4}-\d{2}-\d{2}$/.test(recherche.au ?? "") ? recherche.au : undefined;
  const animal = nomComparable(recherche.animal ?? "");
  const produit = nomComparable(recherche.produit ?? "");
  const tri = recherche.tri ?? "date";
  const direction = recherche.direction === "asc" ? 1 : -1;
  const texte = (a: ActeSanitaireReel) => tri === "animal" ? a.nutrav
    : tri === "produit" ? a.produit : a.executant ?? "";
  return actes.filter((a) => (!du || jour(a.date) >= du) && (!au || jour(a.date) <= au)
    && (!animal || nomComparable(`${a.nutrav} ${a.nom ?? ""}`).includes(animal))
    && (!produit || nomComparable(a.produit).includes(produit)))
    .sort((a, b) => {
      const principal = tri === "date" ? a.date.getTime() - b.date.getTime()
        : tri === "animal" ? a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true })
          : texte(a).localeCompare(texte(b), "fr", { numeric: true });
      return direction * principal || b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id);
    });
}
