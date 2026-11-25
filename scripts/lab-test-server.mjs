import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// Fail closed: Next automatically loads .env files, so never start in a checkout containing one.
if (readdirSync(process.cwd()).some(n=>/^\.env(?:$|\.)/.test(n)&&![".env.example",".env.template"].includes(n))) throw new Error("Use a clean checkout without .env files");
if (!existsSync(resolve("node_modules/next/dist/bin/next"))) throw new Error("Run npm ci first");
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",NEXT_DISABLE_DEV_INDICATOR:"1",CESAM_SESSION_SECRET:"local-fixture-only-not-a-production-secret",DATABASE_URL:"file:/tmp/cesam-lab-unused.db",CESAM_LAB_TEST_ONLY:"1",NODE_OPTIONS:"--require="+resolve("scripts/lab-test-guard.cjs"),NEXT_FONT_GOOGLE_MOCKED_RESPONSES:resolve("scripts/lab-test-fonts.cjs")};
const child=spawn(process.execPath,["--require",resolve("scripts/lab-test-guard.cjs"),resolve("node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","4317"],{env,stdio:"inherit"});
// Readiness must compile the authenticated Lab, not merely return a login redirect.
const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
const now=Math.floor(Date.now()/1000);
const payload=enc({alg:"HS256"})+"."+enc({email:"gaec.cesam@gmail.com",iss:"cesam",iat:now,exp:now+3600});
const cookie="cesam_session="+payload+"."+createHmac("sha256",env.CESAM_SESSION_SECRET).update(payload).digest("base64url");
let ready=false;
const health=createServer((req,res)=>{res.statusCode=ready?200:503;res.end(ready?"ready":"warming");});
health.listen(4318,"127.0.0.1");
(async()=>{
 for(let i=0;i<100;i++){
  try{
   const response=await fetch("http://127.0.0.1:4317/lab",{headers:{cookie},redirect:"manual",signal:AbortSignal.timeout(90000)});
   const html=await response.text();
   if(response.ok&&html.includes("CESAM LAB")&&html.includes("Données fictives")){
    const paths=[...new Set(Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g),m=>m[1].replace(/&amp;/g,"&")))];
    if(!paths.length)throw new Error("No script assets in Lab");
    for(const path of paths){
     const url=new URL(path,"http://127.0.0.1:4317");
     if(url.origin!=="http://127.0.0.1:4317"||!url.pathname.startsWith("/_next/"))throw new Error("Unexpected script asset");
     const asset=await fetch(url,{headers:{cookie},redirect:"manual"});
     if(!asset.ok)throw new Error("Asset warmup failed: "+url.pathname);
     await asset.arrayBuffer();
    }
    ready=true;console.log("Authenticated Lab and script assets warmed");return;
   }
  }catch(e){console.log("Lab warmup:",e.message);}
  await new Promise(r=>setTimeout(r,1000));
 }
 child.kill();process.exit(1);
})();
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{health.close();child.kill(signal);});
child.on("exit",code=>process.exit(code??1));
