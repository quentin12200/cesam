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
  assert.match(ordonnancesPage, /nomExtrait: true, conditionnement: true, evidenceJson: true/);
  assert.match(ordonnancesPage, /normaliserConditionnementEnregistre/);
  assert.match(pharmaciePage, /regrouperOrdonnancesPourListe/);
  assert.match(client, /ord\.medicaments\.length} médicament/);
  assert.match(client, /ord\.medicaments\.map/);
  assert.match(client, /formaterMedicamentPourListe/);
  assert.match(client, /Qté \{affichage\.quantite\}/);
  assert.doesNotMatch(client, /Vét\. : \{ord\.veterinaireNom\}/);
  assert.doesNotMatch(client, /Motif : \{ord\.motif\}/);
  assert.match(client, /source=\$\{encodeURIComponent\(ord\.sourceKey\)\}/);
});
