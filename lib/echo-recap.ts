type Animal = {id:string;nutrav:string;nobovi:string|null};
type Gestation = {id:string;resultatEcho:string|null;joursGestation:number|null;dateEcho?:Date|null;observationEcho?:string|null;saillie:{animal:Animal;id?:string;taureau?:{id:string;nopere:string|null;nupere:string}|null}};
type Request = {id:string;animal:Animal;clotureeAt?:Date|null;observation?:string|null};
export function buildEchoRecap(gestations:Gestation[], requests:Request[]) {
    // A closed request can duplicate a gestation result; prefer the explicit result.
    const known = new Set(gestations.map(g=>g.saillie.animal.id));
    const rows = gestations.map(g=>({id:g.id,animalId:g.saillie.animal.id,saillieId:g.saillie.id??null,date:g.dateEcho??null,bull:g.saillie.taureau?.nopere||g.saillie.taureau?.nupere||null,observation:g.observationEcho??null,number:g.saillie.animal.nutrav,name:g.saillie.animal.nobovi,result:g.resultatEcho,days:g.resultatEcho==="PLEINE"?g.joursGestation:null}));
    const seen = new Set<string>();
    for(const r of requests) {
      if(known.has(r.animal.id)||seen.has(r.animal.id)) continue;
      seen.add(r.animal.id);
      rows.push({id:r.id,animalId:r.animal.id,saillieId:null,date:r.clotureeAt??null,bull:null,observation:r.observation??null,number:r.animal.nutrav,name:r.animal.nobovi,result:"VIDE",days:null});
    }
    rows.sort((a,b)=>a.number.localeCompare(b.number,"fr",{numeric:true}));

    return rows;
}
