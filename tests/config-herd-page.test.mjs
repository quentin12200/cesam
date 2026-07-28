import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../app/config/troupeau/page.tsx", import.meta.url),
  "utf8"
);
const oldMenu = await readFile(
  new URL("../components/GlobalSettingsButton.tsx", import.meta.url),
  "utf8"
);

test("la sous-page et l’ancien menu réutilisent IdentificationSettings", () => {
  assert.match(page, /import IdentificationSettings from "@\/components\/IdentificationSettings"/);
  assert.match(page, /<IdentificationSettings \/>/);
  assert.match(oldMenu, /import IdentificationSettings from "@\/components\/IdentificationSettings"/);
  assert.match(oldMenu, /<IdentificationSettings \/>/);
});

test("la page ne recrée ni formulaire ni accès direct à l’API", () => {
  assert.doesNotMatch(page, /fetch\(|\/api\/identification|<input|<form/);
});

test("le retour, la portée et l’avertissement sont présents", () => {
  assert.match(page, /href="\/config"/);
  assert.match(page, /Lots de boucles et numérotation/);
  assert.match(page, /Toute l’exploitation/);
  assert.match(page, /Ces réglages déterminent les numéros proposés/);
  assert.match(page, /Vérifiez les\s+numéros avant d’enregistrer/);
});
