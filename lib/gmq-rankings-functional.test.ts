import test from "node:test";
import assert from "node:assert/strict";
import { mapGmqCalves } from "./gmq-calves.ts";
import { summarizeGmq, makeGroups, average } from "./gmq-rankings.ts";
const bull = { id:"sire", nopere:"Test", nupere:"FR0000000001" };
const animal = (id:string, sexbov:string, gain:number, measured=true) => ({
 id, nutrav:id, nobovi:null, danais:new Date("2026-01-01"), sexbov,
 pereNomManuel:null, pereNationalManuel:null as string|null, pereTravailManuel:null,
 taureau:bull, pesees:[{date:new Date("2026-01-01"),poids:40}, ...(measured?[{date:new Date("2026-02-10"),poids:40+gain}]:[])]
});
const birth = (a:ReturnType<typeof animal>, b:ReturnType<typeof animal>) => ({
 vacheId:"dam", vache:{nutrav:"dam",nobovi:null}, pereNom:"Test", pereNunati:bull.nupere,
 gestation:null, veau:a, veauxDetails:[{animal:a},{animal:b}]
});
test("twins count once each with separate growth and sex averages",()=>{
 const calves=mapGmqCalves([birth(animal("a","M",40),animal("b","F",60))]);
 assert.equal(calves.length,2);
 const r=summarizeGmq(calves,"all","2026","all");
 assert.equal(r.selected,2); assert.equal(r.measured.length,2);
 assert.equal(average(r.male.map(x=>x.gmq)),1000);
 assert.equal(average(r.female.map(x=>x.gmq)),1500);
 for(const group of ["meres","peres","couples"] as const){
 const rows=makeGroups(r.measured,group,r.born);
 assert.equal(rows.length,1); assert.equal(rows[0].total,2); assert.equal(rows[0].born,2);
 assert.equal(average(rows[0].gmqs),1250);
 }
});
test("one unmeasured twin stays in denominator, not average",()=>{
 const r=summarizeGmq(mapGmqCalves([birth(animal("a","M",40),animal("b","F",60,false))]),"all","2026","all");
 for(const group of ["meres","peres","couples"] as const){
 const [row]=makeGroups(r.measured,group,r.born);
 assert.equal(row.total,1); assert.equal(row.born,2); assert.equal(average(row.gmqs),1000);
 }
});
test("contradictory sire is not attributed to known bull, but remains in dam ranking",()=>{
 const b=animal("b","F",60); b.pereNationalManuel="FR0000000002";
 const calves=mapGmqCalves([birth(animal("a","M",40),b)]);
 assert.equal(calves[1].pereId,null); assert.equal(calves[1].pereNational,null);
 assert.match(calves[1].fatherMissing.join(" "),/contradictoires/);
 const r=summarizeGmq(calves,"all","2026","all");
 assert.equal(makeGroups(r.measured,"meres",r.born)[0].total,2);
 const rows=makeGroups(r.measured,"peres",r.born);
 assert.equal(rows.find(x=>x.key==="unknown")?.total,1);
 assert.equal(rows.find(x=>x.key==="nat:FR0000000001")?.total,1);
});
test("detail-only twins and repeated records are deduplicated",()=>{
 const v=birth(animal("a","M",40),animal("b","F",60));
 assert.equal(mapGmqCalves([{...v,veau:null},v]).length,2);
});
