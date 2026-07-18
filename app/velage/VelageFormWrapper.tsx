"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { getMomentActuel } from "@/lib/evenements-sanitaires";

type Qualificatif = "NORMAL" | "DIFFICILE" | "AVORTEMENT" | "MORT_NEE";
type Veau = { nutrav: string; sexe: "M" | "F" | ""; nom: string; statut: "VIVANT" | "MORT_NE" };
type Capteur = { numero: number; actif: boolean; animalNutrav: string | null };
const vide = (statut: Veau["statut"] = "VIVANT"): Veau => ({ nutrav: "", sexe: "", nom: "", statut });
const COMPLICATIONS = ["Non-délivrance", "Rétention placentaire", "Retournement de matrice", "Prolapsus vaginal"];
const QUALIFICATIFS: { value: Qualificatif; label: string; color: string }[] = [
  { value: "NORMAL", label: "Normal", color: "bg-green-500 border-green-500" },
  { value: "DIFFICILE", label: "Difficile", color: "bg-orange-400 border-orange-400" },
  { value: "AVORTEMENT", label: "Avortement", color: "bg-red-500 border-red-500" },
  { value: "MORT_NEE", label: "Mort-né", color: "bg-gray-600 border-gray-600" },
];
const PRECISIONS: Record<Qualificatif, { value: string; label: string }[]> = {
  NORMAL: [{ value: "SEULE", label: "Seule" }, { value: "ASSISTEE", label: "Assistée" }],
  DIFFICILE: [{ value: "MAUVAIS_POSITIONNEMENT", label: "Mauvais positionnement" }, { value: "GROS_VEAU", label: "Gros veau" }, { value: "VACHE_NON_PREPAREE", label: "Vache non préparée" }, { value: "CESARIENNE", label: "Césarienne" }],
  AVORTEMENT: [], MORT_NEE: [],
};

interface Props { initialOpen?: boolean; initialMere?: string; initialDate?: string; initialSexe?: "M" | "F" | ""; capteurs?: Capteur[] }

