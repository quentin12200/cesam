"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

type Child = { number: string; name: string | null; sex: string; birth: string | null; mother: string | null; status: string };
export type LabFather = { id: string; number: string; name: string | null; present: boolean; offspring: number; presentOffspring: number; children: Child[] };
type Sort = "number" | "name" | "sex" | "age" | "mother";
const workNumber = (value: string) => value.replace(/\s/g, "").slice(-4);
function age(date: string | null) {
  if (!date) return "—";
  const months = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (365.2425 / 12 * 86400000)));
  return months < 24 ? `${months} mois` : `${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}`;
}
export default function LabFathers({ fathers }: { fathers: LabFather[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"ALL" | "FARM" | "IA">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("number");
  const [reverse, setReverse] = useState(false);
  const visible = useMemo(() => fathers.filter(f =>
    (kind === "ALL" || (kind === "FARM" ? f.present : !f.present)) &&
    [f.name ?? "", f.number, workNumber(f.number), ...f.children.map(c => c.number)].join(" ").toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr").trim())
  ).sort((a,b) => (a.name ?? a.number).localeCompare(b.name ?? b.number, "fr")), [fathers, search, kind]);
  const current = fathers.find(f => f.id === selected);
  const descendants = useMemo(() => [...(current?.children ?? [])].sort((a,b) => {
    const val = (c: Child) => sort === "number" ? c.number : sort === "name" ? c.name ?? "" : sort === "sex" ? c.sex : sort === "mother" ? c.mother ?? "" : c.birth ?? "";
    return (reverse ? -1 : 1) * val(a).localeCompare(val(b), "fr", {numeric: true});
  }), [current, sort, reverse]);
  return <section className="space-y-3">
    <h2 className="text-xl font-black">Tableau des pères</h2>
    <p className="text-xs text-gray-600">Une seule liste de reproducteurs. Lecture seule : les corrections et fusions ne sont pas encore activées.</p>
    <input aria-label="Rechercher un père" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, numéro national, numéro de travail, veau…" className="w-full rounded-xl border bg-white px-3 py-3 text-base"/>
    <div className="flex gap-2" role="group" aria-label="Type de reproducteur">
      {([["ALL","Tous"],["FARM","🐂 Ferme"],["IA","💉 IA"]] as const).map(([value,label]) => <button key={value} onClick={() => setKind(value)} aria-pressed={kind===value} className={`rounded-full border px-3 py-2 text-sm ${kind===value?"bg-green-800 text-white":"bg-white text-gray-700"}`}>{label}</button>)}
    </div>
    <p className="text-xs text-gray-500">{visible.length} pères affichés · Ferme = présent dans le troupeau</p>
    <div className="space-y-2">{visible.map(f => <div key={f.id} className="rounded-xl border bg-white p-3">
      <div className="flex items-center gap-3">
        <Link href={`/taureaux/${f.id}`} className="min-w-0 flex-1 flex items-center gap-3" aria-label={`Ouvrir la fiche de ${f.name ?? f.number}`}>
          <span className="flex w-32 shrink-0 flex-col"><strong className="font-mono text-xl">{workNumber(f.number)}</strong><span className="break-all font-mono text-[10px] text-gray-500">{f.number}</span></span>
          <span className="min-w-0"><strong className="block truncate">{f.name ?? "Sans nom"}</strong><span className="text-xs text-gray-500">{f.present ? "🐂 Ferme" : "💉 IA"}</span></span>
        </Link>
        <div className="relative"><button aria-label={`Actions ${f.name ?? f.number}`} aria-expanded={menu===f.id} className="rounded-lg border px-3 py-1 text-lg" onClick={() => setMenu(menu===f.id ? null : f.id)}>⋯</button>
          {menu===f.id && <div className="absolute right-0 z-20 w-56 rounded-xl border bg-white p-3 shadow-xl space-y-2">
            <Link className="block text-green-800 underline" href={`/taureaux/${f.id}`}>Voir la fiche</Link>
            <Link className="block text-green-800 underline" href="/taureaux/controle">Contrôler / corriger dans CESAM</Link>
            <span className="block text-xs text-gray-500">Fusion et suppression non disponibles dans ce prototype.</span>
          </div>}
        </div>
      </div>
      <button onClick={() => {setSelected(selected===f.id ? null : f.id);setMenu(null)}} className="mt-3 flex w-full items-center justify-between border-t pt-2 text-sm text-green-800">
        <span>{f.offspring} descendants · {f.presentOffspring} présents</span><span>{selected===f.id?"Masquer ▲":"Voir les descendants ▼"}</span>
      </button>
      {selected===f.id && <div className="mt-3 overflow-x-auto">
        <div className="mb-2 flex items-center justify-between"><strong className="text-sm">Descendance de {f.name ?? f.number}</strong><button className="text-xs underline" onClick={() => setSelected(null)}>Fermer</button></div>
        <div className="mb-2 flex flex-wrap items-center gap-2"><label className="text-xs" htmlFor="father-sort">Trier par</label><select id="father-sort" className="rounded border p-1 text-xs" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="number">Numéro</option><option value="name">Nom</option><option value="sex">Sexe</option><option value="age">Âge</option><option value="mother">Mère</option></select><button className="rounded border px-2 py-1 text-xs" onClick={() => setReverse(!reverse)}>Inverser ↕</button></div>
        <table className="w-full min-w-[360px] text-left text-xs"><thead><tr className="border-b text-gray-500"><th className="py-2">Animal</th><th>Âge</th><th>Mère</th><th>Statut</th></tr></thead><tbody>{descendants.map(c => <tr key={c.number} className="border-b last:border-0"><td className="py-2"><Link href={`/troupeau/${encodeURIComponent(c.number)}`} className={`inline-block rounded-lg px-2 py-1 underline ${c.sex==="F"?"bg-pink-50 text-pink-800":"bg-blue-50 text-blue-800"}`}><strong>{c.number}</strong>{c.name && <span className="block text-[10px]">{c.name}</span>}</Link></td><td>{age(c.birth)}</td><td>{c.mother ?? "—"}</td><td>{c.status==="ACTIF"?"Présent":"Sorti"}</td></tr>)}</tbody></table>
        {descendants.length===0 && <p className="py-3 text-sm text-gray-500">Aucun descendant relié à cette fiche. Cela ne prouve pas l'absence de descendants dans les données historiques.</p>}
      </div>}
    </div>)}</div>
  </section>;
}
