import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("app/config/coulisses/page.tsx");
test("Coulisses reuses existing routes exactly once", () => {
  const routes = [...page.matchAll(/href: "([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(routes, ["/taureaux/controle", "/taureaux/controle/anciens-velages", "/taureaux/doublons", "/troupeau/identification", "/ordonnances"]);
  for (const route of routes) assert.ok(existsSync(new URL("../app" + route + "/page.tsx", import.meta.url)), route);
});
test("hub has no database, mutation, API calls or unverified counters", () => {
  assert.doesNotMatch(page, /\b(?:prisma|fetch|useServer|onClick|formAction|process\.env)\b|<form|\/api\//);
  assert.match(page, /Cette page n’effectue aucune correction/);
  assert.match(page, /pas encore isolés/);
  assert.match(page, /ne sont pas encore disponibles/);
});
test("settings retain Lab and expose hub; hub retains back link and mobile sizing", () => {
  const settings = read("app/config/page.tsx");
  assert.match(settings, /href="\/config\/coulisses"/);
  assert.match(settings, /href="\/lab"/);
  assert.match(settings, /non isolé/);
  assert.match(page, /href="\/config"/);
  assert.match(page, /href="\/lab"/);
  assert.match(page, /grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(page, /min-h-11 min-w-0/);
  assert.match(page, /break-words/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(page, /prefetch=\{false\}/);
  assert.doesNotMatch(read("middleware.ts"), /"\/config(?:\/coulisses)?"/);
});
