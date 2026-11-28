import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("les onglets conservent uniquement un retour validé",()=>{
 const s=read("app/troupeau/[nutrav]/page.tsx");
 assert.match(s,/animalTabHref\(animal!\.nutrav, id, testReproEnabled, returnTo \?\? null\)/);
 assert.match(s,/aria-current=\{onglet === tab.id/);
});
test("actions rapides accessibles au toucher et au clavier",()=>{
 const s=read("app/troupeau/[nutrav]/QuickActionsBar.tsx");
 assert.match(s,/addEventListener\("pointerdown"/);
 assert.match(s,/event.key === "Escape"/);
});
