import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classerAdministrations } from "./vaccine-questionnaire-administration.ts";

const administration = (statut: string, overrides: Record<string, unknown> = {}) => ({
  id: "p1", statut, dose: 2, unite: "ml", voie: "IM", ...overrides,
});

test("aucune administration valide propose la création inline", () => {
  assert.deepEqual(classerAdministrations([]), { valides: [], aVerifier: [], proposerCreation: true });
});

test("une administration à vérifier est revue sans proposer de doublon", () => {
  const resultat = classerAdministrations([administration("A_VERIFIER")]);
  assert.equal(resultat.valides.length, 0);
  assert.equal(resultat.aVerifier.length, 1);
  assert.equal(resultat.proposerCreation, false);
});

test("une administration valide unique masque le mini-formulaire inutile", () => {
  const resultat = classerAdministrations([administration("VALIDE")]);
  assert.equal(resultat.valides.length, 1);
  assert.equal(resultat.proposerCreation, false);
});

test("une administration incomplète ne débloque pas Continuer", () => {
  assert.equal(classerAdministrations([administration("VALIDE", { voie: null })]).valides.length, 0);
});

test("la sauvegarde inline utilise les API existantes et conserve l'état du questionnaire", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /fetch\(preconisationEditionId \? `\/api\/preconisations\/\$\{preconisationEditionId\}` : "\/api\/preconisations"/);
  assert.match(source, /source: "Saisie depuis protocole", statut: "VALIDE"/);
  assert.match(source, /doseBase: administrationForm\.doseBase \|\| "ANIMAL"/);
  assert.match(source, /setForm\(\(ancien\) => completerPreconisationsVides\(ancien, enregistree\.id\)\)/);
});
