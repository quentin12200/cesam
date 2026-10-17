// Standalone browser fixture: real component, React, Tailwind and date helpers.
// No Next server, API or database. PLAYWRIGHT_MODULE can use a shared installation.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";

const require = createRequire(import.meta.url);
const repo = process.cwd();
const file = "app/troupeau/[nutrav]/ReproductiveCycleTimeline.tsx";
const original = execFileSync("git", ["show", `ea18a17bd22da17874fb845997a2f3bf8d29bd9e:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");
const updated = readFileSync(file, "utf8").replaceAll("\r\n", "\n");

test("le modèle, les calculs graphiques et les événements restent identiques au HEAD de départ", () => {
  const model = (source) => source.slice(source.indexOf("  const model = useMemo"), source.indexOf("  return (\n    <section"));
  assert.equal(model(updated), model(original));
  const ring = (source) => source.slice(source.indexOf('            <div className="relative mx-auto my-3 aspect-square'), source.lastIndexOf("          </div>"));
  assert.equal(ring(updated), ring(original));
  const page = readFileSync("app/troupeau/[nutrav]/page.tsx", "utf8");
  assert.match(page, /animal\.sexbov === "F" &&[\s\S]*<ReproductiveCycleTimeline \{\.\.\.reproductiveCycleProps\}/);
});

test("fiche repro compacte : scénarios et interactions navigateur", { timeout: 180_000 }, async (t) => {
  const scratch = mkdtempSync(path.join(tmpdir(), "cesam-repro-ui-"));
  t.after(() => {
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith("cesam-repro-ui-"));
    rmSync(scratch, { recursive: true, force: true });
  });
  writeFileSync(path.join(scratch, "baseline.tsx"), original);
  writeFileSync(path.join(scratch, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))}); module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  writeFileSync(path.join(scratch, "entry.js"), `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import Current from ${JSON.stringify(path.join(repo, file))};
    import Baseline from './baseline.tsx';
    const root=createRoot(document.getElementById('root'));
    window.renderCycle=(values,baseline=false)=>{
      const props={...values};
      for(const key of ['breedingDate','dueDate','echoDate','lastCalvingDate','calfBirthDate','statusModifiedAt','dryOffDate']) if(props[key]) props[key]=new Date(props[key]);
      root.render(React.createElement(baseline?Baseline:Current,props));
    };
  `);
  const webpack = require("next/dist/compiled/webpack/webpack");
  webpack.init();
  const compiler = webpack.webpack({
    mode: "development", devtool: false, entry: path.join(scratch, "entry.js"),
    output: { path: scratch, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": repo }, modules: [path.join(repo, "node_modules"), "node_modules"] },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(scratch, "loader.cjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const css = await require("postcss")([require("@tailwindcss/postcss")({ base: repo })]).process(readFileSync("app/globals.css", "utf8"), { from: path.join(repo, "app/globals.css") });
  const bundle = readFileSync(path.join(scratch, "bundle.js"));
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(bundle); }
    else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css.css); }
    else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main id="root" style="padding:12px;max-width:896px;margin:auto"></main><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  t.after(() => browser.close());
  const now = new Date("2026-10-17T10:00:00Z");
  const date = (days) => new Date(now.getTime() + days * 86400000).toISOString();
  const defaults = {
    status: null, breedingDate: null, breedingType: null, dueDate: null, echoDate: null,
    echoResult: null, echoObservation: null, lastCalvingDate: null, calfNumber: null,
    calfSex: null, calfBirthDate: null, calfSevreDone: false, breedingReference: null,
    statusModifiedAt: null, restObjectiveDays: 60, breedingStartDays: 61,
    reproductionDelayDays: 100, echoPreparationEnabled: true, echoPreparationDays: 30,
    echoDueDays: 45, imminentCalvingDays: 30, dryOffCalfAgeMonths: 7,
    dryOffDone: false, dryOffDate: null,
  };
  const scenarios = [
    ["gestante", { status: "VERT", breedingDate: date(-100), dueDate: date(185), echoDate: date(-40), echoResult: "PLEINE" }, "Gestante"],
    ["écho", { status: "JAUNE", breedingDate: date(-65) }, "À échographier"],
    ["repos", { status: "REPOS", lastCalvingDate: date(-42) }, "Repos post-vêlage"],
    ["retard", { status: "REPOS", lastCalvingDate: date(-118) }, "Retard"],
    ["tarissement", { status: "VERT", breedingDate: date(-100), calfBirthDate: date(-300), calfNumber: "9262" }, "Gestante"],
    ["terme dépassé", { status: "ROSE", breedingDate: date(-290), dueDate: date(-5) }, "Terme dépassé"],
    ["écho négative", { status: "ROUGE", breedingDate: date(-65), echoDate: date(-2), echoResult: "VIDE" }, "À remettre à la reproduction"],
    ["sans donnée", {}, "Cycle à renseigner"],
    ["statut manuel sans saillie", { status: "VERT" }, "Cycle à renseigner"],
  ];
  for (const [name, values, title] of scenarios) {
    await t.test(name, async () => {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      page.setDefaultTimeout(8000);
      page.on("pageerror", (error) => t.diagnostic(error.message));
      try {
        await page.clock.install({ time: now });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.renderCycle);
        const props = { ...defaults, ...values };
        await page.evaluate((p) => window.renderCycle(p, true), props);
        const section = page.locator("section");
        await section.waitFor();
        const baselineLabel = await section.getAttribute("aria-label");
        const baselineAlerts = await page.locator("aside").allTextContents();
        await page.evaluate((p) => window.renderCycle(p), props);
        const summary = page.getByLabel("Résumé reproduction");
        await summary.waitFor();
        assert.equal(await section.getAttribute("aria-label"), baselineLabel);
        assert.ok((await summary.innerText()).includes(title));
        assert.deepEqual(await page.locator("aside").allTextContents(), baselineAlerts);
        assert.equal(await page.getByRole("img").count(), 0);
        assert.ok((await summary.boundingBox()).height <= 90);
        const toggle = page.getByRole("button", { name: "Voir le cycle repro", exact: true });
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.ok((await toggle.boundingBox()).height >= 44);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (name === "retard" || name === "tarissement") assert.ok(baselineAlerts.length > 0);
        await toggle.click();
        await page.getByRole("img").waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (values.breedingDate) {
          const event = page.getByRole("button", { name: /Saillie naturelle,.*Afficher les détails/ });
          await event.click();
          assert.equal(await event.getAttribute("aria-expanded"), "true");
          assert.ok((await page.locator('[aria-live="polite"]').innerText()).includes("Saillie naturelle"));
        }
        await page.getByRole("button", { name: "Masquer le cycle repro", exact: true }).click();
        assert.equal(await page.getByRole("img").count(), 0);
        assert.deepEqual(await page.locator("aside").allTextContents(), baselineAlerts);
        await page.setViewportSize({ width: 1280, height: 800 });
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await summary.isVisible(), true);
      } catch (error) { t.diagnostic(`${name}: ${error.message}`); throw error; }
      finally { await page.close(); }
    });
  }
});
