// Liste fermée validée : aucun animal ni aucune date n'est inféré du carnet historique.
export const MHE_2026_NATIONAUX = [
  "8235590987", "8235599225", "8235599217", "8235590998", "8235590994", "8235599219",
  "8235599221", "8235591001", "8235599222", "8235590999", "8235591002", "8235590992",
  "8235590993", "8235599215", "8235591000", "8235590996", "8235599220", "8235599213",
  "8235599224", "8235590997", "8235599216", "8235599218", "8235599214", "8235599212",
  "8235590991", "8235590995",
] as const;
export const MHE_2026_NUTRAV = [
  "9261", "9260", "9259", "9258", "9256", "9255", "9254", "9253", "9252", "9251",
  "9249", "9248", "9247", "9246", "9244", "9243", "9242", "9241", "9240", "9239",
  "9238", "9237", "9236", "9234", "9233", "9232", "9230", "9228",
] as const;

type Animal = { id: string; nutrav: string; nunati: string; numeroNational: string | null };
type Vaccination = { id: string; animalId: string; date: Date; vaccin: string; medicamentId: string | null; protocoleId: string | null; etapeProtocoleId: string | null; statut: string };
type Traitement = { id: string; animalId: string; dateDebut: Date; medicamentId: string | null; medicamentNom?: string; protocoleVaccinId: string | null; etapeProtocoleVaccinId: string | null };
type Entree = { identifiant: string; type: "national" | "nutrav"; primo: string; rappel: string };
type Etape = "Primo" | "Rappel";
type Action = "DEJA_CORRECT" | "RATTACHER" | "CREER" | "CONFLIT" | "ANIMAL_ABSENT";
export type LigneMhe2026 = { identifiant: string; nutrav: string | null; etape: Etape; date: string; action: Action; detail?: string; vaccinationIds: string[]; traitementIds: string[]; animalId?: string };
export type RapportMhe2026 = {
  animauxAttendus: number; animauxTrouves: number; animauxAbsents: number; actesAttendus: number;
  dejaCorrects: number; aRattacher: number; aCreer: number; conflits: number;
  absents: string[]; exemplesConflits: string[]; lignes: LigneMhe2026[];
  rattaches?: number; crees?: number;
};

const ENTREES: Entree[] = [
  ...MHE_2026_NATIONAUX.map((identifiant) => ({ identifiant, type: "national" as const, primo: "2026-02-05", rappel: "2026-02-26" })),
  ...MHE_2026_NUTRAV.map((identifiant) => ({ identifiant, type: "nutrav" as const, primo: "2026-03-24", rappel: "2026-04-14" })),
];

