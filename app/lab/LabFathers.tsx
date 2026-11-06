"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type LabFather = { id: string; number: string; name: string | null; offspring: number; presentOffspring: number; children: string[] };
export default function LabFathers({ fathers }: { fathers: LabFather[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const visible = useMemo(() => fathers.filter(f => [f.name ?? "", f.number, ...f.children].join(" ").toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr").trim())), [fathers, search]);
  return <section className="space-y-3">
    <h2 className="text-xl font-black">Tableau des pères</h2>
    <p className="text-sm text-gray-600">Prototype en lecture seule : aucune correction, fusion ou suppression possible ici.</p>
    <input aria-label="Rechercher un père" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, numéro national, veau…" className="w-full rounded-xl border bg-white px-3 py-3 text-base" />
    <p className="text-xs text-gray-500">{visible.length} pères affichés</p>
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[540px] text-left text-sm">
        <thead className="bg-green-800 text-white"><tr><th className="p-3">N° national</th><th className="p-3">Nom</th><th className="p-3 text-center">Descendants</th><th className="p-3 text-center">Présents</th><th className="p-3">Actions</th></tr></thead>
        <tbody>{visible.map(f=><tr key={f.id} className="border-t">
          <td className="p-3 font-mono">{f.number}</td><td className="p-3 font-semibold">{f.name ?? "Sans nom"}</td>
          <td className="p-3 text-center"><button className="text-green-800 underline" onClick={()=>setSelected(selected===f.id?null:f.id)}>{f.offspring}</button></td>
          <td className="p-3 text-center">{f.presentOffspring}</td>
          <td className="relative p-3"><button aria-label={"Actions "+(f.name??f.number)} aria-expanded={menu===f.id} className="rounded-lg border px-3 py-1" onClick={()=>setMenu(menu===f.id?null:f.id)}>⋯</button>
            {menu===f.id&&<div className="absolute right-2 z-10 w-52 space-y-2 rounded-xl border bg-white p-3 shadow-xl">
              <Link className="block text-green-800 underline" href={`/taureaux/${f.id}`}>Voir la fiche dans CESAM</Link>
              <span className="block text-xs text-gray-500">Corriger, fusionner et supprimer : désactivés pendant le test.</span>
            </div>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    {selected&&(()=>{const f=fathers.find(x=>x.id===selected);return f?<div className="rounded-xl border bg-white p-3"><div className="mb-2 flex justify-between"><strong>Descendants de {f.name??f.number}</strong><button onClick={()=>setSelected(null)}>Fermer ×</button></div><div className="flex flex-wrap gap-2">{f.children.map(n=><Link key={n} className="rounded-lg bg-green-50 px-2 py-1 text-green-800 underline" href={`/troupeau/${encodeURIComponent(n)}`}>{n}</Link>)}{f.children.length===0&&"Aucun descendant identifié"}</div></div>:null})()}
  </section>;
}
