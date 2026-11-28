"use client";
export default function DelaiAttenteInput({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
 const interdit=value==="-1";
 return <div className="min-w-0 text-xs"><label className="block">{label}<div className="flex items-center gap-1"><input aria-label={label+" en jours"} type="number" min={0} step={1} disabled={interdit} value={interdit?"":value} onChange={e=>onChange(e.target.value)} className="min-w-0 w-full rounded border p-2 disabled:bg-gray-100"/><span>j</span></div></label><label className="flex items-center gap-1 min-h-9"><input type="checkbox" aria-label={label+" interdit"} checked={interdit} onChange={e=>onChange(e.target.checked?"-1":"")}/>Interdit</label></div>;
}
