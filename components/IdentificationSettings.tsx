"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Tags } from "lucide-react";
import { numeroNationalDuLot } from "@/lib/identification";

type Lot = { id: string; reference: string | null; premierNutrav: string; premierNunati: string; quantite: number; prochainIndex: number };

export default function IdentificationSettings() {
  const [lot, setLot] = useState<Lot | null>(null), [nouveauLot, setNouveauLot] = useState(false);
  const [lotsEnAttente, setLotsEnAttente] = useState<Lot[]>([]);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [premierNunati, setPremierNunati] = useState(""), [quantite, setQuantite] = useState("");

  async function charger() { const res = await fetch("/api/identification"); if (res.ok) { const data = await res.json(); setLot(data.lotActif); setLotsEnAttente(data.lotsEnAttente ?? []); } }
  useEffect(() => { void charger(); }, []);
  async function creerLot() {
    setSaving(true); setMessage("");
    const res = await fetch("/api/identification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ premierNunati, quantite: Number(quantite) }) });
    setSaving(false);
    if (res.ok) { setNouveauLot(false); setPremierNunati(""); setQuantite(""); setMessage(lot ? "Nouveau lot enregistré. Il prendra la suite du lot actuel." : "Nouveau lot activé"); await charger(); }
    else setMessage((await res.json()).error ?? "Erreur");
  }

  const restantes = lot ? Math.max(0, lot.quantite - lot.prochainIndex) : 0;
  const prochainNutrav = lot && restantes > 0 ? String(Number(lot.premierNutrav) + lot.prochainIndex).padStart(4, "0").slice(-4) : "—";
  const dernierNational = premierNunati && Number(quantite) > 0 ? numeroNationalDuLot(premierNunati, Number(quantite) - 1) : "";

  return <details className="group mt-5 border-t border-gray-100 pt-4">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2"><Tags size={18} className="text-orange-600" /><span className="flex-1 text-sm font-bold">Identification des animaux</span><ChevronDown size={17} className="transition group-open:rotate-180" /></summary>
    <div className="space-y-3 pt-3">
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-bold">Lot actif</h4>{!lot && <p className="mt-1 text-xs text-gray-500">Aucun lot configuré</p>}</div><button type="button" onClick={() => setNouveauLot((v) => !v)} className="text-right text-xs font-semibold text-green-700">Ajouter un nouveau lot de boucles</button></div>
        {lot && <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><div><dt className="text-gray-500">Premier numéro national</dt><dd className="font-mono font-semibold break-all">{lot.premierNunati}</dd></div><div><dt className="text-gray-500">Quantité commandée</dt><dd className="font-semibold">{lot.quantite}</dd></div><div><dt className="text-gray-500">Prochain numéro de travail</dt><dd className="font-mono text-base font-bold text-green-700">{prochainNutrav}</dd></div><div><dt className="text-gray-500">Boucles restantes</dt><dd className={`text-base font-bold ${restantes === 0 ? "text-red-700" : restantes <= Math.ceil(lot.quantite * .1) ? "text-orange-700" : "text-gray-800"}`}>{restantes}</dd></div></dl>}
        {lotsEnAttente.length > 0 && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{lotsEnAttente.length} lot{lotsEnAttente.length > 1 ? "s" : ""} en attente. {lotsEnAttente[0].premierNunati} prendra automatiquement la suite.</p>}
        {nouveauLot && <div className="mt-3 space-y-2 border-t border-gray-100 pt-3"><input value={premierNunati} onChange={(e) => setPremierNunati(e.target.value.toUpperCase())} placeholder="Premier numéro national complet" className="w-full rounded-lg border px-3 py-2.5 font-mono text-sm" /><input value={quantite} onChange={(e) => setQuantite(e.target.value)} type="number" min={1} placeholder="Nombre de boucles commandées" className="w-full rounded-lg border px-3 py-2.5 text-sm" />{dernierNational && <p className="text-xs text-gray-500">La série ira jusqu’à <span className="font-mono">{dernierNational}</span>. Les numéros de travail seront les 4 derniers chiffres.</p>}<button type="button" disabled={saving} onClick={() => void creerLot()} className="min-h-11 w-full rounded-lg bg-green-700 text-sm font-semibold text-white disabled:opacity-50">Enregistrer ce lot</button></div>}
      </div>
      {message && <p className={`text-xs font-medium ${message.includes("Erreur") || message.includes("utilisé") ? "text-red-600" : "text-green-700"}`}>{message}</p>}
    </div>
  </details>;
}
