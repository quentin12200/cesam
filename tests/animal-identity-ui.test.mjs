// Real Identity JSX and calculations from page.tsx, rendered with fictional data.
// Navigation/actions are inert fixtures: no CESAM server or database is used.
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
const file = "app/troupeau/[nutrav]/page.tsx";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const baseline = execFileSync("git", ["show", `ea951fe453ba34a81ebfd9c01a3a0f4805c377dc:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");
const between = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
const weights = (text) => between(text, "  // Pesées chronologiques", "  // IVV");

test("GMQ, résolution des numéros et autres onglets restent inchangés", () => {
  assert.equal(weights(source), weights(baseline));
  assert.equal(between(source, "  const birthVelage", "  const fatherRecord"), between(baseline, "  const birthVelage", "  const lastCalving"));
  assert.equal(source.slice(source.indexOf("        {/* ─── ONGLET SANTÉ")), baseline.slice(baseline.indexOf("        {/* ─── ONGLET SANTÉ")));
  assert.equal(between(source, "  const lastCalving", "        {/* ─── ONGLET IDENTITÉ"), between(baseline, "  const lastCalving", "        {/* ─── ONGLET IDENTITÉ"));
});

test("Identité mobile : parenté, pesées et descendance", { timeout: 180_000 }, async (t) => {
  const scratch = mkdtempSync(path.join(tmpdir(), "cesam-identity-ui-"));
  t.after(() => {
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith("cesam-identity-ui-"));
    rmSync(scratch, { recursive: true, force: true });
  });
  const block = between(source, '        {onglet === "identite" && (', "        {/* ─── ONGLET SANTÉ");
  const jsx = block.slice(block.indexOf("<>"), block.lastIndexOf("        )}")).trim();
  const parentSetup = between(source, "  const birthVelage", "  const lastCalving");
  writeFileSync(path.join(scratch, "entry.tsx"), `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {Scale} from 'lucide-react';
    import {differenceInDays} from 'date-fns';
    import {formatDate,formatAge} from '@/lib/utils';
    import {resolveBiologicalMother,resolveParentWorkNumber} from '@/lib/animal-genealogy';
    const Link=({href,children,...props})=><a href={href} {...props}>{children}</a>;
    const CategorieButton=()=> <button>Changer catégorie</button>;
    const GroupeButton=()=> <button>Groupe / Lot</button>;
    const SevrageButton=({sevreFait})=> <button>{sevreFait?'Sevré':'Marquer sevré'}</button>;
    const PeseeInlineForm=({initialOpen,initialPoids})=> <button data-initial-open={String(initialOpen)} data-initial-poids={initialPoids}>Ajouter une pesée</button>;
    const root=createRoot(document.getElementById('root'));
    const normalizeGenealogyNational=(value)=>value?.replace(/\\s+/g,'').replace(/^FR/i,'').toUpperCase() ?? '';
    async function view(animal,{matches=[],pesee,poids}={}){
      const findAnimalsByExactNational=async()=>new Map(matches);
      ${parentSetup}
      ${weights(source)}
      const groupes=[];
      return <div className="space-y-3">${jsx}</div>;
    }
    function revive(value){
      if(Array.isArray(value))return value.map(revive);
      if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v && ['date','danais','dateSevrage','dateTarie'].includes(k)?new Date(v):revive(v)]));
      return value;
    }
    window.renderIdentity=async(animal,options)=>root.render(await view(revive(animal),options));
  `);
  writeFileSync(path.join(scratch, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack = require("next/dist/compiled/webpack/webpack");
  webpack.init();
  const compiler = webpack.webpack({
    mode: "development", devtool: false, entry: path.join(scratch, "entry.tsx"),
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
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  t.after(() => browser.close());
  const animal = {
    id: 'a1', nutrav: '5717', danais: '2024-02-03T12:00:00Z', sexbov: 'F', estGenisse: true,
    categorie: null, statut: 'ACTIF', groupe: {nom:'Lot 3'}, groupeId: 'g1', boucleFaite: true,
    sevreFait: true, dateSevrage: null, tarieFaite: false, dateTarie: null, notes: null,
    mere: {id:'m1',nutrav:'3890',nobovi:'OASIS'}, numeip:'FR1234563890',nomeip:'Ancienne mère',
    mereTravailManuel:null,mereNomManuel:null,pereTravailManuel:null,pereNomManuel:null,
    taureau:{nupere:'FR1234565482',nopere:'TAUREAU FIABLE'}, velageVeau: {
      id:'v1',date:'2024-02-03T12:00:00Z',qualificatif:'NORMAL',pereNom:'Ancien père',pereNunati:'FR1234561111',
      vache:{id:'m2',nutrav:'9999',nobovi:'Mère au vêlage'},gestation:null,
    },veauxVelage:[],veaux:[{id:'c1',nutrav:'9262',nobovi:'VEAU',danais:'2026-02-03T12:00:00Z',sexbov:'M',statut:'ACTIF'}],
    pesees:[{id:'p1',date:'2024-02-03T12:00:00Z',poids:40},{id:'p2',date:'2025-02-03T12:00:00Z',poids:300},{id:'p3',date:'2026-10-03T12:00:00Z',poids:412}],
  };
  async function setup(values = animal, width = 375, options = {}) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    t.after(() => page.close());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.renderIdentity);
    await page.evaluate(([a,o]) => window.renderIdentity(a,o), [values, options]);
    await page.getByRole('heading', {name:'Parenté'}).waitFor();
    return page;
  }
  await t.test("une seule naissance, une seule mère fiable et accès au vêlage", async () => {
    const page = await setup();
    assert.equal(await page.locator('dl').getByText('03/02/2024',{exact:true}).count(),1);
    const birthDates = await page.getByText('03/02/2024',{exact:true}).all();
    assert.equal((await Promise.all(birthDates.map((date)=>date.isVisible()))).filter(Boolean).length,1);
    assert.equal(await page.getByRole('heading',{name:'Naissance',exact:true}).count(),0);
    assert.equal(await page.getByText('Mère',{exact:true}).count(),1);
    assert.equal(await page.getByText('Catégorie',{exact:true}).count(),0);
    const mother=page.getByRole('link',{name:/3890.*OASIS/});
    assert.equal(await mother.getAttribute('href'),'/troupeau/3890');
    assert.equal(await page.getByText('Ancienne mère',{exact:true}).count(),0);
    assert.ok((await page.locator('main').innerText()).includes('5482 · TAUREAU FIABLE'));
    assert.match(await page.getByRole('link',{name:'Voir le vêlage'}).getAttribute('href'),/modifier=v1&returnTo=%2Ftroupeau%2F5717/);
    await mother.click(); await page.waitForURL('**/troupeau/3890');
  });
  await t.test("historique de parenté conservé sans inventer de fiche", async () => {
    const page=await setup({...animal,mere:null,velageVeau:null,taureau:null,veaux:[],nomeip:'MÈRE HISTORIQUE',pereTravailManuel:'5482',pereNomManuel:'PÈRE HISTORIQUE'});
    const text=await page.locator('main').innerText();
    assert.ok(text.includes('3890 · MÈRE HISTORIQUE'));
    assert.ok(text.includes('5482 · PÈRE HISTORIQUE'));
    assert.equal(await page.getByRole('link').count(),0);
    assert.equal(await page.getByText(/Descendance/).count(),0);
  });
  await t.test("dernière pesée, ajout, historique complet récent d’abord et GMQ conservé", async () => {
    const page=await setup(animal,375,{pesee:'1',poids:'412,5'});
    assert.match(await page.locator('main').innerText(),/Dernière : 412 kg · 03\/10\/2026/);
    const add=page.getByRole('button',{name:'Ajouter une pesée'});
    assert.equal(await add.getAttribute('data-initial-open'),'true');
    assert.equal(await add.getAttribute('data-initial-poids'),'412.5');
    const history=page.locator('details').filter({has:page.locator('summary',{hasText:'Voir l’historique'})});
    assert.equal(await history.getAttribute('open'),null);
    await history.locator('summary').click();
    const text=await history.innerText();
    for(const weight of [40,300,412]) assert.equal((text.match(new RegExp(`\\b${weight} kg`,'g'))||[]).length,1);
    assert.ok(text.indexOf('412 kg')<text.indexOf('300 kg') && text.indexOf('300 kg')<text.indexOf('40 kg'));
    assert.match(text,/GMQ global/);
    const ancestry=page.getByRole('heading',{name:'Parenté'});
    assert.ok((await add.boundingBox()).y<(await ancestry.boundingBox()).y);
  });
  await t.test("descendance repliée, noms longs et mobile sans débordement", async () => {
    const long='NOMTRESLONG'.repeat(12);
    const page=await setup({...animal,notes:long,groupe:{nom:long},mere:{...animal.mere,nobovi:long},veaux:[{...animal.veaux[0],nobovi:long}]},320);
    const descendants=page.locator('details').filter({has:page.locator('summary',{hasText:'Descendance'})});
    assert.equal(await descendants.getAttribute('open'),null);
    await descendants.locator('summary').click();
    assert.equal(await descendants.getByRole('link').getAttribute('href'),'/troupeau/9262');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const summary of await page.locator('summary').all()) assert.ok((await summary.boundingBox()).height>=44);
    await page.setViewportSize({width:1280,height:800});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  });
  await t.test("aucune pesée ou une seule pesée : aucun bloc vide ni perte", async () => {
    for(const entries of [[],[animal.pesees[0]]]){
      const page=await setup({...animal,pesees:entries,veaux:[],velageVeau:null});
      if(!entries.length){assert.equal(await page.getByText('Aucune pesée enregistrée').isVisible(),true);assert.equal(await page.locator('details').count(),0);}
      else {await page.getByText(/Voir l’historique des pesées/).click();assert.match(await page.locator('details').innerText(),/40 kg/);}
    }
  });
});
