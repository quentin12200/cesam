"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Search, Users, ChevronRight, ArrowLeft, Stethoscope, Scale, Syringe, ScanLine } from "lucide-react";

type Animal = { id: string; nutrav: string; nobovi: string | null; sexbov: string; aEchographier: boolean };
type Echeance = { id: string; nutrav: string; nom: string | null; date: string };
type View = "accueil" | "animaux" | "prevoir" | "seances";

const TYPES = [
  { label: "Échographies", icon: ScanLine, desc: "Séance collective" },
  { label: "Vaccinations", icon: Syringe, desc: "Séance collective" },
  { label: "Antiparasitaires", icon: Stethoscope, desc: "Intervention collective" },
  { label: "Soins / traitements", icon: ClipboardList, desc: "Intervention collective" },
  { label: "Pesées", icon: Scale, desc: "Séance de pesée" },
  { label: "Autre intervention", icon: Users, desc: "Travail en groupe" },
];

export default function LabExplorer({ animaux, echeances }: { animaux: Animal[]; echeances: Echeance[] }) {
  const [view, setView] = useState<View>("accueil");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const matches = useMemo(() => animaux.filter((a) => (a.nutrav + " " + (a.nobovi ?? "")).toLowerCase().includes(query.toLowerCase())).slice(0, 35), [animaux, query]);
  const upcoming = [...echeances].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15);

  function go(next: View) { setView(next); setSelected(null); setSession(null); }
  return (
    <div className="space-y-4">
      <nav className="grid grid-cols-3 gap-2" aria-label="Explorer CESAM LAB">
        {([["animaux", "Animaux", Search], ["prevoir", "À prévoir", CalendarDays], ["seances", "Séances", Users]] as const).map(([id, label, Icon]) => (
          <button type="button" key={id} onClick={() => go(id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-sm font-bold ${view === id ? "border-green-700 bg-green-50 text-green-800" : "border-gray-200 bg-white text-gray-700"}`}><Icon size={20}/>{label}</button>
        ))}
      </nav>
      {(view === "accueil" || view === "animaux") && (
        <section className="space-y-3">
          <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-3"><Search size={19} className="text-gray-500"/><input value={query} onChange={(e) => { setQuery(e.target.value); setView("animaux"); setSelected(null); }} placeholder="Rechercher un numéro ou un nom…" className="w-full min-w-0 bg-transparent text-base outline-none" /></label>
          {view === "accueil" && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => go("prevoir")} className="rounded-2xl bg-amber-50 p-4 text-left"><CalendarDays className="text-amber-700"/><b className="mt-2 block">À prévoir</b><span className="text-xs text-gray-600">{echeances.length} gestations au calendrier</span></button>
              <button onClick={() => go("seances")} className="rounded-2xl bg-blue-50 p-4 text-left"><Users className="text-blue-700"/><b className="mt-2 block">Démarrer un travail</b><span className="text-xs text-gray-600">Plusieurs animaux</span></button>
            </div>
          )}
          {view === "animaux" && <p className="text-xs text-gray-500">{matches.length} résultat(s) affiché(s) sur {animaux.length} animaux actifs</p>}
          {(view === "animaux" || query) && (
            <div className="space-y-2">
              {matches.map((a) => <div key={a.id} className="rounded-xl border bg-white">
                <button type="button" onClick={() => setSelected(selected === a.id ? null : a.id)} className="flex w-full items-center gap-2 p-3 text-left"><span className="rounded-lg bg-green-700 px-2 py-1 font-bold text-white">{a.nutrav}</span><b className="min-w-0 flex-1 truncate">{a.nobovi || "Sans nom"}</b><span className="text-xs text-gray-500">{a.sexbov === "F" ? "Femelle" : "Mâle"}</span><ChevronRight size={16}/></button>
                {selected === a.id && <div className="border-t bg-green-50 p-3"><p className="mb-2 text-sm font-semibold">Actions individuelles (aperçu uniquement)</p><div className="grid grid-cols-2 gap-2">{(a.sexbov === "F" ? ["Saillie / IA", "Écho", "Chaleur", "Vêlage", "Événement", "Pesée"] : ["Événement", "Pesée"]).map((label) => <span key={label} className="rounded-lg border bg-white p-3 text-center text-xs font-semibold">{label}</span>)}</div><p className="mt-2 text-xs text-gray-600">Les actions ne sont pas actives dans le LAB.</p></div>}
              </div>)}
            </div>
          )}
        </section>
      )}
      {view === "prevoir" && <section className="space-y-3"><h2 className="text-xl font-black">À prévoir</h2><p className="text-sm text-gray-600">Dates de vêlage prévues — données réelles, sans modification.</p><div className="space-y-2">{upcoming.map((e) => <div key={e.id} className="flex items-center justify-between rounded-xl border bg-white p-3"><div><b>{e.nutrav} · {e.nom || "Sans nom"}</b><p className="text-xs text-gray-500">Vêlage prévu</p></div><time className="font-bold text-green-800">{new Date(e.date).toLocaleDateString("fr-FR")}</time></div>)}{upcoming.length === 0 && <p className="rounded-xl bg-white p-4 text-sm">Aucune échéance trouvée.</p>}</div></section>}
      {view === "seances" && <section className="space-y-3"><h2 className="text-xl font-black">Séances de travail</h2><p className="text-sm text-gray-600">Choisis le travail à effectuer sur plusieurs bovins. Aucun acte n'est créé dans ce prototype.</p>{session && <button onClick={() => setSession(null)} className="flex items-center gap-2 text-sm font-semibold text-green-800"><ArrowLeft size={16}/> Retour aux séances</button>}{!session ? <div className="grid grid-cols-2 gap-3">{TYPES.map(({label,icon:Icon,desc})=><button type="button" onClick={()=>setSession(label)} key={label} className="rounded-xl border bg-white p-4 text-left"><Icon size={22} className="text-green-700"/><b className="mt-2 block text-sm">{label}</b><span className="text-xs text-gray-500">{desc}</span></button>)}</div>:<div className="rounded-2xl border border-green-200 bg-green-50 p-5"><b>{session}</b><p className="mt-2 text-sm">Ici, on pourrait choisir les animaux et enchaîner les saisies, en réutilisant les outils de CESAM.</p><p className="mt-3 text-xs font-semibold text-green-900">Prototype en lecture seule : aucune saisie possible.</p></div>}</section>}
      {view === "accueil" && <p className="text-sm text-gray-600">Bienvenue dans le LAB : découvre trois entrées simples sans changer le CESAM que tu utilises.</p>}
      <button type="button" onClick={() => { setQuery(""); go("accueil"); }} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700">Revenir à l'accueil du LAB</button>
    </div>
  );
}
