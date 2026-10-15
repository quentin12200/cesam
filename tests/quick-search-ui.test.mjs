// Start `next dev --port 3107`, then run with node --test.
// PLAYWRIGHT_MODULE may point to a shared Playwright installation.
// Every API call and animal navigation is mocked: no database is accessed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.CESAM_TEST_URL || "http://127.0.0.1:3107";
const animal = (nutrav) => ({
  nutrav, nom: `Animal ${nutrav}`, ageLabel: "12 m", categorie: "Mâle",
  etatGestation: null, mheVendable: false, mheRaison: "", dernierPoids: null,
});

test("QuickSearch est monté dans le header global", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<header\b[\s\S]*<QuickSearch\s*\/>[\s\S]*<TopNav\s*\/>[\s\S]*<\/header>/);
});

test("recherche globale dans le navigateur", { timeout: 180_000 }, async (t) => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  t.after(() => browser.close());

  async function setup(viewport = { width: 1280, height: 800 }) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
    t.after(() => context.close());
    // Fail closed for APIs, including background header features.
    await context.route("**/api/**", (route) => route.fulfill({ status: 401, json: {} }));
    await context.route("**/troupeau/**", (route) => route.fulfill({ contentType: "text/html", body: "Fiche animal simulée" }));
    await context.addInitScript(() => {
      sessionStorage.setItem("splashDone", "1");
      window.searchCalls = [];
      window.searchResponses = {};
      window.pendingSearches = {};
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, options) => {
        const url = new URL(String(input), location.href);
        if (url.pathname !== "/api/search") return originalFetch(input, options);
        const q = url.searchParams.get("q");
        window.searchCalls.push(q);
        const response = window.searchResponses[q] || { data: [] };
        // Deliberately ignore AbortSignal to exercise the stale-response guard.
        if (response.pending) return new Promise((resolve, reject) => {
          window.pendingSearches[q] = { resolve, reject };
        });
        if (response.error) throw new TypeError("Network unavailable");
        return new Response(JSON.stringify(response.data), { status: response.status || 200 });
      };
    });
    const page = await context.newPage();
    const crashes = [];
    page.on("pageerror", (error) => crashes.push(error.message));
    // This static page uses the real global layout without loading animal data.
    await page.goto(`${baseURL}/acces-refuse`, { waitUntil: "networkidle" });
    const input = page.getByRole("combobox", { name: /Ouvrir une fiche animal/ });
    await page.waitForFunction(() => window.searchCalls !== undefined);
    return { page, input, crashes };
  }

  await t.test("saisie progressive, debounce 280 ms, résultat et ouverture par clic", async () => {
    const { page, input } = await setup();
    await page.evaluate((a) => { window.searchResponses["123"] = { data: [a] }; }, animal("123"));
    assert.equal(await input.isVisible(), true);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await input.fill("1");
    await page.clock.fastForward(150);
    await input.fill("12");
    await page.clock.fastForward(150);
    await input.fill("123");
    await page.clock.fastForward(279);
    assert.deepEqual(await page.evaluate(() => window.searchCalls), []);
    await page.clock.fastForward(1);
    await page.getByRole("option").waitFor();
    assert.deepEqual(await page.evaluate(() => window.searchCalls), ["123"]);
    assert.equal(await page.locator("header").getByRole("button", { name: /Valider/ }).count(), 0);
    await page.getByRole("option").click();
    await page.waitForURL("**/troupeau/123");
  });

  await t.test("aucun résultat reste visible", async () => {
    const { page, input } = await setup();
    await input.fill("introuvable");
    await page.getByRole("status").filter({ hasText: "Aucun résultat" }).waitFor();
    assert.equal(await input.getAttribute("aria-expanded"), "true");
  });

  await t.test("erreurs réseau et HTTP affichées, reprise possible sans crash", async () => {
    const { page, input, crashes } = await setup();
    await page.evaluate(() => {
      window.searchResponses.reseau = { error: true };
      window.searchResponses.http = { status: 503, data: {} };
    });
    for (const q of ["reseau", "http"]) {
      await input.fill(q);
      await page.getByText("Recherche indisponible. Réessayez.").waitFor();
    }
    await input.fill("retour");
    await page.getByText("Aucun résultat", { exact: true }).waitFor();
    assert.deepEqual(crashes, []);
  });

  await t.test("réponse et erreur obsolètes ignorées même si le transport ignore abort", async () => {
    const { page, input } = await setup();
    await page.evaluate((a) => {
      window.searchResponses.ancien = { pending: true };
      window.searchResponses.erreur = { pending: true };
      window.searchResponses.nouveau = { data: [a] };
    }, animal("456"));
    await input.fill("ancien");
    await page.waitForFunction(() => window.pendingSearches.ancien);
    await input.fill("erreur");
    await page.waitForFunction(() => window.pendingSearches.erreur);
    await input.fill("nouveau");
    await page.getByRole("option").filter({ hasText: "Animal 456" }).waitFor();
    await page.evaluate((a) => {
      window.pendingSearches.ancien.resolve(new Response(JSON.stringify([a])));
      window.pendingSearches.erreur.reject(new Error("Ancienne erreur"));
    }, animal("999"));
    await page.waitForTimeout(50);
    assert.equal(await page.getByRole("option").count(), 1);
    assert.match(await page.getByRole("option").innerText(), /Animal 456/);
    assert.equal(await page.getByText("Recherche indisponible. Réessayez.").count(), 0);
  });

  await t.test("effacer et fermer invalident aussi les requêtes en cours", async () => {
    const { page, input } = await setup();
    await page.evaluate(() => { window.searchResponses.attente = { pending: true }; });
    await input.fill("attente");
    await page.waitForFunction(() => window.pendingSearches.attente);
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await page.evaluate((a) => window.pendingSearches.attente.resolve(new Response(JSON.stringify([a]))), animal("999"));
    await page.waitForTimeout(50);
    assert.equal(await input.inputValue(), "");
    assert.equal(await page.getByRole("option").count(), 0);
    await page.evaluate(() => { window.searchResponses.fermer = { pending: true }; });
    await input.fill("fermer");
    await page.waitForFunction(() => window.pendingSearches.fermer);
    await input.press("Escape");
    await page.evaluate((a) => window.pendingSearches.fermer.resolve(new Response(JSON.stringify([a]))), animal("999"));
    await page.waitForTimeout(50);
    assert.equal(await input.getAttribute("aria-expanded"), "false");
    assert.equal(await page.getByRole("option").count(), 0);
  });

  await t.test("flèches, Entrée et Échap au clavier", async () => {
    const { page, input } = await setup();
    await page.evaluate((items) => { window.searchResponses.clavier = { data: items }; }, [animal("123"), animal("456")]);
    await input.fill("clavier");
    await page.getByRole("option").first().waitFor();
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await input.press("ArrowUp");
    assert.equal(await page.getByRole("option").first().getAttribute("aria-selected"), "true");
    await input.press("Escape");
    assert.equal(await input.inputValue(), "");
    await input.fill("clavier");
    await page.getByRole("option").first().waitFor();
    await input.press("ArrowDown");
    await input.press("Enter");
    await page.waitForURL("**/troupeau/123");
  });

  await t.test("mobile : loupe, focus immédiat, résultats lisibles et ouverture", async () => {
    const { page, input } = await setup({ width: 375, height: 667 });
    assert.equal(await input.isVisible(), false);
    await page.getByRole("button", { name: "Rechercher un animal", exact: true }).tap();
    assert.equal(await input.isVisible(), true);
    assert.equal(await input.evaluate((el) => el === document.activeElement), true);
    await page.evaluate((a) => { window.searchResponses.mobile = { data: [a] }; }, animal("789"));
    await input.fill("mobile");
    const option = page.getByRole("option");
    await option.waitFor();
    const box = await option.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375);
    assert.ok(box.height >= 44);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const point = { x: box.x + 20, y: box.y + box.height / 2 };
    // Vaccine sticky columns use z-50: results must remain above them.
    await page.evaluate((rect) => {
      const sticky = document.createElement("div");
      sticky.style.cssText = `position:fixed;z-index:50;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;background:white`;
      document.querySelector("main").append(sticky);
    }, box);
    assert.equal(await option.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), point), true);
    await option.tap();
    await page.waitForURL("**/troupeau/789");
  });
});
