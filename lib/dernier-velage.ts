export function repereDernierVelage(dernierVelage:string|null|undefined,dateActe:string,estGenisse?:boolean):string {
 if(dernierVelage===undefined)return "Dernier vêlage non renseigné";
 if(dernierVelage===null)return estGenisse===false?"Aucun vêlage enregistré":"Aucun vêlage enregistré";
 const parse=(v:string)=>{const s=v.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const n=Date.parse(s+"T00:00:00Z");return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:NaN;};
 const d=parse(dernierVelage),a=parse(dateActe);
 if(!Number.isFinite(d)||!Number.isFinite(a))return "Dernier vêlage : date à vérifier";
 const jours=(a-d)/86400000;
 const label=new Date(d).toLocaleDateString("fr-FR",{timeZone:"UTC"});
 return jours<0?`Dernier vêlage : ${label} · postérieur à l’acte`:`Dernier vêlage : ${label} · ${jours} j depuis vêlage`;
}
