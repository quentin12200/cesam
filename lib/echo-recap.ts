type Animal = {id:string;nutrav:string;nobovi:string|null};
type Gestation = {id:string;resultatEcho:string|null;joursGestation:number|null;saillie:{animal:Animal}};
type Request = {id:string;animal:Animal};
export function buildEchoRecap(gestations:Gestation[], requests:Request[]) {
    // A closed request can duplicate a gestation result; prefer the explicit result.
    const known = new Set(gestations.map(g=>g.saillie.animal.id));
    const rows = gestations.map(g=>({id:g.id,number:g.saillie.animal.nutrav,name:g.saillie.animal.nobovi,result:g.resultatEcho,days:g.resultatEcho==="PLEINE"?g.joursGestation:null}));
    const seen = new Set<string>();
    for(const r of requests) {
      if(known.has(r.animal.id)||seen.has(r.animal.id)) continue;
      seen.add(r.animal.id);
      rows.push({id:r.id,number:r.animal.nutrav,name:r.animal.nobovi,result:"VIDE",days:null});
    }
    rows.sort((a,b)=>a.number.localeCompare(b.number,"fr",{numeric:true}));

    return rows;
}
