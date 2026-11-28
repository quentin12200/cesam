import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("formulaire sanitaire : une seule sélection, sans mode ni titre redondant",()=>{
 const s=readFileSync("app/sanitaire/nouvel-evenement/NouvelEvenementForm.tsx","utf8");
 assert.doesNotMatch(s,/targetMode|setTargetMode|>Date et moment<|Plusieurs animaux|Un animal<|AnimalMultiEntry/);
 assert.match(s,/<AnimalPicker selected=\{selectedAnimaux\} onChange=\{setSelectedAnimaux\} multiple=\{true\}/);
 assert.match(s,/animalIds: animaux\.map/);
 assert.match(s,/presetVaccination/);
 assert.match(s,/Choisir dans le troupeau/);
});
