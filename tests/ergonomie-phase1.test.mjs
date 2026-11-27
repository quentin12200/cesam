import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path,"utf8");
test("pharmacie: commandes indépendantes, état accessible et ordonnance visible",()=>{
 const s=read("app/pharmacie/PharmacieClient.tsx");
 const row=s.slice(s.indexOf("function MedicamentRow"),s.indexOf("type Mode ="));
 const favorite=row.indexOf("onClick={toggleFavori}");
 const toggle=row.indexOf("onClick={onToggle}");
 assert.ok(favorite>=0 && toggle>favorite);
 assert.ok(row.slice(favorite,toggle).includes("</button>"));
 assert.match(row,/aria-pressed=\{med.favori\}/);
 assert.match(row,/aria-expanded=\{expanded\}/);
 const warning=row.split("\n").find(l=>l.includes("Ordonnance requise"));
 assert.ok(warning && !warning.includes("hidden"));
 assert.match(row,/adjustStock\(-1\)/);assert.match(row,/adjustStock\(1\)/);
});
test("identification et troupeau: cibles tactiles élargies",()=>{
 const s=read("app/troupeau/identification/IdentificationClient.tsx");
 assert.match(s,/Modifier le sexe[^\n]*min-h-11 min-w-11/);
 assert.match(s,/updateBouclage\(veau, true\)/);assert.match(s,/updateBouclage\(veau, false\)/);
 assert.doesNotMatch(read("app/troupeau/TroupeauMobileList.tsx"),/min-h-(9|10)\b/);
 assert.match(read("app/troupeau/TroupeauTableau.tsx"),/min-h-8 min-w-8/);
});
test("accès mobile et généalogie visibles",()=>{
 const s=read("app/page.tsx").split("\n").find(l=>l.includes("Démarrer une pesée"));
 assert.ok(s && !s.includes("hidden"));
 const g=read("app/troupeau/genealogie/GeneaClient.tsx");
 assert.doesNotMatch(g,/hidden sm:inline[^\n]*node.pereNom/);
 assert.doesNotMatch(g,/hidden sm:inline[^\n]*sorti/);
 assert.match(read("app/velage/VelageFormWrapper.tsx"),/aria-label="Fermer le formulaire de vêlage"/);
});

test("mobile: long labels and weighing actions can wrap",()=>{
 const home=read("app/page.tsx");
 const block=home.slice(home.indexOf("{data.neverWeighedCount > 0 && ("),home.indexOf("{weaningThresholdNews.map",home.indexOf("{data.neverWeighedCount > 0 && (")));
 assert.match(block,/flex-wrap/); assert.match(block,/w-full flex-wrap items-center gap-1 sm:w-auto/);
 const med=read("app/pharmacie/PharmacieClient.tsx"); assert.match(med,/max-w-full break-words[^\n]*cat.bg/);
 const genea=read("app/troupeau/genealogie/GeneaClient.tsx"); assert.match(genea,/max-w-full break-words[^\n]*node.pereNom/);
});
