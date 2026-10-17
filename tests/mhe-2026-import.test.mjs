import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MHE_2026_NATIONAUX, MHE_2026_NUTRAV, planifierMhe2026 } from "../lib/mhe-2026-plan.ts";
import { construireGrilleVaccinale } from "../lib/vaccine-grid.ts";
import { unifierActesVaccinaux } from "../lib/vaccine-acts.ts";

const med = "med-hepizovac", proto = "proto-mhe", primo = "primo-mhe", rappel = "rappel-mhe";
const day = (value) => new Date(`${value}T12:00:00Z`);
const animalA = { id: "a", nutrav: "1234", nunati: MHE_2026_NATIONAUX[0], numeroNational: null };
const animalB = { id: "b", nutrav: MHE_2026_NUTRAV[0], nunati: "", numeroNational: null };
const vaccination = (id, animalId, date, extra = {}) => ({ id, animalId, date: day(date), vaccin: "HEPIZOVAC - MHE", medicamentId: med, protocoleId: proto, etapeProtocoleId: primo, statut: "FAIT", ...extra });
const traitement = (id, animalId, date, extra = {}) => ({ id, animalId, dateDebut: day(date), medicamentId: med, protocoleVaccinId: proto, etapeProtocoleVaccinId: primo, ...extra });
const plan = (animaux = [animalA], vaccins = [], traitements = []) => planifierMhe2026(animaux, vaccins, traitements, med, proto, { primo, rappel });
const ligne = (report, identifiant, etape) => report.lignes.find((item) => item.identifiant === identifiant && item.etape === etape);

test("liste fermée : 54 animaux, 108 actes, aucun animal exclu", () => {
  assert.equal(MHE_2026_NATIONAUX.length, 26);
  assert.equal(MHE_2026_NUTRAV.length, 28);
  const report = plan([]);
  assert.equal(report.actesAttendus, 108);
  for (const excluded of ["9227", "9226", "9223", "0989", "TOBI2", "0986", "0984", "0978", "0977"]) {
    assert.ok(!report.lignes.some((item) => item.identifiant === excluded));
  }
});

test("ancienne Vaccination sans medicamentId : rattacher, jamais créer un doublon", () => {
  const old = vaccination("v1", "a", "2026-02-05", { medicamentId: null, protocoleId: null, etapeProtocoleId: null, vaccin: "HEPIZOVAC - MHE" });
  const result = ligne(plan([animalA], [old]), animalA.nunati, "Primo");
  assert.equal(result.action, "RATTACHER");
  assert.deepEqual(result.vaccinationIds, ["v1"]);
});

test("acte absent : créer une seule Vaccination logique", () => {
  const result = ligne(plan(), animalA.nunati, "Primo");
  assert.equal(result.action, "CREER");
  assert.equal(result.animalId, "a");
});

test("deuxième passage après rattachement/création : zéro création pour l'animal couvert", () => {
  const saved = [vaccination("v1", "a", "2026-02-05"), vaccination("v2", "a", "2026-02-26", { etapeProtocoleId: rappel })];
  const report = plan([animalA], saved);
  assert.equal(ligne(report, animalA.nunati, "Primo").action, "DEJA_CORRECT");
  assert.equal(ligne(report, animalA.nunati, "Rappel").action, "DEJA_CORRECT");
  assert.equal(report.lignes.filter((item) => item.animalId === "a" && item.action === "CREER").length, 0);
});

test("animal absent : rapporté, aucun acte planifié", () => {
  const report = plan([]);
  assert.equal(ligne(report, animalA.nunati, "Primo").action, "ANIMAL_ABSENT");
  assert.ok(report.absents.includes(animalA.nunati));
});

test("un même animal retrouvé dans les deux groupes est bloqué comme conflit", () => {
  const shared = { ...animalA, nutrav: MHE_2026_NUTRAV[0] };
  const report = plan([shared]);
  assert.equal(ligne(report, shared.nunati, "Primo").action, "CONFLIT");
  assert.equal(ligne(report, shared.nutrav, "Primo").action, "CONFLIT");
});

test("acte d'un autre médicament le même jour : jamais rattaché ni modifié", () => {
  const other = vaccination("other", "a", "2026-02-05", { medicamentId: "another", vaccin: "BOVIGRIP", protocoleId: "other", etapeProtocoleId: "other" });
  const result = ligne(plan([animalA], [other]), animalA.nunati, "Primo");
  assert.equal(result.action, "CREER");
  assert.deepEqual(result.vaccinationIds, []);
  assert.equal(other.medicamentId, "another");
});

