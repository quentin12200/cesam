import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const middleware = await readFile(
  new URL("../middleware.ts", import.meta.url),
  "utf8",
);

test("le prototype fictif est accessible sans session CESAM", () => {
  assert.match(middleware, /"\/prototype-espace-travail"/);
  assert.match(middleware, /PUBLIC_PATHS\.some/);
});

test("les espaces CESAM réels restent protégés", () => {
  assert.doesNotMatch(middleware, /"\/troupeau"/);
  assert.doesNotMatch(middleware, /"\/sanitaire"/);
  assert.doesNotMatch(middleware, /"\/finances"/);
});
