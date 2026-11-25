import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Lab bypasses real providers and tools rather than hiding them",()=>{
 const shell=read("components/CesamShell.tsx");
 const isolated=shell.slice(shell.indexOf("if (isLabRoute(pathname))"),shell.indexOf(" return <>"));
 assert.match(isolated,/Données fictives/);
 assert.doesNotMatch(isolated,/QuickSearch|GlobalScanner|NoteVoiceButton|GlobalSettingsButton|UserPreferencesProvider|ReproductionModalProvider|UndoProvider|InstallPrompt|TopNav|fetch\(/);
 assert.match(shell,/return <>[\s\S]*<UserPreferencesProvider>[\s\S]*<QuickSearch/);
 assert.match(read("app/layout.tsx"),/<CesamShell>\{children\}<\/CesamShell>/);
 assert.doesNotMatch(read("app/layout.tsx"),/<GlobalScanner|<QuickSearch|<InstallPrompt/);
});
test("Lab routes retain original authentication policy and no network operations in direct simulation components",()=>{
 const middleware=read("middleware.ts");
 assert.doesNotMatch(middleware,/"\/lab"|"\/prototype-accueil-v3"/);
 for(const p of ["app/lab/page.tsx","app/lab/LabExplorer.tsx","app/lab/LabCreatePanel.tsx","app/prototype-espace-travail/PrototypeWorkspace.tsx","app/prototype-accueil-v3/PrototypeAccueilV3.tsx"]) assert.doesNotMatch(read(p),/\bprisma\b|GENEA_DATA|fetch\(|\/api\//,p);
});
