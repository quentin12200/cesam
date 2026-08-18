import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("le flux du scan balise chaque étape sans conserver l'erreur générique", async () => {
  const [scanRoute, documentRoute, extractionRoute, client] = await Promise.all([
    readFile(new URL("../app/api/scan-ordonnance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/ordonnances/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/extractions-ordonnance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scan-ordonnance-client.ts", import.meta.url), "utf8"),
  ]);

  assert.match(documentRoute, /logOrdonnanceScanFailure\("document"/);
  assert.match(scanRoute, /logOrdonnanceScanFailure\("openai_call"/);
  assert.match(scanRoute, /logOrdonnanceScanFailure\("openai_response"/);
  assert.match(scanRoute, /logOrdonnanceScanFailure\("pharmacy_candidates"/);
  assert.match(scanRoute, /logOrdonnanceScanFailure\("transcription"/);
  assert.match(extractionRoute, /logOrdonnanceScanFailure\("database"/);
  assert.doesNotMatch(client, /"Erreur lors du scan"/);
});
