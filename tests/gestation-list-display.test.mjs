import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [badge, herdCards, herdTable, search, reproduction, home, calendar, print] =
  await Promise.all([
    read("app/components/ReproductionListBadge.tsx"),
    read("app/troupeau/page.tsx"),
    read("app/troupeau/TroupeauTableau.tsx"),
    read("app/components/QuickSearch.tsx"),
    read("app/reproduction/page.tsx"),
    read("app/page.tsx"),
    read("app/reproduction/calendrier/page.tsx"),
    read("app/troupeau/impression/page.tsx"),
  ]);

test("le badge partagé utilise le helper, une icône existante et un vert doux", () => {
  assert.match(badge, /formatGestationDuration\(gestationDays\)/);
  assert.match(badge, /CalendarDays/);
  assert.match(badge, /bg-emerald-50 text-emerald-800/);
});

test("les deux vues du troupeau et la recherche utilisent le badge partagé", () => {
  for (const source of [herdCards, herdTable, search]) {
    assert.match(source, /ReproductionListBadge/);
    assert.doesNotMatch(source, /VERT:\s*"Pleine"|label:\s*"Pleines"|\?\s*"Pleine"/);
  }
});

test("la liste reproduction affiche Gestante sans modifier le résultat du formulaire d’échographie", () => {
  assert.match(reproduction, /VERT:\s*"Gestante"/);
  assert.match(reproduction, /ReproductionListBadge/);
  assert.match(reproduction, /✓ Pleine/);
});

test("les récapitulatifs visibles emploient Gestante", () => {
  assert.match(home, /Vaches gestantes/);
  assert.match(calendar, /Vaches gestantes/);
  assert.match(print, /filterParts\.push\("Gestantes"\)/);
  assert.doesNotMatch(calendar, /vaches pleines|Vaches pleines/);
});
