"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Tags } from "lucide-react";

type Config = { identificationMode: string; nutravNbChiffres: number; nutravZerosGauche: boolean; propositionAutoNumero: boolean; serieCommuneSexes: boolean; serviceDeclaration: string };
type Lot = { id: string; reference: string | null; premierNutrav: string; premierNunati: string; quantite: number; prochainIndex: number };
const modes = [
  ["TRAVAIL_SEUL", "Numéro de travail uniquement"],
  ["TRAVAIL_ET_NATIONAL", "Numéro de travail d’abord, numéro national automatique si possible"],
  ["NATIONAL_OBLIGATOIRE", "Numéro national obligatoire"],
  ["CONNEXION_OFFICIELLE", "Connexion officielle — bientôt disponible"],
] as const;

export default function IdentificationSettings() {
  const [config, setConfig] = useState<Config | null>(null), [lot, setLot] = useState<Lot | null>(null);
  const [nouveauLot, setNouveauLot] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [reference, setReference] = useState(""), [premierNutrav, setPremierNutrav] = useState(""), [premierNunati, setPremierNunati] = useState(""), [quantite, setQuantite] = useState("");

  async function charger() { const res = await fetch("/api/identification"); if (res.ok) { const data = await res.json(); setConfig(data.config); setLot(data.lotActif); } }
  useEffect(() => { void charger(); }, []);
  async function enregistrerConfig() { if (!config) return; setSaving(true); const res = await fetch("/api/identification", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }); setSaving(false); setMessage(res.ok ? "Paramètres enregistrés" : "Erreur d’enregistrement"); if (res.ok) await charger(); }
  async function creerLot() { setSaving(true); const res = await fetch("/api/identification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, premierNutrav, premierNunati, quantite: Number(quantite) }) }); setSaving(false); if (res.ok) { setNouveauLot(false); setReference(""); setPremierNutrav(""); setPremierNunati(""); setQuantite(""); setMessage("Nouveau lot démarré"); await charger(); } else setMessage((await res.json()).error ?? "Erreur"); }
  if (!config) return <p className="mt-5 text-xs text-gray-500">Chargement de l’identification…</p>;

  return <details className="group mt-5 border-t border-gray-100 pt-4">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2"><Tags size={18} className="text-orange-600" /><span className="flex-1 text-sm font-bold">Identification des animaux</span><ChevronDown size={17} className="transition group-open:rotate-180" /></summary>
    <div className="space-y-4 pt-3">
      <div><label className="mb-1 block text-xs font-semibold text-gray-600">Mode d’identification</label><select value={config.identificationMode} onChange={(e) => setConfig({ ...config, identificationMode: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm">{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{config.identificationMode === "CONNEXION_OFFICIELLE" && <p className="mt-1 text-xs text-gray-500">Mode préparé mais connexion inactive pour le moment.</p>}</div>
      <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-semibold text-gray-600">Chiffres du numéro de travail</label><input type="number" min={1} max={10} value={config.nutravNbChiffres} onChange={(e) => setConfig({ ...config, nutravNbChiffres: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></div><div><label className="mb-1 block text-xs font-semibold text-gray-600">Service de déclaration</label><select value={config.serviceDeclaration} onChange={(e) => setConfig({ ...config, serviceDeclaration: e.target.value })} className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-sm"><option value="AUCUN">Aucun service</option><option value="SYNEL">Synel</option><option value="AUTRE_LOGICIEL">Autre logiciel</option><option value="DECLARATION_DIRECTE">Déclaration directe</option></select></div></div>
      <div className="space-y-2 text-sm">{[["nutravZerosGauche", "Ajouter les zéros à gauche"], ["propositionAutoNumero", "Proposer automatiquement le prochain numéro"], ["serieCommuneSexes", "Série commune aux mâles et femelles"]].map(([key, label]) => <label key={key} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={Boolean(config[key as keyof Config])} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} className="h-4 w-4" />{label}</label>)}</div>
      <button type="button" disabled={saving} onClick={() => void enregistrerConfig()} className="min-h-11 w-full rounded-lg bg-green-700 px-3 text-sm font-semibold text-white">Enregistrer les paramètres</button>

      <div className="rounded-xl border border-gray-200 p-3"><div className="flex items-start justify-between gap-2"><div><h4 className="text-sm font-bold">Lot de boucles actif</h4>{lot ? <p className="mt-1 text-xs text-gray-600">{lot.reference || "Sans référence"} · {lot.prochainIndex}/{lot.quantite} utilisées<br />Départ : {lot.premierNutrav} · {lot.premierNunati}</p> : <p className="mt-1 text-xs text-gray-500">Aucun lot configuré</p>}</div><button type="button" onClick={() => setNouveauLot((v) => !v)} className="text-xs font-semibold text-green-700">Démarrer un nouveau lot de boucles</button></div>
        {nouveauLot && <div className="mt-3 space-y-2 border-t border-gray-100 pt-3"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nom ou référence (facultatif)" className="w-full rounded-lg border px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><input value={premierNutrav} onChange={(e) => setPremierNutrav(e.target.value)} placeholder="Premier N° travail" className="rounded-lg border px-3 py-2 text-sm" /><input value={quantite} onChange={(e) => setQuantite(e.target.value)} type="number" min={1} placeholder="Quantité" className="rounded-lg border px-3 py-2 text-sm" /></div><input value={premierNunati} onChange={(e) => setPremierNunati(e.target.value.toUpperCase())} placeholder="Premier numéro national complet" className="w-full rounded-lg border px-3 py-2 text-sm" /><button type="button" disabled={saving} onClick={() => void creerLot()} className="min-h-10 w-full rounded-lg border border-green-600 text-sm font-semibold text-green-700">Créer et activer ce lot</button></div>}
      </div>
      <p className="text-xs text-gray-500">Statuts administratifs prévus : À déclarer, Transmise, Acceptée, Refusée, À corriger. La connexion officielle sera ajoutée ultérieurement.</p>
      {message && <p className="text-xs font-medium text-green-700">{message}</p>}
    </div>
  </details>;
}
