import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unifierActesVaccinaux, type ActeVaccination } from "./vaccine-acts.ts";
import { construireGrilleVaccinale, type AnimalGrille, type EtapeGrille, type ProtocoleGrille } from "./vaccine-grid.ts";
import { libelleVoieDose, voieCourte } from "./vaccine-table-presentation.ts";
import { statutDepuisEtapesFaites, typeInjectionPourEtape } from "./vaccine-statut.ts";

const NAISSANCE = new Date("2026-06-01T12:00:00Z");
const DATE_ACTE = new Date("2026-10-01T12:00:00Z");

const etape = (id: string, label: string, ordre: number, cycle: string, debut: number, fin: number, medicamentId = "med-somni"): EtapeGrille => ({
  id, label, ordre, cycle, reference: ordre === 0 ? "NAISSANCE" : "ETAPE_PRECEDENTE",
  debutValeur: debut, debutUnite: "JOUR", debutPosition: "APRES", finValeur: fin, finUnite: "JOUR", finPosition: "APRES",
  medicamentId, medicamentNom: "HIPRABOVIS SOMNI",
  medicaments: [{ medicament: { id: medicamentId, nom: "HIPRABOVIS SOMNI" } }],
});

const primo = etape("primo", "Primo", 0, "INITIAL", 14, 200);
const rappel = etape("rappel", "Rappel", 1, "INITIAL", 35, 42);
const annuel = etape("annuel", "Rappel annuel", 2, "ENTRETIEN", 300, 400);

const protocole: ProtocoleGrille = {
  id: "proto-somni", nom: "SOMNI", label: "Somni", ageMinJours: 0, ageMaxJours: null,
  categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null,
  etapes: [primo, rappel, annuel],
};

const animal = (actes: ActeVaccination[]): AnimalGrille => ({
  id: "a1", nutrav: "7483", nom: "BRIGITTE", sexe: "F", danaisIso: NAISSANCE.toISOString(),
  categorie: "VELLE", nombreVelages: 0, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes,
});

const traitementSurEtape = (etapeId: string) => unifierActesVaccinaux([], [{
  id: "t1", dateDebut: DATE_ACTE, medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni",
  protocoleVaccinId: "proto-somni", etapeProtocoleVaccinId: etapeId, gestationId: null,
}]);

const vaccinationSurEtape = (etapeId: string): ActeVaccination[] => unifierActesVaccinaux([{
  sourceType: "VACCINATION", sourceId: "v1", date: DATE_ACTE, vaccin: "HIPRABOVIS SOMNI", medicamentId: "med-somni",
  protocoleId: "proto-somni", etapeProtocoleId: etapeId, gestationId: null, statut: "FAIT",
}], []);

test("une cellule FAIT expose l'acte réel (source, id, étape, étapes compatibles) pour permettre la correction", () => {
  for (const [actes, type, id] of [[vaccinationSurEtape("annuel"), "VACCINATION", "v1"], [traitementSurEtape("annuel"), "TRAITEMENT", "t1"]] as const) {
    const { lignes } = construireGrilleVaccinale([animal([...actes])], [protocole], [], new Date("2026-10-02T12:00:00Z"));
    const cellule = lignes[0].cellules["annuel"];
    assert.equal(cellule.statut, "FAIT");
    assert.equal(cellule.date?.getTime(), DATE_ACTE.getTime());
    assert.equal(cellule.acteFait?.sourceType, type);
    assert.equal(cellule.acteFait?.sourceId, id);
    assert.equal(cellule.acteFait?.protocoleId, "proto-somni");
    assert.equal(cellule.acteFait?.etapeProtocoleId, "annuel");
    assert.deepEqual(cellule.acteFait?.etapesCompatibles.map((e) => e.id), ["primo", "rappel", "annuel"]);
  }
});

test("seules les étapes compatibles avec le médicament réel sont proposées à la correction", () => {
  const autreVaccin = etape("autre", "Autre vaccin", 3, "INITIAL", 10, 20, "med-autre");
  const { lignes } = construireGrilleVaccinale([animal(vaccinationSurEtape("annuel"))], [{ ...protocole, etapes: [primo, rappel, annuel, autreVaccin] }], [], new Date("2026-10-02T12:00:00Z"));
  assert.deepEqual(lignes[0].cellules["annuel"].acteFait?.etapesCompatibles.map((e) => e.id), ["primo", "rappel", "annuel"]);
});

