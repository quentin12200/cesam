import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { construireGrilleVaccinale, extraireActionsPrevues } from "../lib/vaccine-grid.ts";
import { interpreterHistoriqueVaccinal, medicamentPartageEntreProtocoles } from "../lib/vaccine-history.ts";
import { unifierActesVaccinaux } from "../lib/vaccine-acts.ts";
import { calculerActionVaccinale } from "../lib/vaccine-planner.ts";

const jour = (s) => new Date(s + "T12:00:00Z");
const now = jour("2026-10-17");
const med = { id: "bovigrip", nom: "BOVILIS BOVIGRIP", voie: "SC", uniteDosage: "ml", preconisations: [], conditionnements: [], flaconsOuverts: [] };
const step = (id, ordre, cycle = "INITIAL", reference = "NAISSANCE") => ({
  id, ordre, cycle, reference, label: id, debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 60, finUnite: "JOUR", finPosition: "APRES",
  medicamentId: med.id, medicamentNom: med.nom, medicaments: [{ medicamentId: med.id, medicament: med }],
});
const config = {
  version: 1, medicamentId: med.id, cible: { tousBovins: true, categories: [] },
  demarrage: { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "AGE_MINIMUM", age: { valeur: 14, unite: "JOUR" } }, rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "p", preconisationRappelId: "p", resterDansFenetrePrimo: false } },
  entretien: { actif: true, etapeId: "entretien", preconisationId: "p", calendrier: { type: "APRES_DELAI", premierDelai: { valeur: 6, unite: "MOIS" }, recurrence: { valeur: 12, unite: "MOIS" } } },
};
const protocol = { id: "proto", nom: med.nom, label: med.nom, configurationQuestionnaireJson: JSON.stringify(config), ageMinJours: 0, ageMaxJours: null, categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null, etapes: [step("primo", 0), step("rappel", 1, "INITIAL", "ETAPE_PRECEDENTE"), step("entretien", 2, "ENTRETIEN")] };
const act = (extra = {}) => ({ sourceType: "VACCINATION", sourceId: "v1", date: jour("2026-09-18"), vaccin: med.nom, medicamentId: med.id, protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT", voie: "SC", dose: 5, ...extra });
const rappel = () => act({ sourceId: "v2", date: now, protocoleId: protocol.id, etapeProtocoleId: "rappel", dose: null });
const animal = (actes, extra = {}) => ({ id: "a7509", nutrav: "7509", nom: "BUBULEUR", sexe: "M", danaisIso: jour("2026-09-01").toISOString(), categorie: "VEAU_M", nombreVelages: 0, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes, statutsProtocoles: [{ protocoleId: protocol.id, statut: "PRIMO_A_FAIRE" }], ...extra });
const grid = (actes, p = protocol, extra = {}, protocols = [p]) => construireGrilleVaccinale([animal(actes, extra)], protocols, [], now);
const interpret = (actes, p = protocol, options = {}) => interpreterHistoriqueVaccinal(actes, { ...p, noms: [p.nom], medicamentIds: [med.id] }, { protocoleLieAuVelage: false, medicamentPartage: false, gestationId: null, ...options });
const covered = (g) => Object.values(g.lignes[0].cellules).flatMap((c) => [...c.actes, ...c.historiquesAValider]);
function assertConservation(g, actes) {
  for (const a of actes) assert.ok(covered(g).some((v) => v.sourceId === a.sourceId && v.date.getTime() === a.date.getTime()), `${a.sourceId} invisible`);
}

test("BUBULEUR exact : Primo 18/09 + Rappel 17/10 faits, jamais de nouveau Primo", () => {
  const actes = [act(), rappel()], snapshot = structuredClone(actes);
  const g = grid(actes), cells = g.lignes[0].cellules;
  assert.equal(cells.primo.statut, "FAIT"); assert.equal(cells.primo.date.toISOString().slice(0, 10), "2026-09-18");
  assert.equal(cells.rappel.statut, "FAIT"); assert.equal(cells.rappel.date.toISOString().slice(0, 10), "2026-10-17");
  assert.equal(cells.primo.actes[0].dose, 5); assert.equal(cells.primo.actes[0].voie, "SC");
  assert.deepEqual(extraireActionsPrevues(g).map((a) => a.etapeId), ["entretien"]);
  const i = interpret(actes);
  const action = calculerActionVaccinale({ date: now, dateNaissance: jour("2026-09-01"), etapes: protocol.etapes, vaccinations: i.vaccinations, historiqueVaccinations: i.historique, configurationQuestionnaireJson: protocol.configurationQuestionnaireJson });
  assert.equal(action.etape?.id, "entretien"); assertConservation(g, actes); assert.deepEqual(actes, snapshot);
});
test("A : un orphelin unique devient Primo malgré l'Entretien configuré", () => {
  const g = grid([act()]); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT");
  assert.deepEqual(extraireActionsPrevues(g).map((a) => a.etapeId), ["rappel"]);
});
test("un entretien structuré reste indépendant et ne bloque pas l'inférence Primo avant un Rappel", () => {
  const entretien = act({ sourceId: "v3", date: jour("2026-10-20"), protocoleId: protocol.id, etapeProtocoleId: "entretien" });
  const actes = [act(), rappel(), entretien];
  const interpretation = interpret(actes);
  assert.equal(interpretation.historique.find((v) => v.etapeProtocoleId === "primo")?.sourceId, "v1");
  assert.equal(interpretation.historique.find((v) => v.etapeProtocoleId === "rappel")?.sourceId, "v2");
  assert.equal(interpretation.historique.find((v) => v.etapeProtocoleId === "entretien")?.sourceId, "v3");
  const g = grid(actes);
  assert.equal(g.lignes[0].cellules.primo.statut, "FAIT");
  assert.equal(g.lignes[0].cellules.rappel.statut, "FAIT");
  assert.equal(g.lignes[0].cellules.entretien.statut, "FAIT");
});
test("un entretien structuré ultérieur ne bloque pas l'inférence de la seule dose initiale", () => {
  const single = { ...protocol, configurationQuestionnaireJson: JSON.stringify({ ...config, demarrage: { type: "DOSE_UNIQUE", etapeDoseId: "primo", preconisationId: "p", calendrier: { type: "AGE_MINIMUM", age: { valeur: 14, unite: "JOUR" } } } }), etapes: [step("primo", 0), protocol.etapes[2]] };
  const entretien = act({ sourceId: "v3", date: jour("2026-10-20"), protocoleId: single.id, etapeProtocoleId: "entretien" });
  const g = grid([act(), entretien], single);
  assert.equal(g.lignes[0].cellules.primo.statut, "FAIT");
  assert.equal(g.lignes[0].cellules.entretien.statut, "FAIT");
});
test("C : deux orphelins restent visibles à rattacher, sans fausse recommandation", () => {
  const actes = [act(), act({ sourceId: "v2", date: now })], g = grid(actes);
  assert.equal(g.lignes[0].cellules.primo.historiquesAValider.length, 2);
  assert.equal(g.lignes[0].cellules.primo.aValider, true); assert.deepEqual(extraireActionsPrevues(g), []); assertConservation(g, actes);
});
test("D : hors population actuelle, le fait reste visible sans recommandation", () => {
  const g = grid([act()], { ...protocol, sexeCible: "F" }); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assert.deepEqual(extraireActionsPrevues(g), []);
});
test("E : un traitement VACCIN unifié reste un fait réel", () => {
  const actes = unifierActesVaccinaux([], [{ id: "t1", dateDebut: jour("2026-09-18"), medicamentNom: med.nom, medicamentId: med.id, voie: "SC", dose: 5 }]);
  const g = grid(actes); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assert.equal(g.lignes[0].cellules.primo.actes[0].sourceType, "TRAITEMENT"); assertConservation(g, actes);
});
test("F : nom normalisé unique sans medicamentId reste visible et interprétable", () => {
  const a = act({ medicamentId: null, vaccin: "  bôvilis   bovigrip " }), g = grid([a]); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assertConservation(g, [a]);
});
test("G : produit partagé entre protocoles : aucune attribution automatique", () => {
  const other = { ...protocol, id: "autre", etapes: protocol.etapes.map((e) => ({ ...e, id: "autre-" + e.id })) };
  assert.equal(medicamentPartageEntreProtocoles(protocol, [protocol, other]), true);
  const g = grid([act()], protocol, {}, [protocol, other]); assertConservation(g, [act()]); assert.deepEqual(extraireActionsPrevues(g), []);
  assert.equal(Object.values(g.lignes[0].cellules).some((c) => c.statut === "FAIT"), false);
});
test("H : aucune inférence vers une gestation, les actes structurés anciens restent visibles", () => {
  const gestConfig = structuredClone(config); gestConfig.demarrage.calendrierPrimo = { type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } };
  const p = { ...protocol, configurationQuestionnaireJson: JSON.stringify(gestConfig) };
  const orphelin = act(), g = grid([orphelin], p, { gestationId: "g1", dateVelagePrevueIso: jour("2027-01-01").toISOString() });
  assert.equal(g.lignes[0].cellules.primo.aValider, true); assert.deepEqual(extraireActionsPrevues(g), []); assertConservation(g, [orphelin]);
  const ancien = act({ protocoleId: p.id, etapeProtocoleId: "entretien", gestationId: "g0" });
  const h = grid([ancien], p, { gestationId: "g1", dateVelagePrevueIso: jour("2027-01-01").toISOString() });
  assert.notEqual(h.lignes[0].cellules.entretien.statut, "FAIT"); assertConservation(h, [ancien]);
});
test("I : acquis sans actes ne fabrique aucune injection", () => {
  const g = grid([], protocol, { statutsProtocoles: [{ protocoleId: protocol.id, statut: "PROTOCOLE_ACQUIS" }] }); assert.equal(covered(g).length, 0); assert.equal(Object.values(g.lignes[0].cellules).some((c) => c.statut === "FAIT"), false);
});
test("J : identifiant d'étape ancien après révision : fait conservé, pas d'étape fabriquée", () => {
  const ancien = act({ protocoleId: protocol.id, etapeProtocoleId: "ancien-id" }), g = grid([ancien, rappel()]);
  assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assertConservation(g, [ancien, rappel()]);
  const ambigus = [ancien, act({ sourceId: "v3", protocoleId: protocol.id, etapeProtocoleId: "autre-ancien-id" })];
  const h = grid(ambigus); assert.equal(h.lignes[0].cellules.primo.historiquesAValider.length, 2); assertConservation(h, ambigus);
});
test("un acte postérieur au Rappel ou un Primo déjà connu interdit l'inférence", () => {
  const tardif = act({ date: jour("2026-10-18") }), g = grid([tardif, rappel()]);
  assert.notEqual(g.lignes[0].cellules.primo.statut, "FAIT"); assert.equal(g.lignes[0].cellules.rappel.statut, "FAIT"); assertConservation(g, [tardif, rappel()]); assert.deepEqual(extraireActionsPrevues(g), []);
  const primo = act({ protocoleId: protocol.id, etapeProtocoleId: "primo" }), h = grid([primo, tardif]);
  assert.equal(h.lignes[0].cellules.primo.actes.length, 1); assert.equal(h.lignes[0].cellules.primo.historiquesAValider.length, 1); assertConservation(h, [primo, tardif]);
});
test("un seul orphelin avant le Rappel peut être le Primo ; un orphelin après reste à confirmer", () => {
  const tardif = act({ sourceId: "v3", date: jour("2026-10-18") });
  const actes = [act(), rappel(), tardif], g = grid(actes);
  assert.equal(g.lignes[0].cellules.primo.statut, "FAIT");
  assert.equal(g.lignes[0].cellules.primo.date.toISOString().slice(0, 10), "2026-09-18");
  assert.equal(g.lignes[0].cellules.primo.historiquesAValider[0].sourceId, "v3");
  assert.equal(g.lignes[0].cellules.rappel.statut, "FAIT"); assertConservation(g, actes);
});
test("une Primo identifiable par son médicament reste inférable si le Rappel utilise un autre produit", () => {
  const medRappel = { ...med, id: "med-rappel", nom: "AUTRE VACCIN" };
  const p = { ...protocol, etapes: [step("primo", 0), { ...step("rappel", 1, "INITIAL", "ETAPE_PRECEDENTE"), medicamentId: medRappel.id, medicamentNom: medRappel.nom, medicaments: [{ medicamentId: medRappel.id, medicament: medRappel }] }, protocol.etapes[2]] };
  const g = grid([act()], { ...p, configurationQuestionnaireJson: null });
  assert.equal(g.lignes[0].cellules.primo.statut, "FAIT");
  assert.notEqual(g.lignes[0].cellules.rappel.statut, "FAIT");
});
test("legacy et questionnaire conservent tous les faits, même sur une première case déjà faite", () => {
  for (const p of [protocol, { ...protocol, configurationQuestionnaireJson: null }]) {
    const actes = [act({ protocoleId: p.id, etapeProtocoleId: "primo" }), act({ sourceId: "v3", date: now }), act({ sourceId: "v4", date: jour("2026-10-16") })];
    const g = grid(actes, p); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assert.equal(g.lignes[0].cellules.primo.historiquesAValider.length, 2); assertConservation(g, actes); assert.deepEqual(extraireActionsPrevues(g), []);
  }
});

// Run the actual server loader with a read-only in-memory Prisma substitute.
// No prisma module is loaded and any unexpected dependency/query fails the test.
const require = createRequire(import.meta.url);
function preparationLoader(protocols, animals) {
  const ts = require("typescript");
  const source = readFileSync(new URL("../lib/vaccine-preparation-data.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const testModule = { exports: {} };
  const fakeRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/prisma") return { prisma: { protocoleVaccin: { findMany: async () => protocols }, animal: { findMany: async () => animals } } };
    if (id.startsWith("@/lib/")) return require(path.resolve(id.replace("@/", "") + ".ts"));
    return require(id);
  };
  new Function("require", "module", "exports", compiled)(fakeRequire, testModule, testModule.exports);
  return testModule.exports.getPreparationsVaccinales;
}
const dbAnimal = (actes) => ({ id: "a7509", nutrav: "7509", nobovi: "BUBULEUR", danais: jour("2026-09-01"), sexbov: "M", estGenisse: false, categorie: null, groupe: null, localisation: null, mereTravailManuel: null, mere: null, _count: { velagesVache: 0 }, saillies: [], vaccinations: actes, traitements: [], statutsProtocolesVaccinaux: [{ protocoleId: protocol.id, statut: "PRIMO_A_FAIRE" }] });
test("préparation réelle : BUBULEUR propose uniquement l'Entretien, jamais un nouveau Primo", async () => {
  const groupes = await preparationLoader([protocol], [dbAnimal([act(), rappel()])])(now);
  assert.equal(groupes[0].aConfirmer.length, 0); assert.deepEqual(groupes[0].lignes.map((l) => l.etapeProtocoleId), ["entretien"]);
});
test("préparation réelle : des actes ambigus restent à confirmer même si le planner termine", async () => {
  const p = { ...protocol, configurationQuestionnaireJson: JSON.stringify({ ...config, entretien: { actif: false } }) };
  const actes = [act({ protocoleId: protocol.id, etapeProtocoleId: "primo" }), rappel(), act({ sourceId: "v3", date: jour("2026-10-18") })];
  const groupes = await preparationLoader([p], [dbAnimal(actes)])(now);
  assert.equal(groupes[0].lignes.length, 0); assert.equal(groupes[0].aConfirmer[0].historique.length, 1);
});

test("un Rappel réel prouve le même produit même si sa liaison médicament legacy manque", () => {
  const p = { ...protocol, etapes: protocol.etapes.map((e) => e.id === "rappel" ? { ...e, medicaments: [], medicamentId: null, medicamentNom: null } : e) };
  const g = grid([act(), rappel()], p); assert.equal(g.lignes[0].cellules.primo.statut, "FAIT"); assert.equal(g.lignes[0].cellules.rappel.statut, "FAIT");
});
test("un autre produit portant le même libellé ne prouve jamais une Primo", () => {
  const a = act({ medicamentId: "autre-produit" }), g = grid([a]);
  assert.notEqual(g.lignes[0].cellules.primo.statut, "FAIT"); assert.equal(interpret([a]).acteInfere, null);
});
test("un produit secondaire partagé suffit à bloquer l'inférence", () => {
  const secondMed = { id: "second", nom: "Autre vaccin" };
  const p = { ...protocol, etapes: protocol.etapes.map((e) => ({ ...e, medicaments: [...e.medicaments, { medicament: secondMed }] })) };
  const other = { ...protocol, id: "autre", etapes: [{ ...step("autre-primo", 0), medicaments: [{ medicament: secondMed }] }] };
  assert.equal(medicamentPartageEntreProtocoles(p, [p, other]), true);
  const g = grid([act()], p, {}, [p, other]); assert.equal(g.lignes[0].cellules.primo.aValider, true);
});
test("pharmacie sans protocole : ancien acte au nom normalisé unique reste FAIT", () => {
  const a = act({ medicamentId: null, vaccin: "  bôvilis  bovigrip " });
  const g = construireGrilleVaccinale([animal([a])], [], [{ medicamentId: med.id, nom: med.nom, voie: "SC" }], now);
  assert.equal(g.lignes[0].cellules[med.id].statut, "FAIT"); assertConservation(g, [a]);
});
