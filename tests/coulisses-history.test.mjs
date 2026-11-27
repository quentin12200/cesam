import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("history uses existing log without reading reversal payloads or executing mutations",()=>{
 const s=read("app/config/coulisses/historique/page.tsx");
 assert.match(s,/prisma\.actionLog\.findMany/);
 assert.match(s,/prisma\.actionLog\.count/);
 assert.match(s,/take:PAGE_SIZE/);
 assert.match(s,/skip:\(page-1\)\*PAGE_SIZE/);
 assert.doesNotMatch(s,/revertData|\/api\/undo|\.(?:create|update|delete|upsert|executeRaw)\s*\(|fetch\(|<form|useServer/);
 assert.match(s,/Certaines modifications ne sont pas enregistrées/);
 assert.match(read("app/config/coulisses/page.tsx"),/href="\/config\/coulisses\/historique"/);
 assert.doesNotMatch(read("middleware.ts"),/"\/config(?:\/coulisses)?"/);
});
