import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../app/config/profil/page.tsx", import.meta.url),
  "utf8"
);
const oldMenu = await readFile(
  new URL("../components/GlobalSettingsButton.tsx", import.meta.url),
  "utf8"
);

test("la sous-page réutilise le même état de profil que l’ancien menu", () => {
  assert.match(page, /useUserPreferences/);
  assert.match(page, /const \{ profile, setProfile, ready \} = useUserPreferences\(\)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.match(oldMenu, /useUserPreferences/);
  assert.match(oldMenu, /const \{ profile, setProfile, ready \} = useUserPreferences\(\)/);
});

test("Céline et Samuel utilisent directement le sélecteur partagé", () => {
  assert.match(page, /const PROFILES: CesamProfile\[\] = \["Céline", "Samuel"\]/);
  assert.match(page, /onClick=\{\(\) => setProfile\(item\)\}/);
  assert.match(page, /aria-pressed=\{profile === item\}/);
});

test("les navigations et les explications demandées sont présentes", () => {
  assert.match(page, /href="\/config"/);
  assert.match(page, /href="\/"/);
  assert.match(page, /Gérer sur l’accueil/);
  assert.match(page, /Profil utilisé sur cet appareil/);
  assert.match(page, /Disposition des écrans/);
  assert.match(page, /Actions rapides de l’accueil/);
  assert.match(page, /Modifier la mise en page/);
});

test("la page ne recrée ni mise en page ni gestionnaire de raccourcis", () => {
  assert.doesNotMatch(page, /LayoutPersonalizer|AccueilShortcuts|mise-en-page|raccourcis-accueil/);
});
