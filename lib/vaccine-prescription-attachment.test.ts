import test from "node:test";
import assert from "node:assert/strict";
import { verifierRattachementOrdonnanceActe } from "./vaccine-prescription-attachment.ts";

const base = { sourceType: "VACCINATION", sourceId: "v1", ordonnanceId: "o1", acteExiste: true, estVaccin: true, medicamentId: "hepizovac", medicamentsOrdonnanceIds: ["hepizovac"], ordonnanceActuelleId: null };
test("existing vaccine: compatible ordonnance accepted", () => assert.equal(verifierRattachementOrdonnanceActe(base), null));
test("existing treatment vaccine: accepted", () => assert.equal(verifierRattachementOrdonnanceActe({ ...base, sourceType: "TRAITEMENT" }), null));
test("non vaccine treatment rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, sourceType: "TRAITEMENT", estVaccin: false })!, /pas une vaccination/));
test("wrong medicine rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentsOrdonnanceIds: ["autre"] })!, /ne contient pas/));
test("missing catalog id rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null })!, /ne contient pas/));
test("different existing ordonnance cannot be silently replaced", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, ordonnanceActuelleId: "o2" })!, /déjà associée/));
test("same ordonnance can be confirmed again", () => assert.equal(verifierRattachementOrdonnanceActe({ ...base, ordonnanceActuelleId: "o1" }), null));
test("missing source rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, sourceId: "" })!, /requis/));

test("historical MHE vaccine: exact single-medicine match accepted", () => assert.equal(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null, nomVaccinActe: " Hepizovac ", nomsVaccinsOrdonnance: ["HEPIZOVAC"], nombreMedicamentsOrdonnance: 1 }), null));
test("historical vaccine: substring similarity rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null, nomVaccinActe: "HEPIZOVAC", nomsVaccinsOrdonnance: ["HEPIZOVAC PLUS"], nombreMedicamentsOrdonnance: 1 })!, /correspondance exacte/));
test("historical vaccine: multi-medicine ordonnance rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null, nomVaccinActe: "HEPIZOVAC", nomsVaccinsOrdonnance: ["HEPIZOVAC"], nombreMedicamentsOrdonnance: 2 })!, /médicament unique/));
test("historical vaccine: missing name rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null, nomVaccinActe: "", nomsVaccinsOrdonnance: ["HEPIZOVAC"], nombreMedicamentsOrdonnance: 1 })!, /correspondance exacte/));
test("historical vaccine: conflicting names rejected", () => assert.match(verifierRattachementOrdonnanceActe({ ...base, medicamentId: null, nomVaccinActe: "HEPIZOVAC", nomsVaccinsOrdonnance: ["HEPIZOVAC", "AUTRE VACCIN"], nombreMedicamentsOrdonnance: 1 })!, /correspondance exacte/));
