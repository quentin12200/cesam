import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unifierActesVaccinaux, type ActeTraitementVaccin, type ActeVaccination } from "./vaccine-acts.ts";
import { construireGrilleVaccinale, type AnimalGrille, type EtapeGrille, type ProtocoleGrille } from "./vaccine-grid.ts";
import { actesDuVaccin, anneesDisponibles, datesCompactes, filtrerParAnnees, type ActeHistorique } from "./vaccine-history-view.ts";
import { comparerDateVelage } from "./vaccine-table-presentation.ts";

const NAISSANCE = new Date("2025-03-01T12:00:00Z");
const jour = (iso: string) => new Date(`${iso}T12:00:00Z`);

const etape = (id: string, label: string, ordre: number, cycle: string, debut: number, fin: number, recurrenceMois: number | null = null): EtapeGrille => ({
  id, label, ordre, cycle, reference: ordre === 0 ? "NAISSANCE" : "ETAPE_PRECEDENTE",
  debutValeur: debut, debutUnite: "JOUR", debutPosition: "APRES", finValeur: fin, finUnite: "JOUR", finPosition: "APRES",
  recurrenceMois, medicamentId: "med-somni", medicamentNom: "HIPRABOVIS SOMNI",
  medicaments: [{ medicament: { id: "med-somni", nom: "HIPRABOVIS SOMNI" } }],
});

const protocole = (recurrenceMois: number | null): ProtocoleGrille => ({
  id: "proto", nom: "SOMNI", label: "Somni", ageMinJours: 0, ageMaxJours: null,
  categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null,
  etapes: [etape("primo", "Primo", 0, "INITIAL", 14, 400), etape("rappel", "Rappel", 1, "INITIAL", 28, 35), etape("annuel", "Rappel annuel", 2, "ENTRETIEN", 300, 400, recurrenceMois)],
});

const animal = (actes: ActeVaccination[]): AnimalGrille => ({
  id: "a1", nutrav: "7483", nom: "BRIGITTE", sexe: "F", danaisIso: NAISSANCE.toISOString(),
  categorie: "VACHE", nombreVelages: 1, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes,
});

const vaccination = (id: string, date: string, etapeId: string | null, extra: Partial<ActeVaccination> = {}): ActeVaccination => ({
  sourceType: "VACCINATION", sourceId: id, date: jour(date), vaccin: "HIPRABOVIS SOMNI", medicamentId: "med-somni",
  protocoleId: etapeId ? "proto" : null, etapeProtocoleId: etapeId, gestationId: null, statut: "FAIT", ...extra,
});

const AUJOURDHUI = new Date("2026-10-02T12:00:00Z");
const grille = (actes: ActeVaccination[], recurrenceMois: number | null = 12, date = AUJOURDHUI) =>
  construireGrilleVaccinale([animal(actes)], [protocole(recurrenceMois)], [], date);

const enActeHistorique = (acte: { sourceType?: string; sourceId?: string | null; date: Date; vaccin: string; medicamentId: string | null; protocoleId: string | null; etapeProtocoleId: string | null }): ActeHistorique => ({
  sourceType: (acte.sourceType ?? "VACCINATION") as ActeHistorique["sourceType"], sourceId: acte.sourceId ?? null, date: acte.date.toISOString(),
  vaccin: acte.vaccin, medicamentId: acte.medicamentId, protocoleId: acte.protocoleId, etapeProtocoleId: acte.etapeProtocoleId,
  gestationId: null, voie: null, dose: null, uniteDosage: null,
});

