import test from "node:test";
import assert from "node:assert/strict";
import { conflictingFatherIdentity } from "./gmq-father-conflict.ts";
test("different national identifiers conflict even with identical names",()=>assert.equal(conflictingFatherIdentity([{national:"FR123",name:"Zeus"},{national:"FR456",name:"Zeus"}]),true));
test("same identifier tolerates name variants",()=>assert.equal(conflictingFatherIdentity([{national:"FR123",name:"Zeus"},{national:"fr 123",name:"Z"}]),false));
test("missing sources do not create a conflict",()=>assert.equal(conflictingFatherIdentity([{}, {name:"Zeus"}]),false));
test("different names without identifiers require verification",()=>assert.equal(conflictingFatherIdentity([{name:"Zeus"},{name:"Pep"}]),true));
