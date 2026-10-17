// Real React components, mocked API only. No CESAM server or database.
// PLAYWRIGHT_MODULE can point to the bundled/shared Playwright installation.
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
const head = "43deec069e215919eb0524901b41f9b93eec3dcd";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const before = (file) => execFileSync("git", ["show", `${head}:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");
const tablePath = "app/sanitaire/vaccins/TableauVaccinal.tsx";

test("aucun changement au moteur, aux cellules, aux sélections ou au PATCH historique", () => {
  for (const file of ["lib/vaccine-grid.ts", "lib/vaccine-planner.ts", "lib/vaccine-selection.ts", "lib/vaccine-acts.ts", "app/api/animaux/[nutrav]/route.ts"]) assert.equal(read(file), before(file));
  const portion = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
  assert.equal(portion(read(tablePath), "  function renduCellule", "  function renduPanneauHistorique"), portion(before(tablePath), "  function renduCellule", "  function renduPanneauHistorique"));
  const route = read("app/api/animaux/[nutrav]/route.ts");
  assert.match(route, /data\.dateBouclage = body\.boucleFaite \? new Date\(\) : null/);
  assert.equal((read("app/troupeau/identification/page.tsx").match(/\.\.\.BOUCLAGE_POPULATION/g) || []).length, 2);
  for (const file of ["app/components/BouclageIndicator.tsx", "app/components/BouclageLookup.tsx"]) assert.doesNotMatch(read(file), /(?:localStorage|sessionStorage)\.(?:setItem|removeItem)|prisma\.[\w]+\.(?:update|create)/);
  const listRoute = "app/api/animaux/route.ts";
  assert.equal(read(listRoute).slice(read(listRoute).indexOf("export async function POST")), before(listRoute).slice(before(listRoute).indexOf("export async function POST")));
});

test("bouclage terrain : composant et tableau vaccinal réels", { timeout: 180_000 }, async (t) => {
  const scratch = mkdtempSync(path.join(tmpdir(), "cesam-bouclage-ui-"));
  t.after(() => {
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith("cesam-bouclage-ui-"));
    rmSync(scratch, { recursive: true, force: true });
  });
  writeFileSync(path.join(scratch, "baseline.tsx"), before(tablePath));
  writeFileSync(path.join(scratch, "navigation.js"), `export const useRouter=()=>({refresh:()=>{window.refreshes=(window.refreshes||0)+1},push:(url)=>{window.pushed=url}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/fixture';`);
  writeFileSync(path.join(scratch, "link.js"), `import React from 'react';export default function Link({children,href,prefetch,...props}){return React.createElement('a',{href,...props},children)}`);
  writeFileSync(path.join(scratch, "entry.tsx"), `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import Indicator from '@/app/components/BouclageIndicator';
    import {BouclageLookupProvider,BouclageLookupIndicator} from '@/app/components/BouclageLookup';
    import Table from '@/app/sanitaire/vaccins/TableauVaccinal';
    import Baseline from './baseline.tsx';
    const root=createRoot(document.getElementById('root'));
    window.renderView=(mode,props)=>root.render(mode==='indicator'
      ? <div onClick={()=>{window.rowClicks=(window.rowClicks||0)+1}} onTouchStart={()=>{window.rowTouches=(window.rowTouches||0)+1}}><a href='/troupeau/7514'>7514</a><Indicator {...props}/></div>
      : mode==='lookup' ? <BouclageLookupProvider nutravs={['7514']}><BouclageLookupIndicator nutrav='7514'/><BouclageLookupIndicator nutrav='7514'/></BouclageLookupProvider>
      : React.createElement(mode==='baseline'?Baseline:Table,props));
  `);
  writeFileSync(path.join(scratch, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack = require("next/dist/compiled/webpack/webpack"); webpack.init();
  const compiler = webpack.webpack({ mode: "development", devtool: false, entry: path.join(scratch, "entry.tsx"), output: { path: scratch, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": repo, "next/navigation": path.join(scratch, "navigation.js"), "next/link": path.join(scratch, "link.js"), "./CalendrierVaccinal": path.join(repo, "app/sanitaire/vaccins/CalendrierVaccinal.tsx") }, modules: [path.join(repo, "node_modules"), "node_modules"] },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(scratch, "loader.cjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => { compiler.close(() => {}); if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true }))); else resolve(); }));
  const css = await require("postcss")([require("@tailwindcss/postcss")({ base: repo })]).process(read("app/globals.css"), { from: path.join(repo, "app/globals.css") });
  const bundle = readFileSync(path.join(scratch, "bundle.js"));
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(bundle); }
    else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css.css); }
    else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main id="root" style="padding:8px"></main><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  t.after(() => browser.close());
  const base = { nutrav: "7514", boucleFaite: false, estConcerneParBouclage: true };
  async function setup(mode = "indicator", props = base, { response = "success", hold = false, lookupUnavailable = false } = {}) {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 }, hasTouch: true });
    t.after(() => page.close());
    const requests = []; const crashes = []; let release; let done = false;
    page.on("pageerror", (error) => crashes.push(error.message));
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      if (request.method() === "PATCH") {
        requests.push({ url: new URL(request.url()).pathname, body: request.postDataJSON() });
        if (hold) await new Promise((resolve) => { release = resolve; });
        if (response === "network") return route.abort("failed");
        done = response === "success";
        return route.fulfill({ status: done ? 200 : 500, json: done ? { boucleFaite: true } : { error: "Erreur" } });
      }
      if (request.url().includes("/api/animaux?")) return lookupUnavailable ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { animaux: [{ ...base, boucleFaite: done }] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.renderView);
    await page.evaluate(([m,p]) => window.renderView(m,p), [mode, props]);
    return { page, requests, crashes, release: () => release?.() };
  }
  await t.test("à boucler : PATCH unique, chargement, succès, refresh et aucun clic de ligne", async () => {
    const fixture = await setup("indicator", base, { hold: true }); const {page,requests}=fixture;
    const button=page.getByRole("button",{name:/À boucler/}); await button.tap();
    await page.waitForFunction(()=>document.querySelector('button[aria-busy="true"]'));
    assert.equal(await button.isDisabled(),true); assert.equal(requests.length,1);
    assert.deepEqual(requests[0],{url:'/api/animaux/7514',body:{boucleFaite:true}});
    fixture.release(); await page.getByLabel('Bouclé',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.refreshes),1);
    assert.equal(await page.evaluate(()=>window.rowClicks||0),0);
    assert.equal(await page.evaluate(()=>window.rowTouches||0),0);
    assert.equal(await page.getByRole('button',{name:/À boucler/}).count(),0);
    await page.getByLabel('Bouclé',{exact:true}).tap(); assert.equal(requests.length,1);
  });
  await t.test("une réponse ancienne ne marque pas un autre animal si la ligne change", async () => {
    const fixture = await setup('indicator', base, {hold:true});
    const {page}=fixture;
    await page.getByRole('button',{name:/À boucler/}).tap();
    await page.waitForFunction(()=>document.querySelector('button[aria-busy="true"]'));
    await page.evaluate((p)=>window.renderView('indicator',p),{...base,nutrav:'9999'});
    await page.getByRole('button',{name:/marquer 9999/}).waitFor();
    fixture.release(); await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button',{name:/marquer 9999/}).isEnabled(),true);
    assert.equal(await page.getByLabel('Bouclé',{exact:true}).count(),0);
  });
  await t.test("positif non actionnable, adulte non concerné invisible, props resynchronisées", async () => {
    const {page,requests}=await setup('indicator',{...base,boucleFaite:true});
    await page.getByLabel('Bouclé',{exact:true}).waitFor(); assert.equal(await page.getByRole('button').count(),0);
    await page.evaluate((p)=>window.renderView('indicator',p),{...base,boucleFaite:false});
    await page.getByRole('button',{name:/À boucler/}).waitFor();
    await page.evaluate((p)=>window.renderView('indicator',p),{...base,estConcerneParBouclage:false});
    await page.waitForFunction(()=>!document.querySelector('button'));
    assert.equal(await page.getByLabel('Bouclé',{exact:true}).count(),0); assert.equal(requests.length,0);
  });
  await t.test("échec HTTP ou réseau : état conservé et erreur courte sans crash", async () => {
    for(const response of ['http','network']){
      const {page,requests,crashes}=await setup('indicator',base,{response});
      await page.getByRole('button',{name:/À boucler/}).tap(); await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button',{name:/À boucler/}).isEnabled(),true);
      assert.equal(await page.getByLabel('Bouclé',{exact:true}).count(),0);
      assert.equal(requests.length,1); assert.deepEqual(crashes,[]);
    }
  });
  const cell={statut:'A_FAIRE',date:'2026-10-20T12:00:00Z',aValider:false,rattachementProtocoleAutorise:true,historiquesAValider:[],actes:[],prochaine:null,fenetre:{debut:'2026-10-01T12:00:00Z',fin:'2026-10-20T12:00:00Z'}};
  const tableProps={actionsPrevues:[],blocs:[{cle:'m1',nom:'Vaccin test',voie:'SC',protocoleId:'p1',medicamentId:'m1',protocoleNom:'Test',protocoleLieAuVelage:false,medicamentIds:['m1'],etapes:[{id:'e1',reference:'NAISSANCE',medicamentIds:['m1']}],sousColonnes:[{id:'e1',label:'Primo',cycle:'INITIAL',protocoleId:'p1',medicamentId:'m1',medicamentNom:'Vaccin test',voie:'SC',dose:1,uniteDosage:'ml'}]}],lignes:[{...base,animalId:'a1',nom:'BIGBOSS',mereNutrav:null,mereNom:null,mereLiee:false,sexe:'M',danaisIso:'2026-09-22T12:00:00Z',gestationId:null,dateVelagePrevueIso:null,cellules:{e1:cell},actes:[]}]};
  await t.test("tableau vaccinal : même colonne N°, mêmes cellules et sélections après PATCH", async () => {
    const {page,requests,crashes}=await setup('table',tableProps);
    const row=page.locator('tbody tr').first(); await row.waitFor();
    const number=row.locator('th[scope="row"]').first();
    assert.equal(await number.getByRole('link',{name:'7514'}).getAttribute('href'),'/troupeau/7514');
    const animalSelect=page.getByRole('checkbox',{name:'Sélectionner l’animal 7514',exact:true}); await animalSelect.check();
    const vaccine=row.locator('td').last().getByRole('button').first(); await vaccine.click();
    const beforeCell=await row.locator('td').last().innerText();
    await number.getByRole('button',{name:/À boucler/}).tap(); await number.getByLabel('Bouclé',{exact:true}).waitFor();
    assert.equal(await animalSelect.isChecked(),true); assert.equal(await vaccine.getAttribute('aria-pressed'),'true');
    assert.equal(await row.locator('td').last().innerText(),beforeCell); assert.equal(requests.length,1); assert.deepEqual(crashes,[]);
  });
  await t.test("mobile : aucune colonne ajoutée ni débordement de page, colonnes fixes conservées", async () => {
    const {page}=await setup('baseline',tableProps); await page.locator('tbody tr').first().waitFor();
    const columns=await page.locator('thead th').count();
    await page.evaluate((p)=>window.renderView('table',p),tableProps); await page.getByRole('button',{name:/À boucler/}).waitFor();
    assert.equal(await page.locator('thead th').count(),columns);
    for(const width of [320,375,768]){
      await page.setViewportSize({width,height:800});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const number=page.locator('tbody th[scope="row"]').first();
      const link=await number.getByRole('link',{name:'7514'}).boundingBox(); const marker=await number.getByRole('button',{name:/À boucler/}).boundingBox();
      assert.ok(marker.x>=link.x+link.width); assert.ok(marker.height>=44 && marker.width>=24);
      const scroll=page.locator('.vaccin-table-scroll'); await scroll.evaluate((el)=>{el.scrollLeft=150});
      assert.ok(Math.abs((await number.boundingBox()).x-link.x)<=5);
      await scroll.evaluate((el)=>{el.scrollLeft=0});
    }
    await page.emulateMedia({media:'print'}); assert.equal(await page.getByRole('button',{name:/À boucler/}).isVisible(),false);
  });
  await t.test("pesées/séances : lookup partagé, succès synchronisé et aucun stockage local", async () => {
    const {page,requests}=await setup('lookup',{});
    const buttons=page.getByRole('button',{name:/À boucler/}); await buttons.first().waitFor(); assert.equal(await buttons.count(),2);
    await buttons.first().tap(); await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Bouclé"]').length===2);
    assert.equal(requests.length,1); assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  });
  await t.test("lookup indisponible : aucun statut inventé ni écriture différée", async () => {
    const {page,requests}=await setup('lookup',{}, {lookupUnavailable:true});
    await page.waitForTimeout(150);
    assert.equal(await page.getByRole('button',{name:/À boucler/}).count(),0);
    assert.equal(await page.getByLabel('Bouclé',{exact:true}).count(),0);
    assert.equal(requests.length,0);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  });
});
