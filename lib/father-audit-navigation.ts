import {safeReturnTo} from "./origin-navigation.ts";
export const AUDIT_PATH="/taureaux/controle/anciens-velages";
export function auditReturnHref(origin:string, ids:string[], id:string, demo=false){
 const path=demo?"/lab":AUDIT_PATH;
 const url=new URL(safeReturnTo(origin)??path,"https://cesam.local");
 if(url.pathname!==path) throw new Error("Origine de contrôle invalide");
 const index=ids.indexOf(id);
 if(index<0) throw new Error("Vêlage absent du contrôle");
 const target=(row:string|undefined)=>{const copy=new URL(url);copy.hash=row?"filiation-"+encodeURIComponent(row):"filiations-fin";return copy.pathname+copy.search+copy.hash;};
 return {returnTo:target(id),successReturnTo:target(ids[index+1] ?? (index>0 ? ids[0] : undefined))};
}
export function fatherAuditEditHref(id:string,origin:string,ids:string[]){
 const destinations=auditReturnHref(origin,ids,id);
 return "/velage?"+new URLSearchParams({modifier:id,...destinations}).toString();
}
export function auditSuccessTarget(origin:string|null,target:string|null){
 const a=safeReturnTo(origin),b=safeReturnTo(target);
 if(!a||!b)return null;
 const from=new URL(a,"https://cesam.local"),to=new URL(b,"https://cesam.local");
 return from.pathname===AUDIT_PATH&&to.pathname===AUDIT_PATH&&from.search===to.search&&/^#filiation(?:s-fin|-[^#]+)$/.test(to.hash)?b:null;
}
