import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la liste construit une seule carte avec le nombre et les noms des médicaments", async () => {
  const [ordonnancesPage, pharmaciePage, client] = await Promise.all([
    readFile(new URL("../app/ordonnances/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pharmacie/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ordonnances/OrdonnancesClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(ordonnancesPage, /regrouperOrdonnancesPourListe/);
  assert.match(pharmaciePage, /regrouperOrdonnancesPourListe/);
  assert.match(client, /ord\.medicaments\.length} médicament/);
  assert.match(client, /ord\.medicaments\.map/);
  assert.match(client, /hrefWithOrigin\(`\/ordonnances\/\$\{ord\.id}`\)/);
});