export const chiffres = (value: string) => value.replace(/\D/g, "");
const nomNormalise = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export const estHepizovac = (value: string) => nomNormalise(value) === "HEPIZOVAC MHE";
export const estMedicamentHepizovac = (value: string) => /^HEPIZOVAC(?: |$)/.test(nomNormalise(value));
const jourParis = (value: Date) => {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const valeur = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${valeur("year")}-${valeur("month")}-${valeur("day")}`;
};
export const dateHistorique = (day: string) => new Date(`${day}T12:00:00.000Z`);

function rapport(lignes: LigneMhe2026[]): RapportMhe2026 {
  const absents = [...new Set(lignes.filter((ligne) => ligne.action === "ANIMAL_ABSENT").map((ligne) => ligne.identifiant))];
  return {
    animauxAttendus: ENTREES.length,
    animauxTrouves: ENTREES.length - absents.length,
    animauxAbsents: absents.length,
    actesAttendus: ENTREES.length * 2,
    dejaCorrects: lignes.filter((ligne) => ligne.action === "DEJA_CORRECT").length,
    aRattacher: lignes.filter((ligne) => ligne.action === "RATTACHER").length,
    aCreer: lignes.filter((ligne) => ligne.action === "CREER").length,
    conflits: lignes.filter((ligne) => ligne.action === "CONFLIT").length,
    absents,
    exemplesConflits: lignes.filter((ligne) => ligne.action === "CONFLIT").slice(0, 8).map((ligne) => `${ligne.identifiant} ${ligne.etape} : ${ligne.detail}`),
    lignes,
  };
}

/** Pure et testable : même décision pour le dry-run et pour l'écriture transactionnelle. */
export function planifierMhe2026(animaux: Animal[], vaccinations: Vaccination[], traitements: Traitement[], medicamentId: string, protocoleId: string, etapes: { primo: string; rappel: string }): RapportMhe2026 {
  const lignes: LigneMhe2026[] = [];
  const associes = ENTREES.map((entree) => animaux.filter((animal) => entree.type === "nutrav"
    ? animal.nutrav === entree.identifiant
    : [animal.nunati, animal.numeroNational].some((numero) => numero && chiffres(numero) === entree.identifiant)));
  const nombresParAnimal = new Map<string, number>();
  for (const correspondances of associes) if (correspondances.length === 1) {
    const id = correspondances[0].id;
    nombresParAnimal.set(id, (nombresParAnimal.get(id) ?? 0) + 1);
  }
  for (const [index, entree] of ENTREES.entries()) {
    const correspondances = associes[index];
    for (const [etape, date] of [["Primo", entree.primo], ["Rappel", entree.rappel]] as const) {
      const base = { identifiant: entree.identifiant, nutrav: correspondances[0]?.nutrav ?? null, etape, date, vaccinationIds: [] as string[], traitementIds: [] as string[] };
      if (correspondances.length === 0) { lignes.push({ ...base, action: "ANIMAL_ABSENT" }); continue; }
      if (correspondances.length !== 1) { lignes.push({ ...base, action: "CONFLIT", detail: "Plusieurs animaux correspondent à cet identifiant" }); continue; }
      const animal = correspondances[0];
      if ((nombresParAnimal.get(animal.id) ?? 0) > 1) { lignes.push({ ...base, animalId: animal.id, action: "CONFLIT", detail: "Animal présent dans deux groupes de dates" }); continue; }
      const etapeId = etape === "Primo" ? etapes.primo : etapes.rappel;
      const produitContradictoire = vaccinations.some((acte) => acte.animalId === animal.id && jourParis(acte.date) === date && acte.medicamentId && acte.medicamentId !== medicamentId && estHepizovac(acte.vaccin))
        || traitements.some((acte) => acte.animalId === animal.id && jourParis(acte.dateDebut) === date && acte.medicamentId !== medicamentId && acte.medicamentNom && estHepizovac(acte.medicamentNom));
      if (produitContradictoire) { lignes.push({ ...base, animalId: animal.id, action: "CONFLIT", detail: "HEPIZOVAC daté mais lié à un autre médicament" }); continue; }
      const vs = vaccinations.filter((acte) => acte.animalId === animal.id && jourParis(acte.date) === date && (acte.medicamentId === medicamentId || (acte.medicamentId === null && estHepizovac(acte.vaccin))));
      const ts = traitements.filter((acte) => acte.animalId === animal.id && jourParis(acte.dateDebut) === date && acte.medicamentId === medicamentId);
      const ids = { vaccinationIds: vs.map((acte) => acte.id), traitementIds: ts.map((acte) => acte.id), animalId: animal.id };
      if (vs.length > 1 || ts.length > 1) { lignes.push({ ...base, ...ids, action: "CONFLIT", detail: "Plusieurs actes du même type pour cette date" }); continue; }
      if (vs.some((acte) => acte.statut !== "FAIT" || (acte.protocoleId && acte.protocoleId !== protocoleId) || (acte.etapeProtocoleId && acte.etapeProtocoleId !== etapeId))
        || ts.some((acte) => (acte.protocoleVaccinId && acte.protocoleVaccinId !== protocoleId) || (acte.etapeProtocoleVaccinId && acte.etapeProtocoleVaccinId !== etapeId))) {
        lignes.push({ ...base, ...ids, action: "CONFLIT", detail: "Statut, protocole ou étape existants contradictoires" }); continue;
      }
      if (vs.length + ts.length === 0) { lignes.push({ ...base, ...ids, action: "CREER" }); continue; }
      const complet = vs.every((acte) => acte.medicamentId === medicamentId && acte.protocoleId === protocoleId && acte.etapeProtocoleId === etapeId)
        && ts.every((acte) => acte.protocoleVaccinId === protocoleId && acte.etapeProtocoleVaccinId === etapeId);
      lignes.push({ ...base, ...ids, action: complet ? "DEJA_CORRECT" : "RATTACHER" });
    }
  }
  return rapport(lignes);
}
