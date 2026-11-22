import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/taureaux/[id]/page.tsx", import.meta.url), "utf8");

test("la descendance affiche les deux identifiants sans saisie", () => {
  assert.match(source, /N° national : \{nationalWithCountry\(bull\.nupere\) \|\| "Non renseigné"\}/);
  assert.match(source, /N° de travail :/);
  assert.match(source, /\\d\{4\}\$/);
  assert.match(source, /"Non renseigné"/);
});

test("les quatre derniers chiffres conservent les zéros initiaux", () => {
  const workNumber = (value) => (/\d{4}$/.exec(value?.replace(/\s+/g, "") ?? "")?.[0] ?? "Non renseigné");
  assert.equal(workNumber("FR1234560012"), "0012");
  assert.equal(workNumber("1234560000"), "0000");
  assert.equal(workNumber(null), "Non renseigné");
  assert.equal(workNumber(""), "Non renseigné");
  assert.equal(workNumber("UMETXO"), "Non renseigné");
});