test("nom HEPIZOVAC avec identifiant d'un autre médicament : conflit, pas de doublon", () => {
  const disputed = vaccination("disputed", "a", "2026-02-05", { medicamentId: "old-hepizovac-id" });
  assert.equal(ligne(plan([animalA], [disputed]), animalA.nunati, "Primo").action, "CONFLIT");
});

test("protocole ou étape contradictoire : conflit sans écrasement", () => {
  const old = vaccination("v1", "a", "2026-02-05", { protocoleId: "other" });
  assert.equal(ligne(plan([animalA], [old]), animalA.nunati, "Primo").action, "CONFLIT");
  const wrongStep = vaccination("v2", "a", "2026-02-05", { etapeProtocoleId: rappel });
  assert.equal(ligne(plan([animalA], [wrongStep]), animalA.nunati, "Primo").action, "CONFLIT");
});

test("Vaccination et Traitement du même fait : les deux rattachés puis dédoublonnés à la lecture", () => {
  const v = vaccination("v", "a", "2026-02-05", { protocoleId: null, etapeProtocoleId: null });
  const t = traitement("t", "a", "2026-02-05", { protocoleVaccinId: null, etapeProtocoleVaccinId: null });
  const result = ligne(plan([animalA], [v], [t]), animalA.nunati, "Primo");
  assert.equal(result.action, "RATTACHER");
  assert.deepEqual(result.vaccinationIds, ["v"]);
  assert.deepEqual(result.traitementIds, ["t"]);
  const history = unifierActesVaccinaux([{ sourceId: "v", date: v.date, vaccin: v.vaccin, medicamentId: med, protocoleId: proto, etapeProtocoleId: primo, gestationId: null, statut: "FAIT" }], [{ id: "t", dateDebut: t.dateDebut, medicamentNom: "HEPIZOVAC - MHE", medicamentId: med }]);
  assert.equal(history.length, 1);
});

const step = (id, order) => ({ id, ordre: order, cycle: "INITIAL", reference: order ? "ETAPE_PRECEDENTE" : "NAISSANCE", label: id, debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 60, finUnite: "JOUR", finPosition: "APRES", medicamentId: med, medicamentNom: "HEPIZOVAC - MHE", medicaments: [{ medicamentId: med, medicament: { id: med, nom: "HEPIZOVAC - MHE", voie: null, uniteDosage: null, preconisations: [], conditionnements: [], flaconsOuverts: [] } }] });
const config = { version: 1, medicamentId: med, cible: { tousBovins: true, categories: [] }, demarrage: { type: "PRIMO_RAPPEL", etapePrimoId: primo, etapeRappelId: rappel, calendrierPrimo: { type: "SANS_REGLE" }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "p", preconisationRappelId: "p", resterDansFenetrePrimo: false } }, entretien: { actif: false } };
const protocol = { id: proto, nom: "MHE", label: "MHE", configurationQuestionnaireJson: JSON.stringify(config), ageMinJours: 0, ageMaxJours: null, categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null, etapes: [step(primo, 0), step(rappel, 1)] };
function gridFor(identifier, first, second) {
  const acts = [vaccination("v1", identifier, first), vaccination("v2", identifier, second, { etapeProtocoleId: rappel })].map((v) => ({ sourceType: "VACCINATION", sourceId: v.id, date: v.date, vaccin: v.vaccin, medicamentId: med, protocoleId: proto, etapeProtocoleId: v.etapeProtocoleId, gestationId: null, statut: "FAIT" }));
  const animal = { id: identifier, nutrav: identifier, nom: "TEST", sexe: "F", danaisIso: day("2025-01-01").toISOString(), categorie: "VACHE", nombreVelages: 0, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes: acts, statutsProtocoles: [] };
  return construireGrilleVaccinale([animal], [protocol], [], day("2026-10-17"));
}

for (const [identifier, first, second] of [["a", "2026-02-05", "2026-02-26"], ["b", "2026-03-24", "2026-04-14"]]) {
  test(`grille : Primo ${first} et Rappel ${second} reconnus`, () => {
    const result = gridFor(identifier, first, second);
    assert.equal(result.lignes[0].cellules[primo].statut, "FAIT");
    assert.equal(result.lignes[0].cellules[rappel].statut, "FAIT");
  });
}

test("fiche et API : vaccinations structurées lues dans l'historique, application explicite uniquement", () => {
  const fiche = readFileSync("app/troupeau/[nutrav]/page.tsx", "utf8");
  const route = readFileSync("app/api/protocoles/import-mhe-2026/route.ts", "utf8");
  assert.match(fiche, /vaccinations:\s*\{/);
  assert.match(fiche, /Vaccinations réelles/);
  assert.match(route, /confirmation !== "IMPORT_MHE_2026"/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
});
