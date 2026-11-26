export const ECHO_ACTIONS = ["Métrabole à prévoir","Estrumate à prévoir","À revérifier","Bolus à prévoir"] as const;
export const ECHO_OBSERVATIONS = ["Cyclée","Non cyclée","Métrite"] as const;
export type EchoAction = { type: typeof ECHO_ACTIONS[number]; due: string };
export type EchoEvent = { id?: string; nom: string };
export const normEcho = (s:string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
export function validEchoDate(s:unknown): s is string {
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function validateEchoExtras(events:EchoEvent[],actions:EchoAction[],date:string){
 if(!Array.isArray(events)||!Array.isArray(actions)||events.length>50||actions.length>4)throw new Error("Suivi invalide");
 if(events.some(e=>!e||typeof e.nom!=="string"||!e.nom.trim()||e.nom.length>100||e.id!==undefined&&typeof e.id!=="string"))throw new Error("Événement invalide");
 const names=events.map(e=>normEcho(e.nom));
 if(new Set(names).size!==names.length||names.includes("cyclee")&&names.includes("non cyclee"))throw new Error("Observations incompatibles ou en double");
 if(actions.some(a=>!a||!ECHO_ACTIONS.includes(a.type)||!validEchoDate(a.due)||a.due<date)||new Set(actions.map(a=>a.type)).size!==actions.length)throw new Error("Action ou échéance invalide");
}
export function toggleEchoEvent(events:EchoEvent[],event:EchoEvent){
 const key=normEcho(event.nom);
 return events.some(e=>normEcho(e.nom)===key)?events.filter(e=>normEcho(e.nom)!==key):[...events.filter(e=>!(key==="cyclee"&&normEcho(e.nom)==="non cyclee")&&!(key==="non cyclee"&&normEcho(e.nom)==="cyclee")),event];
}