test("après correction Rappel annuel → Primo : même acte, ancienne étape plus FAIT, primo FAIT à la vraie date, suite recalculée", () => {
  const avant = construireGrilleVaccinale([animal(vaccinationSurEtape("annuel"))], [protocole], [], new Date("2026-10-02T12:00:00Z")).lignes[0].cellules;
  assert.equal(avant["annuel"].statut, "FAIT");
  assert.notEqual(avant["primo"].statut, "FAIT");

  const apres = construireGrilleVaccinale([animal(vaccinationSurEtape("primo"))], [protocole], [], new Date("2026-10-02T12:00:00Z")).lignes[0].cellules;
  assert.equal(apres["primo"].statut, "FAIT");
  assert.equal(apres["primo"].date?.getTime(), DATE_ACTE.getTime());
  assert.equal(apres["primo"].acteFait?.sourceId, avant["annuel"].acteFait?.sourceId, "même acte, même id");
  assert.notEqual(apres["annuel"].statut, "FAIT");
  assert.notEqual(apres["rappel"].statut, "FAIT");
  assert.equal(apres["rappel"].date?.toISOString().slice(0, 10), "2026-11-05", "le rappel repart de la vraie date de la primo");
});

test("un Traitement rattaché reste corrigeable : l'étape change, l'acte reste unique", () => {
  const actes = traitementSurEtape("primo");
  assert.equal(actes.length, 1);
  const { lignes } = construireGrilleVaccinale([animal([...actes])], [protocole], [], new Date("2026-10-02T12:00:00Z"));
  assert.equal(lignes[0].cellules["primo"].acteFait?.sourceType, "TRAITEMENT");
  const corrige = traitementSurEtape("rappel");
  assert.equal(corrige.length, 1);
  assert.equal(corrige[0].sourceId, "t1");
  assert.equal(corrige[0].date.getTime(), DATE_ACTE.getTime());
});

test("rappel futur : la primo est FAIT et le rappel est PREVU avec sa date, jamais vide", () => {
  const { lignes } = construireGrilleVaccinale([animal(traitementSurEtape("primo"))], [protocole], [], new Date("2026-10-02T12:00:00Z"));
  const cellules = lignes[0].cellules;
  assert.equal(cellules["primo"].statut, "FAIT");
  assert.equal(cellules["primo"].date?.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(cellules["rappel"].statut, "PREVU");
  assert.equal(cellules["rappel"].date?.toISOString().slice(0, 10), "2026-11-05");
  assert.equal(cellules["rappel"].rattachementProtocoleAutorise, true, "reste sélectionnable manuellement");
  assert.equal(cellules["rappel"].aValider, false);
});

test("une échéance dépassée ou ouverte garde son statut ; PREVU n'apparaît qu'avant la fenêtre", () => {
  const actes = traitementSurEtape("primo");
  const statut = (jour: string) => construireGrilleVaccinale([animal([...actes])], [protocole], [], new Date(jour)).lignes[0].cellules["rappel"].statut;
  assert.equal(statut("2026-10-02T12:00:00Z"), "PREVU");
  assert.equal(statut("2026-11-08T12:00:00Z"), "A_FAIRE");
  assert.equal(statut("2026-11-30T12:00:00Z"), "EN_RETARD");
});

test("statut du protocole recalculé depuis les étapes réellement faites", () => {
  const etapes = [primo, rappel, annuel].map((item) => ({ id: item.id, cycle: item.cycle, ordre: item.ordre, obligatoire: true }));
  assert.equal(statutDepuisEtapesFaites(etapes, new Set(["annuel"])), "PRIMO_EN_COURS", "un rappel annuel seul ne vaut pas protocole acquis");
  assert.equal(statutDepuisEtapesFaites(etapes, new Set(["primo"])), "PRIMO_EN_COURS");
  assert.equal(statutDepuisEtapesFaites(etapes, new Set(["primo", "rappel"])), "PROTOCOLE_ACQUIS");
  assert.equal(statutDepuisEtapesFaites(etapes, new Set()), null);
  assert.equal(typeInjectionPourEtape(etapes, "primo"), "PRIMO_1");
  assert.equal(typeInjectionPourEtape(etapes, "rappel"), "RAPPEL");
  assert.equal(typeInjectionPourEtape(etapes, "annuel"), "ENTRETIEN");
});

test("en-tête d'étape : voie courte, dose et unité, et absence visible", () => {
  assert.equal(libelleVoieDose("IM", 2, "ml"), "IM · 2 ml");
  assert.equal(libelleVoieDose("NASAL", 2, "ml"), "IN · 2 ml");
  assert.equal(libelleVoieDose("Sous-cutanée", 5, "ml"), "SC · 5 ml");
  assert.equal(libelleVoieDose("IN", null, null), "IN · dose ?");
  assert.equal(libelleVoieDose(null, 2, "ml"), "voie ? · 2 ml");
  assert.equal(libelleVoieDose("À renseigner", 2.5, "ml"), "voie ? · 2,5 ml");
  assert.equal(voieCourte(""), null);
});

test("l'interface : étapes sans lien « Sélectionner à faire », cellule FAIT cliquable, correction via les deux routes existantes", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(tableau, /Sélectionner à faire/);
  assert.match(tableau, /libelleVoieDose\(etape\.voie, etape\.dose, etape\.uniteDosage\)/);
  assert.match(tableau, /Vaccination enregistrée/);
  assert.match(tableau, /Corriger l’étape/);
  assert.match(tableau, /Enregistrer la correction/);
  assert.match(tableau, /rattachement-vaccinal/);
  assert.match(tableau, /\/api\/vaccinations\/\$\{cible\.sourceId\}\/rattachement/);
  assert.doesNotMatch(tableau, /method: "POST"[\s\S]{0,200}rattachement/);
});