test("A. historique global : tous les actes réels du vaccin, dans l'ordre, rattachés ou non", () => {
  const actes = unifierActesVaccinaux(
    [vaccination("v2", "2025-10-29", "rappel"), vaccination("v1", "2025-10-01", "primo")],
    [
      { id: "t3", dateDebut: jour("2026-10-02"), medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni" },
      { id: "t4", dateDebut: jour("2026-01-15"), medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni", protocoleVaccinId: "proto", etapeProtocoleVaccinId: "annuel" },
      { id: "t5", dateDebut: jour("2026-02-01"), medicamentNom: "AUTRE", medicamentId: "med-autre" },
    ],
  );
  const { lignes, blocs } = grille(actes);
  const historique = actesDuVaccin(lignes[0].actes.map(enActeHistorique), { nom: blocs[0].nom, medicamentIds: blocs[0].medicamentIds, protocoleId: blocs[0].protocoleId });
  assert.deepEqual(historique.map((acte) => acte.date.slice(0, 10)), ["2025-10-01", "2025-10-29", "2026-01-15", "2026-10-02"]);
  assert.deepEqual(historique.map((acte) => acte.etapeProtocoleId), ["primo", "rappel", "annuel", null], "un seul acte reste à rattacher");
  assert.ok(!historique.some((acte) => acte.medicamentId === "med-autre"), "un autre vaccin n'est pas mélangé");
  assert.equal(lignes[0].actes.length, 5, "l'animal garde tout son historique");
});

test("B/E. deux dates sur la même étape : aucune n'écrase l'autre, même dans la même année", () => {
  const { lignes } = grille([vaccination("v1", "2026-01-15", "annuel"), vaccination("v2", "2026-10-02", "annuel")]);
  const cellule = lignes[0].cellules["annuel"];
  assert.equal(cellule.statut, "FAIT");
  assert.deepEqual(cellule.actes.map((acte) => acte.sourceId), ["v1", "v2"]);
  assert.deepEqual(cellule.actes.map((acte) => acte.date.toISOString().slice(0, 10)), ["2026-01-15", "2026-10-02"]);
  assert.equal(cellule.date?.toISOString().slice(0, 10), "2026-10-02", "la date de référence est la plus récente");
});

test("D. entretien récurrent : historique FAIT conservé ET prochaine échéance calculée depuis le dernier acte", () => {
  const { lignes } = grille([vaccination("v1", "2026-01-15", "annuel")]);
  const cellule = lignes[0].cellules["annuel"];
  assert.equal(cellule.statut, "FAIT");
  assert.equal(cellule.actes.length, 1);
  assert.equal(cellule.prochaine?.date.toISOString().slice(0, 10), "2027-01-15");
  assert.equal(cellule.prochaine?.statut, "PREVU");

  const deux = grille([vaccination("v1", "2026-01-15", "annuel"), vaccination("v2", "2026-10-02", "annuel")]).lignes[0].cellules["annuel"];
  assert.equal(deux.prochaine?.date.toISOString().slice(0, 10), "2027-10-02", "calculée depuis le DERNIER acte");
});

test("D. sans recurrenceMois configuré : aucune prochaine date inventée", () => {
  const cellule = grille([vaccination("v1", "2026-01-15", "annuel")], null).lignes[0].cellules["annuel"];
  assert.equal(cellule.statut, "FAIT");
  assert.equal(cellule.prochaine, null);
  assert.equal(cellule.actes.length, 1);
});

test("D. une échéance récurrente arrivée à terme reprend son statut de planning (à faire / en retard)", () => {
  const acte = [vaccination("v1", "2025-10-02", "annuel")];
  assert.equal(grille(acte, 12, jour("2026-10-02")).lignes[0].cellules["annuel"].prochaine?.statut, "A_FAIRE");
  assert.equal(grille(acte, 12, jour("2026-10-30")).lignes[0].cellules["annuel"].prochaine?.statut, "EN_RETARD");
  assert.equal(grille(acte, 12, jour("2026-09-29")).lignes[0].cellules["annuel"].prochaine?.statut, "BIENTOT");
});

test("C. années : le filtre n'agit que sur l'affichage, le planner utilise tout l'historique", () => {
  // Rappel annuel fait en décembre 2025 : la prochaine échéance (2026) en découle, même si 2025 n'est pas affiché.
  const actes = [vaccination("v1", "2025-12-10", "annuel"), vaccination("v2", "2026-01-20", "annuel")];
  const { lignes } = grille(actes, 12);
  const cellule = lignes[0].cellules["annuel"];
  assert.equal(cellule.actes.length, 2, "la grille contient 2025 et 2026 quel que soit le filtre");
  assert.equal(cellule.prochaine?.date.toISOString().slice(0, 10), "2027-01-20");
  const dec = grille([vaccination("v1", "2025-12-10", "annuel")], 12).lignes[0].cellules["annuel"];
  assert.equal(dec.prochaine?.date.toISOString().slice(0, 10), "2026-12-10", "l'acte 2025 calcule l'échéance 2026");

  const histo = cellule.actes.map(enActeHistorique);
  assert.equal(filtrerParAnnees(histo, new Set([2026])).length, 1);
  assert.equal(filtrerParAnnees(histo, new Set([2025, 2026])).length, 2);
  assert.equal(filtrerParAnnees(histo, null).length, 2);
  assert.equal(filtrerParAnnees(histo, new Set([2024])).length, 0);
});

test("8. années disponibles : année actuelle + années de l'historique, de la plus récente à la plus ancienne", () => {
  assert.deepEqual(anneesDisponibles(["2024-05-01T12:00:00Z", "2026-01-01T12:00:00Z", "2024-09-01T12:00:00Z"], 2027), [2027, 2026, 2024]);
  assert.deepEqual(anneesDisponibles([], 2026), [2026]);
});

test("12. dates compactes : jour/mois si l'année est évidente, avec l'année sinon, +N au-delà de 2", () => {
  const actes = ["2025-12-10", "2026-01-15", "2026-03-01", "2026-10-02"].map((d) => ({ date: `${d}T12:00:00Z` }));
  const une = datesCompactes(actes, new Set([2026]));
  assert.deepEqual(une.libelles, ["01/03", "02/10"]);
  assert.equal(une.reste, 1);
  const deux = datesCompactes(actes, new Set([2025, 2026]));
  assert.deepEqual(deux.libelles, ["01/03/26", "02/10/26"]);
  assert.equal(deux.reste, 2);
  assert.deepEqual(datesCompactes(actes, null).libelles, ["01/03/26", "02/10/26"]);
  assert.deepEqual(datesCompactes(actes, new Set([2025])).libelles, ["10/12"]);
  assert.equal(datesCompactes(actes, new Set([2024])).total, 0);
});

test("F/14. déduplication : même médicament + même jour = un seul acte, la Vaccination gagne ; deux jours = deux actes", () => {
  const traitements: ActeTraitementVaccin[] = [
    { id: "t1", dateDebut: jour("2026-01-15"), medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni" },
    { id: "t2", dateDebut: jour("2026-10-02"), medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni" },
  ];
  const actes = unifierActesVaccinaux([vaccination("v1", "2026-01-15", "annuel")], traitements);
  assert.equal(actes.length, 2);
  assert.equal(actes.find((acte) => acte.date.toISOString().startsWith("2026-01-15"))?.sourceType, "VACCINATION");
  assert.equal(actes.find((acte) => acte.date.toISOString().startsWith("2026-10-02"))?.sourceType, "TRAITEMENT");
});

test("I. correction d'un acte depuis l'historique : même sourceId, routes existantes, aucun acte créé", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.match(tableau, /sourceId: acte\.sourceId, protocoleId: bloc\.protocoleId!/);
  assert.match(tableau, /\/api\/traitements\/\$\{cible\.sourceId\}\/rattachement-vaccinal/);
  assert.match(tableau, /\/api\/vaccinations\/\$\{cible\.sourceId\}\/rattachement/);
  assert.match(tableau, /actesDuVaccin\(ligne\.actes, bloc\)/);
  assert.doesNotMatch(tableau, /method: "POST"[\s\S]{0,120}rattachement/);
  // Le panneau reste ouvert après correction : seule l'édition de la ligne se ferme.
  assert.match(tableau, /\(\) => setActeEnEdition\(null\)\)/);
});

test("G. colonne Gestation retirée de l'affichage seulement ; la logique de gestation reste", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(tableau, /id: "gestation"/);
  assert.doesNotMatch(tableau, /Filtrer la gestation|filtreGestation|FiltreGestation|Gest\./);
  assert.doesNotMatch(tableau, /bg-green-600" : "bg-red-600/);
  // Les protocoles liés au vêlage continuent d'utiliser la gestation réelle de l'animal.
  assert.match(tableau, /gestationId: acte\.gestationId \?\? ligne\.gestationId/);
  assert.match(tableau, /protocoleLieAuVelage: bloc\.protocoleLieAuVelage/);
  const grilleSource = readFileSync(new URL("./vaccine-grid.ts", import.meta.url), "utf8");
  assert.match(grilleSource, /gestationId: animal\.gestationId|animal\.gestationId/);
  assert.match(grilleSource, /dateVelagePrevueIso: animal\.dateVelagePrevueIso/);
});

test("H. « Avant vêlage » conservé, avec tri : dates proches puis lointaines, sans date toujours à la fin", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.match(tableau, /id: "velage", label: "Avant vêlage"/);
  assert.match(tableau, /enteteTriable\("Avant vêlage"/);
  assert.match(tableau, /comparerDateVelage\(/);
  const proche = "2026-11-01T12:00:00Z", loin = "2027-02-01T12:00:00Z";
  assert.ok(comparerDateVelage(proche, loin, 1) < 0);
  assert.ok(comparerDateVelage(proche, loin, -1) > 0);
  for (const signe of [1, -1] as const) {
    assert.ok(comparerDateVelage(proche, null, signe) < 0, "une date passe avant l'absence de date");
    assert.ok(comparerDateVelage(undefined, loin, signe) > 0);
    assert.equal(comparerDateVelage(null, null, signe), 0);
  }
});

test("7. sélecteur d'années : année actuelle par défaut, plusieurs années, tout l'historique", () => {
  const tableau = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");
  assert.match(tableau, /Années affichées/);
  assert.match(tableau, /Tout l’historique/);
  assert.match(tableau, /useState<Set<number>>\(\(\) => new Set\(\[new Date\(\)\.getFullYear\(\)\]\)\)/);
  assert.match(tableau, /const anneesFiltre = toutHistorique \? null : anneesAffichees/);
  assert.doesNotMatch(tableau, /anneesFiltre[\s\S]{0,40}\.filter\(\(ligne\)/, "le filtre d'années ne filtre pas les lignes métier");
});
