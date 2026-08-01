import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { genererNumerosLibresDuLot } from "../lib/identification.ts";

const conflit = (nunati, utilisePar = null) => ({
  nutrav: nunati.slice(-4),
  nunati,
  utilisePar,
});

test("75-04 et 28 boucles sans conflit se terminent à 75-31", () => {
  const resultat = genererNumerosLibresDuLot("75-04", 28, []);
  assert.equal(resultat.numeros.length, 28);
  assert.equal(resultat.numeros[0].nunati, "75-04");
  assert.equal(resultat.dernierNumero, "75-31");
});

test("75-05 déjà utilisé est sauté et prolonge 28 boucles jusqu’à 75-32", () => {
  const resultat = genererNumerosLibresDuLot("75-04", 28, [
    conflit("75-05", "0005 — Louna"),
  ]);
  assert.equal(resultat.numeros.length, 28);
  assert.equal(resultat.dernierNumero, "75-32");
  assert.ok(!resultat.numeros.some((numero) => numero.nunati === "75-05"));
  assert.deepEqual(
    resultat.sautes.map((numero) => ({
      nunati: numero.nunati,
      utilisePar: numero.utilisePar,
    })),
    [{ nunati: "75-05", utilisePar: "0005 — Louna" }]
  );
});

test("deux conflits prolongent la série de deux numéros sans doublon", () => {
  const resultat = genererNumerosLibresDuLot("75-04", 28, [
    conflit("75-05"),
    conflit("75-10"),
  ]);
  assert.equal(resultat.numeros.length, 28);
  assert.equal(resultat.dernierNumero, "75-33");
  assert.equal(new Set(resultat.numeros.map((numero) => numero.nunati)).size, 28);
  assert.equal(new Set(resultat.numeros.map((numero) => numero.nutrav)).size, 28);
});

test("un conflit apparu après l’aperçu est sauté lors du nouveau calcul serveur", () => {
  const apercu = genererNumerosLibresDuLot("75-04", 28, [
    conflit("75-05"),
  ]);
  const validation = genererNumerosLibresDuLot("75-04", 28, [
    conflit("75-05"),
    conflit("75-06"),
  ]);
  assert.equal(apercu.dernierNumero, "75-32");
  assert.equal(validation.dernierNumero, "75-33");
  assert.equal(validation.numeros.length, 28);
  assert.ok(!validation.numeros.some((numero) => numero.nunati === "75-06"));
});

test("le préfixe et les zéros du format existant sont conservés", () => {
  const resultat = genererNumerosLibresDuLot("FR-0004", 3, [
    conflit("FR-0005"),
  ]);
  assert.deepEqual(
    resultat.numeros.map((numero) => numero.nunati),
    ["FR-0004", "FR-0006", "FR-0007"]
  );
});

test("une plage qui ne permet pas de fournir la quantité échoue explicitement", () => {
  assert.throws(
    () => genererNumerosLibresDuLot("75-99", 2, []),
    /Impossible de trouver 2 numéros libres/
  );
  assert.throws(
    () =>
      genererNumerosLibresDuLot(
        "75-00",
        2,
        [conflit("75-00"), conflit("75-01")],
        2
      ),
    /limite de 2 essais/
  );
});

const settings = await readFile(
  new URL("../components/IdentificationSettings.tsx", import.meta.url),
  "utf8"
);
const route = await readFile(
  new URL("../app/api/identification/route.ts", import.meta.url),
  "utf8"
);
const calvingRoute = await readFile(
  new URL("../app/api/velages/route.ts", import.meta.url),
  "utf8"
);

test("l’aperçu affiche la quantité, les bornes, les numéros sautés et leur animal", () => {
  assert.match(settings, /quantiteDemandee/);
  assert.match(settings, /Série générée/);
  assert.match(settings, /preview\.premierNumero/);
  assert.match(settings, /preview\.dernierNumero/);
  assert.match(settings, /preview\.sautes\.map/);
  assert.match(settings, /utilisé par \$\{numero\.utilisePar\}/);
  assert.match(settings, /setPreview\(null\);\s*setPreviewLoading\(true\)/);
  assert.match(settings, /disabled=\{saving \|\| previewLoading \|\| !preview\}/);
});

test("l’aperçu et la validation utilisent la même génération centrale côté serveur", () => {
  assert.match(route, /body\.preview === true/);
  assert.match(route, /genererNumerosLibresDuLot/);
  assert.match(route, /quantite,\s*prochainIndex: 0/);
  assert.doesNotMatch(route, /Un numéro du lot est déjà utilisé/);
});

test("la consommation du lot compte les boucles utilisées et non les offsets sautés", () => {
  assert.match(calvingRoute, /numerosConsommes/);
  assert.match(
    calvingRoute,
    /lotActif\.prochainIndex \+ numerosConsommes/
  );
  assert.doesNotMatch(calvingRoute, /Math\.max\(\.\.\.indexes\) \+ 1/);
});