test("les routes de rattachement resynchronisent le statut du protocole sans créer d'acte", () => {
  for (const chemin of ["../app/api/vaccinations/[id]/rattachement/route.ts", "../app/api/traitements/[id]/rattachement-vaccinal/route.ts"]) {
    const source = readFileSync(new URL(chemin, import.meta.url), "utf8");
    assert.match(source, /resynchroniserStatutProtocole/);
    assert.doesNotMatch(source, /\.create\(/);
  }
  const vaccination = readFileSync(new URL("../app/api/vaccinations/[id]/rattachement/route.ts", import.meta.url), "utf8");
  assert.match(vaccination, /typeInjection: typeInjectionPourEtape/);
});

test("dose : la dose affichée dans l'en-tête est celle envoyée au Traitement et à la Vaccination", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.match(tableau, /dose: groupe\.etape\.dose == null \? "" : String\(groupe\.etape\.dose\)/);
  assert.match(tableau, /uniteDosage: groupe\.etape\.uniteDosage \?\? "ml"/);
  const dose = tableau.match(/const dose = administration\.dose === "" \? null : Number\(administration\.dose\);/);
  assert.ok(dose, "une seule dose calculée");
  const traitement = tableau.match(/traitements: \[\{[\s\S]*?doseUnique: true,\s*\}\]/)?.[0] ?? "";
  assert.match(traitement, /\r?\n\s+dose,\r?\n/);
  assert.match(traitement, /uniteDosage: administration\.uniteDosage \|\| null/);
  const session = tableau.match(/vaccinationSession: \{[\s\S]*?animaux:/)?.[0] ?? "";
  assert.match(session, /\r?\n\s+dose,\r?\n/);

  const batch = readFileSync(new URL("../app/api/evenements/batch/route.ts", import.meta.url), "utf8");
  assert.match(batch, /dose: traitement\.doseParAnimal\?\.\[animalId\] \?\? traitement\.dose \?\? null/);
  assert.match(batch, /uniteDosage: traitement\.uniteDosage \|\| null/);
  assert.match(batch, /dose: vaccinationConfig\.session\.dose == null \? null : Number\(vaccinationConfig\.session\.dose\)/);

  const page = readFileSync(new URL("../app/sanitaire/vaccins/page.tsx", import.meta.url), "utf8");
  assert.match(page, /dose: preconisationDose\?\.dose \?\? null/);
});
