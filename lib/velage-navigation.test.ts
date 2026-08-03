import assert from "node:assert/strict";
import test from "node:test";
import { buildVelageEditHref } from "./velage-navigation.ts";

test("transmet l’identifiant du vêlage et le retour vers la fiche mère", () => {
  const href = buildVelageEditHref("velage-123", "/troupeau/9260?onglet=reproduction");
  const url = new URL(href, "https://cesam.local");

  assert.equal(url.pathname, "/velage");
  assert.equal(url.searchParams.get("modifier"), "velage-123");
  assert.equal(url.searchParams.get("returnTo"), "/troupeau/9260?onglet=reproduction");
});
