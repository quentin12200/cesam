import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/taureaux/[id]/page.tsx", import.meta.url), "utf8");

test("la descendance affiche les deux identifiants sans saisie", () => {
  assert.match(source, /N° national : \{nationalWithCountry\(bull\.nupere\) \|\| "Non renseigné"\}/);
  assert.match(source, /N° de travail : \{bull\.nupere\?/);
  assert.match(source, /\.slice\(-4\)/);
  assert.match(source, /"Non renseigné"/);
});

test("les quatre derniers chiffres conservent les zéros initiaux", () => {
  const workNumber = (value) => value?.replace(/\s+/g, "").replace(/^[A-Za-z]{2}/, "").slice(-4) || "Non renseigné";
  assert.equal(workNumber("FR1234560012"), "0012");
  assert.equal(workNumber("1234560000"), "0000");
  assert.equal(workNumber(null), "Non renseigné");
  assert.equal(workNumber(""), "Non renseigné");
});
