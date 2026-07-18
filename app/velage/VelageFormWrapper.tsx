"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { getMomentActuel } from "@/lib/evenements-sanitaires";
import { normaliserNutrav, numeroNationalDuLot } from "@/lib/identification";

type Qualificatif = "NORMAL" | "DIFFICILE" | "AVORTEMENT" | "MORT_NEE";
type Veau = { nutrav: string; nunati: string; sexe: "M" | "F" | ""; nom: string; statut: "VIVANT" | "MORT_NE" };
type Capteur = { numero: number; actif: boolean; animalNutrav: string | null };
const vide = (statut: Veau["statut"] = "VIVANT"): Veau => ({ nutrav: "", nunati: "", sexe: "", nom: "", statut });
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
interface Props { initialOpen?: boolean; initialMere?: string; initialDate?: string; initialSexe?: "M" | "F" | ""; capteurs?: Capteur[]; numeroVeauPropose: string; numeroNationalPropose: string; numerosUtilises: string[]; numerosNationauxUtilises: string[]; identification: { mode: string; chiffres: number; zerosGauche: boolean } }

export default function VelageFormWrapper({ initialOpen = false, initialMere = "", initialDate, initialSexe = "", capteurs = [], numeroVeauPropose, numeroNationalPropose, numerosUtilises, numerosNationauxUtilises, identification }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(initialOpen), [mere, setMere] = useState(initialMere);
  const [mereNom, setMereNom] = useState<string | null>(null), [date, setDate] = useState(initialDate || today);
  const [veaux, setVeaux] = useState<Veau[]>([{ ...vide(), sexe: initialSexe, nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]);
  const [qualificatif, setQualificatif] = useState<Qualificatif>("NORMAL"), [precision, setPrecision] = useState("SEULE");
  const [capteur, setCapteur] = useState(""), [pereNom, setPereNom] = useState(""), [pereAuto, setPereAuto] = useState(false);
  const [complications, setComplications] = useState<Set<string>>(new Set()), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numerosPris = new Set(numerosUtilises);

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
  function prochaineIdentification(existants: Veau[]) { if (!numeroVeauPropose) return { nutrav: "", nunati: "" }; let decalage = existants.length; let nutrav = normaliserNutrav(String(Number(numeroVeauPropose) + decalage), identification.chiffres, identification.zerosGauche); while (numerosUtilises.includes(nutrav) || existants.some((v) => v.nutrav === nutrav)) { decalage += 1; nutrav = normaliserNutrav(String(Number(numeroVeauPropose) + decalage), identification.chiffres, identification.zerosGauche); } return { nutrav, nunati: numeroNationalPropose ? numeroNationalDuLot(numeroNationalPropose, decalage) : "" }; }
  function ajouterVeau() { setVeaux((v) => [...v, { ...vide(qualificatif === "MORT_NEE" ? "MORT_NE" : "VIVANT"), ...prochaineIdentification(v) }]); }
  function supprimerVeau(index: number) { setVeaux((v) => v.filter((_, i) => i !== index)); }
  function modifierVeau(index: number, data: Partial<Veau>) { setVeaux((v) => v.map((veau, i) => i === index ? { ...veau, ...data } : veau)); }
  function changerQualificatif(q: Qualificatif) {
    setQualificatif(q); setPrecision(q === "NORMAL" ? "SEULE" : ""); if (q !== "DIFFICILE") setComplications(new Set());
    if (q === "AVORTEMENT") setVeaux([]); else if (q === "MORT_NEE") setVeaux((v) => (v.length ? v : [{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]).map((veau) => ({ ...veau, statut: "MORT_NE" })));
    else setVeaux((v) => {
      const presents = v.length ? v : [{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }];
      return qualificatif === "MORT_NEE" ? presents.map((veau) => ({ ...veau, statut: "VIVANT" as const })) : presents;
    });
  }
  function reset() { setMere(""); setMereNom(null); setDate(today); setVeaux([{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]); setQualificatif("NORMAL"); setPrecision("SEULE"); setCapteur(""); setPereNom(""); setPereAuto(false); setComplications(new Set()); }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const numeros = veaux.map((veau) => veau.nutrav).filter(Boolean);
      const indisponible = numeros.find((numero, index) => numerosPris.has(numero) || numeros.indexOf(numero) !== index);
      if (indisponible) throw new Error(`Le numéro ${indisponible} est déjà utilisé`);
      const nationaux = veaux.map((veau) => veau.nunati).filter(Boolean);
      const nationalIndisponible = nationaux.find((numero, index) => numerosNationauxUtilises.includes(numero) || nationaux.indexOf(numero) !== index);
      if (nationalIndisponible) throw new Error(`Le numéro national ${nationalIndisponible} est déjà utilisé`);
      if (identification.mode === "NATIONAL_OBLIGATOIRE" && veaux.some((veau) => !veau.nunati)) throw new Error("Le numéro national est obligatoire");
      const res = await fetch("/api/velages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vacheNutrav: mere, date, qualificatif, sousType: precision || undefined, capteur: capteur ? Number(capteur) : undefined, pereNom: pereNom || undefined, veaux }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Erreur");
      if (qualificatif === "DIFFICILE") { const types = new Set(complications); if (precision === "CESARIENNE") types.add("Césarienne"); await Promise.all(Array.from(types).map((type) => fetch("/api/evenements/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animalIds: [data.vacheId], date, moment: getMomentActuel(), categorie: "INTERVENTION", type, description: `Suite au vêlage du ${new Date(date).toLocaleDateString("fr-FR")}` }) }).catch(() => {}))); }
      setOpen(false); reset(); setMessage({ text: "Vêlage enregistré !", ok: true });
    } catch (err) { setMessage({ text: String(err).replace("Error: ", ""), ok: false }); } finally { setSaving(false); }
  }

  return <>
    {message && <div className={`px-4 py-3 rounded-xl text-sm border ${message.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>{message.text}</div>}
    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-4 rounded-xl font-medium"><Plus size={20} /> Enregistrer un vêlage</button>
    {open && <div className="fixed inset-0 bg-black/50 z-50 flex items-end"><div className="bg-white rounded-t-2xl w-full p-4 max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-3"><h3 className="text-lg font-bold">Enregistrer un vêlage</h3><button onClick={() => { setOpen(false); reset(); }} className="text-2xl text-gray-400 px-2">×</button></div>
      <form onSubmit={enregistrer} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">NUTRAV de la vache</label><input value={mere} onChange={(e) => changerMere(e.target.value)} required className="w-full border rounded-lg px-3 py-2.5 font-mono" />{mereNom && <p className="text-xs text-emerald-600 mt-1">{mereNom}</p>}</div><div><label className="block text-sm font-medium mb-1">Date du vêlage</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full border rounded-lg px-3 py-2.5" /></div></div>
        <div><label className="block text-sm font-medium mb-1.5">Déroulement</label><div className="grid grid-cols-2 gap-2">{QUALIFICATIFS.map((q) => <button key={q.value} type="button" onClick={() => changerQualificatif(q.value)} className={`py-2.5 rounded-lg text-sm font-semibold border ${qualificatif === q.value ? `${q.color} text-white` : "border-gray-200 bg-white"}`}>{q.label}</button>)}</div></div>
        {!!PRECISIONS[qualificatif].length && <div><label className="block text-xs text-gray-500 mb-1.5">Précision</label><div className="grid grid-cols-2 gap-2">{PRECISIONS[qualificatif].map((p) => <button key={p.value} type="button" onClick={() => setPrecision(p.value)} className={`py-2 rounded-lg text-sm border ${precision === p.value ? "border-gray-500 bg-gray-100 font-semibold" : "border-gray-200"}`}>{p.label}</button>)}</div></div>}
        {qualificatif !== "AVORTEMENT" && <div className="space-y-2.5">
          {veaux.map((veau, i) => {
            const doublon = veau.nutrav !== "" && veaux.some((autre, j) => j !== i && autre.nutrav === veau.nutrav);
            const disponible = veau.nutrav !== "" && !numerosPris.has(veau.nutrav) && !doublon;
            return <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2.5"><div className="flex items-center justify-between"><p className="font-semibold text-gray-800">Veau {i + 1}</p>{i > 0 && <button type="button" onClick={() => supprimerVeau(i)} className="text-xs text-gray-500 px-2 py-1.5">Supprimer</button>}</div>
              <div className="space-y-2"><div><input value={veau.nutrav} onBlur={() => modifierVeau(i, { nutrav: normaliserNutrav(veau.nutrav, identification.chiffres, identification.zerosGauche) })} onChange={(e) => modifierVeau(i, { nutrav: e.target.value.toUpperCase() })} placeholder="Numéro de travail" className={`w-full border rounded-lg px-3 py-2.5 font-mono bg-white ${veau.nutrav && !disponible ? "border-red-400" : ""}`} />{veau.nutrav && <p className={`text-xs mt-1 ${disponible ? "text-emerald-600" : "text-red-600"}`}>{disponible ? "Numéro disponible" : "Numéro déjà utilisé"}</p>}</div>{identification.mode !== "TRAVAIL_SEUL" && <div><input value={veau.nunati} onChange={(e) => modifierVeau(i, { nunati: e.target.value.toUpperCase() })} placeholder="Numéro national" required={identification.mode === "NATIONAL_OBLIGATOIRE"} className={`w-full border rounded-lg px-3 py-2.5 font-mono bg-white ${veau.nunati && numerosNationauxUtilises.includes(veau.nunati) ? "border-red-400" : ""}`} />{!veau.nunati && <p className="mt-1 text-xs text-gray-500">Numéro national à compléter</p>}</div>}<p className="text-[11px] leading-4 text-gray-500">Vérifiez que ces numéros correspondent bien à la boucle utilisée.</p></div>
              <div className="grid grid-cols-2 gap-2">{(["M", "F"] as const).map((s) => <button key={s} type="button" onClick={() => modifierVeau(i, { sexe: s })} className={`py-2 rounded-lg border text-sm ${veau.sexe === s ? (s === "M" ? "bg-sky-500 text-white border-sky-500" : "bg-pink-500 text-white border-pink-500") : "bg-white border-gray-200"}`}>{s === "M" ? "♂ Mâle" : "♀ Femelle"}</button>)}</div>
              <input value={veau.nom} onChange={(e) => modifierVeau(i, { nom: e.target.value })} placeholder="Nom / surnom (optionnel)" className="w-full border rounded-lg px-3 py-2.5 bg-white" />
              {qualificatif === "MORT_NEE" ? <p className="text-xs text-gray-500">Statut mort-né appliqué automatiquement</p> : <button type="button" onClick={() => modifierVeau(i, { statut: veau.statut === "VIVANT" ? "MORT_NE" : "VIVANT" })} className="text-xs text-gray-500 underline underline-offset-2 py-1">{veau.statut === "VIVANT" ? "Signaler ce veau comme mort-né" : "Statut : mort-né — remettre vivant"}</button>}
            </div>;
          })}
          <button type="button" onClick={ajouterVeau} className="text-sm text-purple-700 border border-purple-200 bg-purple-50 rounded-full px-3 py-2">+ Naissance multiple</button>
        </div>}
        {qualificatif === "DIFFICILE" && <div className="bg-red-50 rounded-xl p-3"><label className="block text-sm font-semibold text-red-800 mb-2">Complications sanitaires (optionnel)</label><div className="grid grid-cols-2 gap-2">{COMPLICATIONS.map((c) => <button key={c} type="button" onClick={() => setComplications((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; })} className={`py-2 rounded-lg text-sm border ${complications.has(c) ? "border-red-500 bg-red-100" : "border-gray-200 bg-white"}`}>{c}</button>)}</div></div>}
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Nom du père</label><input value={pereNom} onChange={(e) => { setPereNom(e.target.value); setPereAuto(false); }} className="w-full border rounded-lg px-3 py-2.5" />{pereAuto && <p className="text-xs text-emerald-500 mt-1">Prérempli</p>}</div><div><label className="block text-sm font-medium mb-1">Capteur (optionnel)</label><select value={capteur} onChange={(e) => setCapteur(e.target.value)} className="w-full border rounded-lg px-3 py-2.5"><option value="">Aucun</option>{capteurs.map((c) => <option key={c.numero} value={c.numero}>Capteur {c.numero}{c.actif && c.animalNutrav ? ` — ${c.animalNutrav}` : ""}</option>)}</select></div></div>
        <button disabled={saving} className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le vêlage"}</button>
      </form></div></div>}
  </>;
}
