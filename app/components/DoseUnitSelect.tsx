"use client";
import { DOSE_UNITS, normaliserUniteDose } from "@/lib/dose-units";
export default function DoseUnitSelect({value,onChange,className}:{value:string;onChange:(value:string)=>void;className?:string}){
 return <select aria-label="Unité de dose" value={normaliserUniteDose(value)} onChange={e=>onChange(e.target.value)} className={className ?? "w-full border rounded-lg px-3 py-2 text-sm bg-white"}><option value="">Unité…</option>{DOSE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>;
}
