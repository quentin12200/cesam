export const DOSE_UNITS = ["ml","mg","g","kg","L","bolus","dose","comprimé","sachet","UI","seringue","ampoule","goutte"] as const;
export function normaliserUniteDose(raw: string | null | undefined): string {
 const key = (raw ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const aliases: Record<string,string> = {cc:"ml","cm3":"ml","cm³":"ml",millilitre:"ml",millilitres:"ml",l:"L",litre:"L",litres:"L",cp:"comprimé",comprime:"comprimé",comprimes:"comprimé",ui:"UI",iu:"UI",doses:"dose",sachets:"sachet",seringues:"seringue",ampoules:"ampoule",gouttes:"goutte"};
 return aliases[key] ?? DOSE_UNITS.find(v=>v===key) ?? "";
}
export function lireDose(raw: string): number | null {
 const s=raw.trim();
 if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null;
 const n=Number(s.replace(",","."));
 return Number.isFinite(n) && n>0 ? n : null;
}
export function doseValide(dose:string,unite:string):boolean {
 return dose.trim()==="" || (lireDose(dose)!==null && normaliserUniteDose(unite)!=="");
}
