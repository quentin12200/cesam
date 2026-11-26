import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../"+p, import.meta.url),"utf8");
test("fiche: action de bouclage réservée aux actifs de moins d'un an",()=>{
 const s=read("app/troupeau/[nutrav]/page.tsx");
 assert.match(s,/!animal\.boucleFaite && differenceInYears\(new Date\(\), animal\.danais\) < 1 && animal\.statut === "ACTIF" && <BouclageButton/);
});
test("date historique préservée lors d'une validation répétée",()=>{
 assert.match(read("app/api/animaux/[nutrav]/route.ts"),/animal\.boucleFaite \? animal\.dateBouclage : new Date\(\)/);
});
test("âge au sevrage adulte uniquement si date connue",()=>{
 assert.match(read("app/troupeau/[nutrav]/page.tsx"),/animal\.dateSevrage && differenceInYears\(new Date\(\), animal\.danais\) >= 1/);
});