export default function VelageFormWrapper({ initialOpen = false, initialMere = "", initialDate, initialSexe = "", capteurs = [] }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(initialOpen), [mere, setMere] = useState(initialMere);
  const [mereNom, setMereNom] = useState<string | null>(null), [date, setDate] = useState(initialDate || today);
  const [veaux, setVeaux] = useState<Veau[]>([{ ...vide(), sexe: initialSexe }]);
  const [qualificatif, setQualificatif] = useState<Qualificatif>("NORMAL"), [precision, setPrecision] = useState("SEULE");
  const [capteur, setCapteur] = useState(""), [pereNom, setPereNom] = useState(""), [pereAuto, setPereAuto] = useState(false);
  const [complications, setComplications] = useState<Set<string>>(new Set()), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chargerMere = useCallback(async (nutrav: string) => {
    if (nutrav.length < 3) return setMereNom(null);
    try {
      const res = await fetch(`/api/animaux/${nutrav}`); if (!res.ok) return setMereNom(null);
      const data = await res.json(); setMereNom(data.nobovi);
      const nom = data.saillies?.[0]?.taureau?.nopere ?? data.saillies?.[0]?.pereNom ?? "";
      if (nom && (!pereAuto || !pereNom)) { setPereNom(nom); setPereAuto(true); }
      const attribue = capteurs.find((c) => c.actif && c.animalNutrav === nutrav);
      if (attribue) setCapteur(String(attribue.numero));
    } catch {}
  }, [capteurs, pereAuto, pereNom]);
  useEffect(() => { if (initialOpen && initialMere) void chargerMere(initialMere); }, [chargerMere, initialMere, initialOpen]);

  function changerMere(value: string) { const n = value.toUpperCase(); setMere(n); setMereNom(null); if (debounce.current) clearTimeout(debounce.current); debounce.current = setTimeout(() => void chargerMere(n), 500); }
  function nombre(n: number) { n = Math.max(1, Math.min(10, n || 1)); setVeaux((v) => Array.from({ length: n }, (_, i) => v[i] ?? vide(qualificatif === "MORT_NEE" ? "MORT_NE" : "VIVANT"))); }
  function modifierVeau(i: number, data: Partial<Veau>) { setVeaux((v) => v.map((x, j) => i === j ? { ...x, ...data } : x)); }
  function changerQualificatif(q: Qualificatif) {
    setQualificatif(q); setPrecision(q === "NORMAL" ? "SEULE" : ""); if (q !== "DIFFICILE") setComplications(new Set());
    if (q === "AVORTEMENT") setVeaux([]); else if (q === "MORT_NEE") setVeaux((v) => (v.length ? v : [vide("MORT_NE")]).map((x) => ({ ...x, statut: "MORT_NE" })));
    else if (!veaux.length) setVeaux([vide()]);
  }
  function reset() { setMere(""); setMereNom(null); setDate(today); setVeaux([vide()]); setQualificatif("NORMAL"); setPrecision("SEULE"); setCapteur(""); setPereNom(""); setPereAuto(false); setComplications(new Set()); }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/velages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vacheNutrav: mere, date, qualificatif, sousType: precision || undefined, capteur: capteur ? Number(capteur) : undefined, pereNom: pereNom || undefined, veaux }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Erreur");
      if (qualificatif === "DIFFICILE") { const types = new Set(complications); if (precision === "CESARIENNE") types.add("Césarienne"); await Promise.all(Array.from(types).map((type) => fetch("/api/evenements/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animalIds: [data.vacheId], date, moment: getMomentActuel(), categorie: "INTERVENTION", type, description: `Suite au vêlage du ${new Date(date).toLocaleDateString("fr-FR")}` }) }).catch(() => {}))); }
      setOpen(false); reset(); setMessage({ text: "Vêlage enregistré !", ok: true });
    } catch (err) { setMessage({ text: String(err).replace("Error: ", ""), ok: false }); } finally { setSaving(false); }
  }

  return <>
    {message && <div className={`px-4 py-3 rounded-xl text-sm border ${message.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>{message.text}</div>}
    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-4 rounded-xl font-medium"><Plus size={20} /> Enregistrer un vêlage</button>
    {open && <div className="fixed inset-0 bg-black/50 z-50 flex items-end"><div className="bg-white rounded-t-2xl w-full p-6 max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-4"><h3 className="text-lg font-bold">Enregistrer un vêlage</h3><button onClick={() => { setOpen(false); reset(); }} className="text-2xl text-gray-400">×</button></div>
      <form onSubmit={enregistrer} className="space-y-5">
        <div><label className="block text-sm font-medium mb-1">NUTRAV de la vache</label><input value={mere} onChange={(e) => changerMere(e.target.value)} required className="w-full border rounded-lg p-3 font-mono" />{mereNom && <p className="text-xs text-emerald-600 mt-1">{mereNom}</p>}</div>
        <div><label className="block text-sm font-medium mb-1">Date du vêlage</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full border rounded-lg p-3" /></div>
        <div><label className="block text-sm font-medium mb-2">Déroulement</label><div className="grid grid-cols-2 gap-2">{QUALIFICATIFS.map((q) => <button key={q.value} type="button" onClick={() => changerQualificatif(q.value)} className={`py-3 rounded-xl text-sm font-semibold border-2 ${qualificatif === q.value ? `${q.color} text-white` : "border-gray-200 bg-white"}`}>{q.label}</button>)}</div></div>
        {!!PRECISIONS[qualificatif].length && <div><label className="block text-sm text-gray-500 mb-2">Précision</label><div className="grid grid-cols-2 gap-2">{PRECISIONS[qualificatif].map((p) => <button key={p.value} type="button" onClick={() => setPrecision(p.value)} className={`py-2.5 rounded-lg text-sm border-2 ${precision === p.value ? "border-gray-600 bg-gray-100 font-semibold" : "border-gray-200"}`}>{p.label}</button>)}</div></div>}
        {qualificatif !== "AVORTEMENT" && <div className="space-y-3"><div className="flex items-end gap-2"><div className="flex-1"><label className="block text-sm font-medium mb-1">Nombre total de veaux</label><input type="number" min={1} max={10} value={veaux.length} onChange={(e) => nombre(Number(e.target.value))} className="w-full border rounded-lg p-3" /></div><button type="button" onClick={() => nombre(2)} className="border border-purple-300 text-purple-700 rounded-lg px-4 py-3">Jumeaux</button></div>
          {veaux.map((veau, i) => <div key={i} className="bg-sky-50 rounded-xl p-4 space-y-3"><p className="font-semibold text-sky-800">Veau {i + 1}</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={qualificatif === "MORT_NEE"} onClick={() => modifierVeau(i, { statut: "VIVANT" })} className={`py-2 rounded-lg border-2 ${veau.statut === "VIVANT" ? "bg-green-500 text-white border-green-500" : "bg-white border-gray-200"}`}>Vivant</button><button type="button" onClick={() => modifierVeau(i, { statut: "MORT_NE" })} className={`py-2 rounded-lg border-2 ${veau.statut === "MORT_NE" ? "bg-gray-600 text-white border-gray-600" : "bg-white border-gray-200"}`}>Mort-né</button></div><input value={veau.nutrav} onChange={(e) => modifierVeau(i, { nutrav: e.target.value.toUpperCase() })} placeholder="NUTRAV (optionnel)" className="w-full border rounded-lg p-3 font-mono bg-white" /><div className="grid grid-cols-2 gap-2">{(["M", "F"] as const).map((s) => <button key={s} type="button" onClick={() => modifierVeau(i, { sexe: s })} className={`py-2 rounded-lg border-2 ${veau.sexe === s ? (s === "M" ? "bg-sky-500 text-white border-sky-500" : "bg-pink-500 text-white border-pink-500") : "bg-white border-gray-200"}`}>{s === "M" ? "♂ Mâle" : "♀ Femelle"}</button>)}</div><input value={veau.nom} onChange={(e) => modifierVeau(i, { nom: e.target.value })} placeholder="Nom / surnom (optionnel)" className="w-full border rounded-lg p-3 bg-white" /></div>)}
        </div>}
        {qualificatif === "DIFFICILE" && <div className="bg-red-50 rounded-xl p-4"><label className="block text-sm font-semibold text-red-800 mb-2">Complications sanitaires (optionnel)</label><div className="grid grid-cols-2 gap-2">{COMPLICATIONS.map((c) => <button key={c} type="button" onClick={() => setComplications((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; })} className={`py-2 rounded-lg text-sm border-2 ${complications.has(c) ? "border-red-500 bg-red-100" : "border-gray-200 bg-white"}`}>{c}</button>)}</div></div>}
        <div><label className="block text-sm font-medium mb-1">Nom du père</label><input value={pereNom} onChange={(e) => { setPereNom(e.target.value); setPereAuto(false); }} className="w-full border rounded-lg p-3" />{pereAuto && <p className="text-xs text-emerald-500 mt-1">Prérempli depuis la dernière saillie</p>}</div>
        <div><label className="block text-sm font-medium mb-1">Capteur utilisé (optionnel)</label><select value={capteur} onChange={(e) => setCapteur(e.target.value)} className="w-full border rounded-lg p-3"><option value="">Aucun capteur</option>{capteurs.map((c) => <option key={c.numero} value={c.numero}>Capteur {c.numero}{c.actif && c.animalNutrav ? ` — ${c.animalNutrav}` : ""}</option>)}</select></div>
        <button disabled={saving} className="w-full bg-pink-500 text-white py-4 rounded-xl font-semibold disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le vêlage"}</button>
      </form></div></div>}
  </>;
}
