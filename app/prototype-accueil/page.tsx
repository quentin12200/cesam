"use client";

import { useState } from "react";
import Link from "next/link";
import AccueilRadialMenu from "@/app/components/AccueilRadialMenu";

const LABELS: Record<string, string> = {
  velage: "Vêlage", chaleur: "Chaleurs", saillie: "Saillie / IA",
  echographie: "Échographie", vaccination: "Vaccination",
  traitement: "Événement sanitaire", pesee: "Pesée rapide", bouclage: "Bouclage", parage: "Parage", liste_velages: "Liste des vêlages",
};

export default function PrototypeAccueilPage() {
  const [action, setAction] = useState("");
  const DESTINATIONS: Partial<Record<string,string>> = { velage:"/velage?nouveau=1", chaleur:"/reproduction", saillie:"/reproduction", echographie:"/reproduction", traitement:"/sanitaire/nouvel-evenement", pesee:"/troupeau/pesee", vaccination:"/sanitaire/vaccins", parage:"/parage", liste_velages:"/velage", bouclage:"/troupeau/identification" };
  const [animal, setAnimal] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-50 px-4 py-6 text-slate-900">
      <header className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">CESAM</h1><p className="text-sm text-slate-500">Prototype du nouvel accueil</p></div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Démonstration</span>
      </header>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Soins à faire <span className="float-right text-sm text-slate-500">2</span></h2>
        <p className="border-b py-2 text-sm">◯ &nbsp; Velle 7523 · Traitement <span className="float-right text-slate-500">20 h</span></p>
        <p className="py-2 text-sm">◯ &nbsp; Velle 7811 · Vaccination</p>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">À prévoir et à surveiller</h2>
        <div className="space-y-2 text-sm">
          <p>3 veaux à identifier</p>
          <p>2 vêlages prévus cette semaine</p>
          <p>4 veaux bientôt à sevrer</p>
          <p>1 échographie à programmer</p>
        </div>
      </section>
      {notes.length > 0 && <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="mb-2 font-bold">Notes rapides</h2>{notes.map((note, i) => <p key={i} className="border-b py-2 text-sm">{note}</p>)}</section>}
      {action && DESTINATIONS[action] && <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-bold">{LABELS[action]}</h2><p className="my-2 text-sm">Accès au module CESAM existant. Certaines actions de reproduction demandent encore de sélectionner l’animal dans le module.</p><Link className="block rounded-xl bg-blue-600 p-3 text-center font-semibold text-white" href={DESTINATIONS[action]!}>Ouvrir {LABELS[action]}</Link><button type="button" onClick={()=>setAction("")} className="mt-3 text-sm text-slate-600">Annuler</button></section>}
      {action && !DESTINATIONS[action] && <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-bold">Nouvel enregistrement · {LABELS[action]}</h2><button type="button" onClick={() => setAction("")} className="text-sm text-blue-700">Fermer</button></div>
        <label htmlFor="animal-prototype" className="block text-sm font-medium">Numéro de l'animal</label>
        <input id="animal-prototype" value={animal} onChange={(event) => setAnimal(event.target.value)} placeholder="Ex. 7523" className="w-full rounded-xl border p-3" />
        <p className="text-xs text-slate-500">Formulaire de démonstration : aucune donnée réelle n'est enregistrée.</p>
        <button type="button" disabled={!animal.trim()} onClick={() => { setMessage("Saisie simulée pour l'animal " + animal); setAction(""); setAnimal(""); }} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-40">Tester l'enregistrement</button>
      </section>}
      {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm">{message}</p>}
      <div className="py-3">
        <AccueilRadialMenu
          onAction={(id) => { setAction(id); setMessage(""); }}
          onSaveNote={async (content) => { setNotes((current) => [content, ...current]); }}
        />
      </div>
      <p className="text-center text-xs text-slate-500">Données fictives · Notes conservées uniquement tant que la page reste ouverte · Aucun effet sur l'élevage</p>
    </main>
  );
}
