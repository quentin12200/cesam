import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("toutes les pages produisent un seul scan et une seule extraction", async () => {
  const [client, scanRoute, extractionRoute, interfaceSource] = await Promise.all([
    readFile(new URL("../lib/scan-ordonnance-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scan-ordonnance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/extractions-ordonnance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ordonnances/OrdonnancesClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(client, /images:\s*pages\.map/);
  assert.match(client, /documentUrls/);
  assert.equal((client.match(/fetch\("\/api\/scan-ordonnance"/g) ?? []).length, 1);
  assert.equal((client.match(/fetch\("\/api\/extractions-ordonnance"/g) ?? []).length, 1);
  assert.match(scanRoute, /\.\.\.images\.map/);
  assert.match(extractionRoute, /documentUrls:\s*JSON\.stringify\(pages\)/);
  assert.match(interfaceSource, /Ajouter une page/);
  assert.match(interfaceSource, /supprimerPageOrdonnance/);
});
