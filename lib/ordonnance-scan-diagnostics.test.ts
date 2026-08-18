import assert from "node:assert/strict";
import test from "node:test";

import {
  isOrdonnanceScanStage,
  ordonnanceScanUserMessage,
  safeOrdonnanceScanError,
} from "./ordonnance-scan-diagnostics.ts";

test("distingue les étapes du scan avec un message utilisateur simple", () => {
  assert.equal(ordonnanceScanUserMessage("document"), "Le scan a échoué pendant le téléversement du document");
  assert.equal(ordonnanceScanUserMessage("pharmacy_candidates"), "Le scan a échoué pendant le chargement de la Pharmacie");
  assert.equal(ordonnanceScanUserMessage("openai_call"), "Le scan a échoué pendant l’analyse IA");
  assert.equal(ordonnanceScanUserMessage("openai_response"), "Le scan a échoué pendant la lecture de la réponse IA");
  assert.equal(ordonnanceScanUserMessage("transcription"), "Le scan a échoué pendant l’analyse du document");
  assert.equal(ordonnanceScanUserMessage("database"), "Le scan a échoué pendant l’enregistrement");
});

test("valide uniquement les étapes de scan connues", () => {
  assert.equal(isOrdonnanceScanStage("openai_call"), true);
  assert.equal(isOrdonnanceScanStage("autre"), false);
  assert.equal(isOrdonnanceScanStage(null), false);
});

test("retire les secrets des erreurs techniques journalisées", () => {
  const safe = safeOrdonnanceScanError(
    new Error("Bearer abc.def.ghi api_key=secret-value token:another-secret sk-1234567890abcdef"),
  );
  assert.equal(safe.name, "Error");
  assert.doesNotMatch(safe.message, /abc\.def|secret-value|another-secret|sk-123/);
  assert.match(safe.message, /REDACTED/);
});
