import {test} from "node:test";
import assert from "node:assert/strict";
import {isLabRoute} from "./lab-route.ts";
test("only prototype paths use isolated shell",()=>{for(const path of ["/lab","/lab/test","/prototype-espace-travail","/prototype-accueil-v3"])assert.equal(isLabRoute(path),true,path);for(const path of ["/","/lab-other","/config/coulisses/peres","/troupeau","/api/lab",null])assert.equal(isLabRoute(path),false,String(path));});
