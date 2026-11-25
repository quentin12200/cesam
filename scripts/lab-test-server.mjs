import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// Fail closed: Next automatically loads .env files, so never start in a checkout containing one.
if (readdirSync(process.cwd()).some(n=>/^\.env(?:$|\.)/.test(n)&&![".env.example",".env.template"].includes(n))) throw new Error("Use a clean checkout without .env files");
if (!existsSync(resolve("node_modules/next/dist/bin/next"))) throw new Error("Run npm ci first");
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",CESAM_SESSION_SECRET:"local-fixture-only-not-a-production-secret",DATABASE_URL:"file:/tmp/cesam-lab-unused.db",CESAM_LAB_TEST_ONLY:"1",NODE_OPTIONS:"--require="+resolve("scripts/lab-test-guard.cjs"),NEXT_FONT_GOOGLE_MOCKED_RESPONSES:resolve("scripts/lab-test-fonts.cjs")};
const child=spawn(process.execPath,["--require",resolve("scripts/lab-test-guard.cjs"),resolve("node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","4317"],{env,stdio:"inherit"});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>process.exit(code??1));
