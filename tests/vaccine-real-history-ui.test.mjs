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



test('BUBULEUR : dates réelles visibles dans le tableau et la fiche historique', {timeout:180000},async(t)=>{
  const scratch = mkdtempSync(path.join(tmpdir(), "cesam-real-vaccines-ui-"));
  t.after(() => {
    assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
    assert.ok(path.basename(scratch).startsWith("cesam-real-vaccines-ui-"));
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


const a=(id,date,etape)=>({sourceType:'VACCINATION',sourceId:id,date,vaccin:'BOVILIS BOVIGRIP',medicamentId:'m1',protocoleId:etape?'p1':null,etapeProtocoleId:etape,gestationId:null,voie:'SC',dose:id==='v1'?5:null,uniteDosage:'ml'});
const first=a('v1','2026-09-18T12:00:00Z',null),second=a('v2','2026-10-17T12:00:00Z','rappel');
const cell=(act,etape)=>({statut:'FAIT',date:act.date,aValider:false,rattachementProtocoleAutorise:true,historiquesAValider:[],actes:[{...act,protocoleId:'p1',etapeProtocoleId:etape}],prochaine:null});
const props={actionsPrevues:[],blocs:[{cle:'m1',nom:'BOVILIS BOVIGRIP',voie:'SC',protocoleId:'p1',medicamentId:'m1',protocoleNom:'Bovigrip',protocoleLieAuVelage:false,medicamentIds:['m1'],etapes:['primo','rappel'].map(id=>({id,reference:'NAISSANCE',medicamentIds:['m1']})),sousColonnes:['primo','rappel'].map(id=>({id,label:id==='primo'?'Primo':'Rappel',cycle:'INITIAL',protocoleId:'p1',medicamentId:'m1',medicamentNom:'BOVILIS BOVIGRIP',voie:'SC',dose:5,uniteDosage:'ml'}))}],lignes:[{animalId:'a1',nutrav:'7509',nom:'BUBULEUR',mereNutrav:null,mereNom:null,mereLiee:false,sexe:'M',danaisIso:'2026-09-01',gestationId:null,dateVelagePrevueIso:null,cellules:{primo:cell(first,'primo'),rappel:cell(second,'rappel')},actes:[first,second]}]};
const page=await browser.newPage({viewport:{width:375,height:800}});t.after(()=>page.close());let writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{if(route.request().method()!=='GET')writes++;return route.fulfill({json:[]});});
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.renderView);await page.evaluate(p=>window.renderView(p),props);
await page.getByRole('button',{name:/Ouvrir l’historique Primo : 18/}).waitFor();await page.getByRole('button',{name:/Ouvrir l’historique Rappel : 17/}).waitFor();
await page.getByRole('button',{name:/Ouvrir l’historique Primo/}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByText(/acte\(s\) à rattacher/).count(),0);
await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).click();
const ambiguous=structuredClone(props);const unknown={...first,sourceId:'ancien',medicamentId:null,vaccin:'ANCIEN LIBELLE DU PROTOCOLE'};
ambiguous.lignes[0].actes=[unknown];
ambiguous.lignes[0].cellules.primo={statut:'VIDE',date:null,aValider:true,rattachementProtocoleAutorise:false,historiquesAValider:[{...unknown,protocoleId:'p1',protocoleNom:'Bovigrip',raison:'À rattacher',protocoleLieAuVelage:false,etapesCompatibles:[{id:'primo',label:'Primo'}]}],actes:[],prochaine:null};
ambiguous.lignes[0].cellules.rappel={...ambiguous.lignes[0].cellules.primo,aValider:false,historiquesAValider:[]};
await page.evaluate(p=>window.renderView(p),ambiguous);await page.getByTitle('Historique à rattacher').click();
await page.getByRole('dialog').getByText('ANCIEN LIBELLE DU PROTOCOLE',{exact:true}).waitFor();
await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);assert.equal(writes,0);
});
