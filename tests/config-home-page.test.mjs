import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/config/page.tsx", import.meta.url), "utf8");

test("la page présente les six rubriques dans l’ordre demandé", () => {
  const titles = [
    "Profil et personnalisation",
    "Exploitation",
    "Troupeau et identification",
    "Reproduction",
    "Santé et traitements",
    "Notifications",
  ];

  let previousIndex = -1;
  for (const title of titles) {
    const index = source.indexOf(`title: "${title}"`);
    assert.ok(index > previousIndex, `${title} doit être présent dans le bon ordre`);
    previousIndex = index;
  }
});

test("les six destinations disponibles sont liées", () => {
  for (const href of [
    "/config/profil",
    "/config/exploitation",
    "/config/troupeau",
    "/config/reproduction",
    "/config/protocoles",
    "/config/notifications",
  ]) {
    assert.match(source, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  }

  assert.equal((source.match(/href: "\/config\//g) ?? []).length, 6);
  assert.doesNotMatch(source, /pending: true|Encore disponible dans le menu actuel/);
});

test("le bouton retour, la grille mobile et la légende des portées sont présents", () => {
  assert.match(source, /<BackButton/);
  assert.match(source, /grid-cols-1/);
  assert.match(source, /sm:grid-cols-2/);
  assert.match(source, /Cet appareil/);
  assert.match(source, /Profil Céline ou Samuel/);
  assert.match(source, /Toute l’exploitation/);
});
