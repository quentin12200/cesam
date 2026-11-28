import {test} from "node:test";
import assert from "node:assert/strict";
import {repereDernierVelage} from "./dernier-velage.ts";
test("jours calendaires, date de l'acte et absence de vêlage",()=>{
 assert.match(repereDernierVelage("2026-10-24","2026-10-26"),/2 j depuis vêlage/);
 assert.match(repereDernierVelage("2026-10-24","2026-10-24"),/0 j depuis vêlage/);
 assert.match(repereDernierVelage("2026-10-24","2026-10-23"),/postérieur/);
 assert.match(repereDernierVelage(null,"2026-10-24",true),/Génisse/);
 assert.match(repereDernierVelage(undefined,"2026-10-24"),/non renseigné/);
 assert.match(repereDernierVelage("2026-02-31","2026-03-01"),/vérifier/);
});
