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


test('le brouillon ne modifie pas la planification ni l’enregistrement vaccinal',()=>{
 for(const file of ['lib/vaccine-planner.ts','lib/vaccine-selection.ts','lib/vaccination-session.ts','app/api/evenements/batch/route.ts'])assert.equal(read(file),before(file));
});
test('brouillon vaccinal : navigateur réel sans base', {timeout:180000},async(t)=>{
  const scratch = mkdtempSync(path.join(tmpdir(), "cesam-vaccin-draft-ui-"));
  t.after(() => {
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith("cesam-vaccin-draft-ui-"));
    rmSync(scratch, { recursive: true, force: true });
  });
  writeFileSync(path.join(scratch, "baseline.tsx"), before(tablePath));
  writeFileSync(path.join(scratch, "navigation.js"), `export const useRouter=()=>({refresh:()=>{window.refreshes=(window.refreshes||0)+1},push:(url)=>{window.pushed=url}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/fixture';`);
  writeFileSync(path.join(scratch, "link.js"), `import React from 'react';export default function Link({children,href,prefetch,...props}){return React.createElement('a',{href,...props},children)}`);
  writeFileSync(path.join(scratch, "entry.tsx"), `
import React from 'react';import {createRoot} from 'react-dom/client';
import Table from '@/app/sanitaire/vaccins/TableauVaccinal';
const root=createRoot(document.getElementById('root'));
window.renderView=(props)=>root.render(props?<Table {...props}/>:null);
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

const cell={statut:'A_FAIRE',date:'2026-10-20',aValider:false,rattachementProtocoleAutorise:true,historiquesAValider:[],actes:[],prochaine:null,fenetre:{debut:'2026-10-01',fin:'2026-10-20'}};
const props={actionsPrevues:[],blocs:[{cle:'m1',nom:'Vaccin test',voie:'SC',protocoleId:'p1',medicamentId:'m1',protocoleNom:'Test',protocoleLieAuVelage:false,medicamentIds:['m1'],etapes:[{id:'e1',reference:'NAISSANCE',medicamentIds:['m1']}],sousColonnes:[{id:'e1',label:'Primo',cycle:'INITIAL',protocoleId:'p1',medicamentId:'m1',medicamentNom:'Vaccin test',voie:'SC',dose:1,uniteDosage:'ml'}]}],lignes:['a1','a2'].map((id,i)=>({animalId:id,nutrav:String(7514+i),nom:'Veau '+i,mereNutrav:null,mereNom:null,mereLiee:false,sexe:'M',danaisIso:'2026-09-22',gestationId:null,dateVelagePrevueIso:null,cellules:{e1:cell},actes:[]}))};
const page=await browser.newPage({viewport:{width:1280,height:900}});t.after(()=>page.close());
let fail=true;const posts=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{if(route.request().method()==='POST'){posts.push(route.request().postDataJSON());return route.fulfill({status:fail?500:200,json:fail?{error:'Échec simulé'}:{}});}return route.fulfill({json:[{id:'i1',nom:'Testeur'}]});});
const url='http://127.0.0.1:'+server.address().port;
async function render(p=props){await page.evaluate(p=>window.renderView(p),p);await page.getByRole('button',{name:'Tableau',exact:true}).waitFor();}
await page.goto(url);await page.waitForFunction(()=>window.renderView);await render();
const draft=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:draft:v1')));
const check=(n)=>page.getByRole('checkbox',{name:'Sélectionner l’animal '+n,exact:true});
await check(7514).check();await check(7515).check();
for(const n of [7514,7515])await page.locator('tbody tr').filter({has:page.getByRole('link',{name:String(n),exact:true})}).locator('td').last().getByRole('button').first().click();
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cesam:vaccins:draft:v1'))?.actesSelectionnes.length===2);
await page.locator('input[type=date]').first().fill('2026-10-15');await page.locator('select').filter({has:page.locator('option[value="Testeur"]')}).selectOption('Testeur');
await page.evaluate(()=>window.renderView(null));await page.waitForFunction(()=>!document.querySelector('section'));await render();assert.equal(await check(7514).isChecked(),true);assert.equal((await draft()).actesSelectionnes.length,2);assert.equal(posts.length,0);
await check(7515).uncheck();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cesam:vaccins:draft:v1')).animauxSelectionnes.length===1);
await page.reload();await page.waitForFunction(()=>window.renderView);await render();assert.equal(await check(7514).isChecked(),true);assert.equal(await check(7515).isChecked(),false);assert.equal((await draft()).executant,'Testeur');assert.equal((await draft()).dateSession,'2026-10-15');
await page.getByRole('button',{name:/Enregistrer/}).first().click();await page.getByText('Échec simulé',{exact:true}).waitFor();assert.equal((await draft()).actesSelectionnes.length,2);
const adjusted=await draft();const groupKey=Object.keys(adjusted.ajustements)[0];adjusted.ajustements[groupKey]={voie:'IM',dose:'2',uniteDosage:'ml'};
await page.evaluate(d=>localStorage.setItem('cesam:vaccins:draft:v1',JSON.stringify(d)),adjusted);
await page.reload();await page.waitForFunction(()=>window.renderView);await render();assert.equal((await draft()).ajustements[groupKey].dose,'2');
fail=false;await page.getByRole('button',{name:/Enregistrer/}).first().click();await page.waitForFunction(()=>localStorage.getItem('cesam:vaccins:draft:v1')===null);assert.equal(await check(7514).isChecked(),false);assert.equal(posts.at(-1).traitements[0].dose,2);assert.equal(posts.at(-1).traitements[0].voie,'IM');assert.ok(await page.evaluate(()=>localStorage.getItem('cesam:vaccins:view:v2')));
await page.evaluate(()=>{localStorage.removeItem('cesam:vaccins:view:v2');localStorage.setItem('cesam:vaccins:draft:v1',JSON.stringify({version:1,animauxSelectionnes:['a1','deleted'],actesSelectionnes:['a1|e1','a2|deleted'],executant:'Testeur',dateSession:'2026-10-15',ajustements:{}}));localStorage.setItem('cesam:vaccins:view:v1',JSON.stringify({version:1,vue:'AGENDA',recherche:'Veau',vaccinsAffiches:['m1'],statuts:['aFaire'],tri:'age',directionTri:'desc',colonnesMasquees:['mere'],anneesAffichees:[2025],toutHistorique:true,uniquementSelection:false}));});
const postCount=posts.length;await page.reload();await page.waitForFunction(()=>window.renderView);await render();await page.getByRole('status').filter({hasText:/2 sélections/}).waitFor();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cesam:vaccins:draft:v1')).actesSelectionnes.length===1);
assert.equal(posts.length,postCount);assert.deepEqual((await draft()).actesSelectionnes,['a1|e1']);assert.equal(await page.getByRole('button',{name:'Agenda',exact:true}).getAttribute('aria-pressed'),'true');
const view=await page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')));assert.equal(view.version,2);assert.equal(view.vaccinModes.m1,'OUVERT');assert.equal(view.tri,'age');assert.equal(view.directionTri,'desc');assert.deepEqual(view.colonnesMasquees,['mere']);assert.deepEqual(view.anneesAffichees,[2025]);assert.equal(view.toutHistorique,true);
await page.getByRole('button',{name:'Tableau',exact:true}).click();await page.setViewportSize({width:375,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
await page.getByRole('button',{name:'Colonnes',exact:true}).click();const colonnes=page.getByRole('dialog',{name:'Colonnes'});
await colonnes.getByRole('button',{name:'N° seulement'}).click();await colonnes.getByRole('button',{name:'Fermer'}).click();
assert.equal(await page.getByRole('button',{name:'Trier par N°'}).count(),1);for(const name of ['Nom','Mère'])assert.equal(await page.getByRole('columnheader',{name,exact:true}).count(),0);for(const name of ['Âge','Sexe','Avant vêlage'])assert.equal(await page.getByRole('button',{name:'Trier par '+name}).count(),0);assert.equal(await check(7514).count(),1);
await page.getByRole('button',{name:'Colonnes',exact:true}).click();await colonnes.getByRole('button',{name:'Tout afficher'}).click();await colonnes.getByRole('button',{name:'Fermer'}).click();
await page.getByRole('button',{name:'Réduire Vaccin test'}).click();await page.getByRole('button',{name:'Ouvrir Vaccin test'}).first().waitFor();
await page.reload();await page.waitForFunction(()=>window.renderView);await render();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')))).vaccinModes.m1,'COMPACT');assert.equal(await page.locator('tbody tr').count(),2);
assert.equal(await page.locator('tbody th').first().evaluate(el=>getComputedStyle(el).position),'sticky');assert.ok((await page.locator('tbody tr').first().locator('td').last().boundingBox()).width>=44);
await page.getByRole('button',{name:'Ouvrir Vaccin test'}).first().click();await page.getByRole('button',{name:'Masquer Vaccin test'}).first().click();
assert.equal(await page.getByRole('button',{name:'Trier par N°'}).count(),1);assert.equal(await page.locator('tbody tr').count(),0);assert.deepEqual((await draft()).actesSelectionnes,['a1|e1']);await page.getByRole('button',{name:/Vaccins · 1 masqué/}).click();
await page.getByRole('dialog',{name:'Vaccins affichés'}).getByRole('button',{name:'Afficher Vaccin test'}).click();await page.getByRole('dialog',{name:'Vaccins affichés'}).getByRole('button',{name:'Fermer'}).click();
assert.equal(await page.locator('tbody tr').count(),2);
await page.getByRole('columnheader',{name:/Primo/}).getByRole('button').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')).tri==='vaccin:e1');
await page.reload();await page.waitForFunction(()=>window.renderView);await render();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')))).tri,'vaccin:e1');
await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('cesam:vaccins:view:v2'));v.tri='vaccin:retiree';localStorage.setItem('cesam:vaccins:view:v2',JSON.stringify(v));});
await page.reload();await page.waitForFunction(()=>window.renderView);await render();const triRetire=await page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')));assert.equal(triRetire.tri,null);assert.equal(triRetire.directionTri,null);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.getByRole('button',{name:/Saisie ·/}).click();await page.getByRole('button',{name:'Vider la sélection',exact:true}).click();await check(7514).uncheck();await page.waitForFunction(()=>localStorage.getItem('cesam:vaccins:draft:v1')===null);
await page.evaluate(()=>{localStorage.removeItem('cesam:vaccins:view:v2');const old=JSON.parse(localStorage.getItem('cesam:vaccins:view:v1'));old.vue='TABLEAU';old.vaccinsAffiches=[];localStorage.setItem('cesam:vaccins:view:v1',JSON.stringify(old));});
await page.reload();await page.waitForFunction(()=>window.renderView);await render();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cesam:vaccins:view:v2')))).vaccinModes.m1,'MASQUE');assert.equal(await page.getByRole('button',{name:'Trier par N°'}).count(),1);
});
