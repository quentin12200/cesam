"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { getMomentActuel } from "@/lib/evenements-sanitaires";
import { normaliserNutrav } from "@/lib/identification";
import { useRouter } from "next/navigation";
import { useOriginNavigation } from "@/lib/use-origin-navigation";

type Qualificatif = "NORMAL" | "DIFFICILE" | "AVORTEMENT" | "MORT_NEE";
type Veau = { detailId?: string | null; animalId?: string | null; nutrav: string; nunati: string; sexe: "M" | "F" | ""; nom: string; statut: "VIVANT" | "MORT_NE" };
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
export interface EditableVelage {
  id: string;
  vacheNutrav: string;
  vacheNom: string | null;
  date: string;
  moment: string | null;
  qualificatif: Qualificatif;
  sousType: string | null;
  capteur: number | null;
  pereNom: string | null;
  notes: string | null;
  veaux: Veau[];
}

interface Props { initialOpen?: boolean; initialMere?: string; initialDate?: string; initialSexe?: "M" | "F" | ""; initialVelage?: EditableVelage | null; capteurs?: Capteur[]; numeroVeauPropose: string; numeroNationalPropose: string; identificationsProposees: Array<{ nutrav: string; nunati: string }>; numerosUtilises: string[]; numerosNationauxUtilises: string[]; lotBoucles: { quantite: number; restantes: number } | null }

export default function VelageFormWrapper({ initialOpen = false, initialMere = "", initialDate, initialSexe = "", initialVelage = null, capteurs = [], numeroVeauPropose, numeroNationalPropose, identificationsProposees, numerosUtilises, numerosNationauxUtilises, lotBoucles }: Props) {
  const router = useRouter();
  const { closeToOrigin, completeToOrigin } = useOriginNavigation();
  const today = new Date().toISOString().split("T")[0];
  const editing = initialVelage !== null;
  const [open, setOpen] = useState(initialOpen || editing), [mere, setMere] = useState(initialVelage?.vacheNutrav ?? initialMere);
  const [mereNom, setMereNom] = useState<string | null>(initialVelage?.vacheNom ?? null), [date, setDate] = useState(initialVelage?.date.slice(0, 10) ?? initialDate ?? today);
  const [veaux, setVeaux] = useState<Veau[]>(initialVelage?.veaux ?? [{ ...vide(), sexe: initialSexe, nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]);
  const [qualificatif, setQualificatif] = useState<Qualificatif>(initialVelage?.qualificatif ?? "NORMAL"), [precision, setPrecision] = useState(initialVelage?.sousType ?? "SEULE");
  const [capteur, setCapteur] = useState(initialVelage?.capteur ? String(initialVelage.capteur) : ""), [pereNom, setPereNom] = useState(initialVelage?.pereNom ?? ""), [pereAuto, setPereAuto] = useState(false);
  const [moment, setMoment] = useState(initialVelage?.moment ?? ""), [notes, setNotes] = useState(initialVelage?.notes ?? "");
  const [complications, setComplications] = useState<Set<string>>(new Set()), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numerosInitiaux = new Set(initialVelage?.veaux.map((veau) => veau.nutrav).filter(Boolean) ?? []);
  const nationauxInitiaux = new Set(initialVelage?.veaux.map((veau) => veau.nunati).filter(Boolean) ?? []);
  const numerosPris = new Set(numerosUtilises.filter((numero) => !numerosInitiaux.has(numero)));

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
  useEffect(() => { if (!editing && initialOpen && initialMere) void chargerMere(initialMere); }, [chargerMere, editing, initialMere, initialOpen]);

  function changerMere(value: string) { const n = value.toUpperCase(); setMere(n); setMereNom(null); if (debounce.current) clearTimeout(debounce.current); debounce.current = setTimeout(() => void chargerMere(n), 500); }
  function prochaineIdentification(existants: Veau[]) { return identificationsProposees.find((numero) => !numerosUtilises.includes(numero.nutrav) && !numerosNationauxUtilises.includes(numero.nunati) && !existants.some((veau) => veau.nutrav === numero.nutrav || veau.nunati === numero.nunati)) ?? { nutrav: "", nunati: "" }; }
  function ajouterVeau() { setVeaux((v) => [...v, { ...vide(qualificatif === "MORT_NEE" ? "MORT_NE" : "VIVANT"), ...prochaineIdentification(v) }]); }
  function supprimerVeau(index: number) {
    if (veaux[index]?.animalId) {
      setMessage({ text: "Un veau vivant déjà lié ne peut pas être retiré ici.", ok: false });
      return;
    }
    setVeaux((v) => v.filter((_, i) => i !== index));
  }
  function modifierVeau(index: number, data: Partial<Veau>) { setVeaux((v) => v.map((veau, i) => i === index ? { ...veau, ...data } : veau)); }
  function changerQualificatif(q: Qualificatif) {
    if (editing && (q === "AVORTEMENT" || q === "MORT_NEE") && veaux.some((veau) => veau.animalId)) {
      setMessage({ text: "Une fiche veau vivante existante ne peut pas être retirée ou transformée en mort-né.", ok: false });
      return;
    }
    setQualificatif(q); setPrecision(q === "NORMAL" ? "SEULE" : ""); if (q !== "DIFFICILE") setComplications(new Set());
    if (q === "AVORTEMENT") setVeaux([]); else if (q === "MORT_NEE") setVeaux((v) => (v.length ? v : [{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]).map((veau) => ({ ...veau, statut: "MORT_NE" })));
    else setVeaux((v) => {
      const presents = v.length ? v : [{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }];
      return qualificatif === "MORT_NEE" ? presents.map((veau) => ({ ...veau, statut: "VIVANT" as const })) : presents;
    });
  }
  function reset() { setMere(""); setMereNom(null); setDate(today); setVeaux([{ ...vide(), nutrav: numeroVeauPropose, nunati: numeroNationalPropose }]); setQualificatif("NORMAL"); setPrecision("SEULE"); setCapteur(""); setPereNom(""); setPereAuto(false); setMoment(""); setNotes(""); setComplications(new Set()); }
  function fermer() {
    if (editing) {
      closeToOrigin("/velage");
      return;
    }
    setOpen(false); reset(); closeToOrigin();
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const numeros = veaux.map((veau) => veau.nutrav).filter(Boolean);
      const indisponible = numeros.find((numero, index) => numerosPris.has(numero) || numeros.indexOf(numero) !== index);
      if (indisponible) throw new Error(`Le numéro ${indisponible} est déjà utilisé`);
      const nationaux = veaux.map((veau) => veau.nunati).filter(Boolean);
      const nationalIndisponible = nationaux.find((numero, index) => (numerosNationauxUtilises.includes(numero) && !nationauxInitiaux.has(numero)) || nationaux.indexOf(numero) !== index);
      if (nationalIndisponible) throw new Error(`Le numéro national ${nationalIndisponible} est déjà utilisé`);
      if (veaux.some((veau) => veau.nutrav && !/^\d{4}$/.test(veau.nutrav))) throw new Error("Le numéro de travail doit contenir 4 chiffres");
      if (veaux.some((veau) => veau.nunati && veau.nutrav !== veau.nunati.slice(-4))) throw new Error("Le numéro de travail doit correspondre aux 4 derniers chiffres du numéro national");
      const endpoint = editing ? `/api/velages/${initialVelage.id}` : "/api/velages";
      const res = await fetch(endpoint, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vacheNutrav: mere, date, moment: moment || undefined, qualificatif, sousType: precision || undefined, capteur: capteur ? Number(capteur) : undefined, pereNom: pereNom || undefined, notes: notes || undefined, veaux }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Erreur");
      if (!editing && qualificatif === "DIFFICILE") { const types = new Set(complications); if (precision === "CESARIENNE") types.add("Césarienne"); await Promise.all(Array.from(types).map((type) => fetch("/api/evenements/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animalIds: [data.vacheId], date, moment: getMomentActuel(), categorie: "INTERVENTION", type, description: `Suite au vêlage du ${new Date(date).toLocaleDateString("fr-FR")}` }) }).catch(() => {}))); }
      setOpen(false); reset();
      const success = editing ? "Vêlage modifié" : "Vêlage enregistré !";
      if (completeToOrigin(success, editing ? "/velage" : undefined)) return;
      setMessage({ text: success, ok: true });
      router.refresh();
    } catch (err) { setMessage({ text: String(err).replace("Error: ", ""), ok: false }); } finally { setSaving(false); }
  }

  const changementsSensibles: string[] = [];
  if (initialVelage) {
    if (date !== initialVelage.date.slice(0, 10)) changementsSensibles.push(`la date : ${initialVelage.date.slice(0, 10)} → ${date}`);
    if (veaux.length > initialVelage.veaux.length) changementsSensibles.push(`l’ajout de ${veaux.length - initialVelage.veaux.length} veau(x)`);
    if (veaux.length < initialVelage.veaux.length) changementsSensibles.push(`le retrait de ${initialVelage.veaux.length - veaux.length} veau(x)`);
    for (const initial of initialVelage.veaux) {
      const current = veaux.find((veau) => veau.detailId === initial.detailId && veau.animalId === initial.animalId);
      if (!current) continue;
      if (current.statut !== initial.statut) changementsSensibles.push(`le statut du veau ${initial.nutrav || initial.nom || "sans numéro"}`);
      if (current.nutrav !== initial.nutrav || current.nunati !== initial.nunati) changementsSensibles.push(`le numéro du veau ${initial.nutrav || initial.nom || "sans numéro"}`);
    }
  }

  return <>
    {message && <div className={`px-4 py-3 rounded-xl text-sm border ${message.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>{message.text}</div>}
    {!editing && <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-4 rounded-xl font-medium"><Plus size={20} /> Enregistrer un vêlage</button>}
    {open && <div className="fixed inset-0 bg-black/50 z-50 flex items-end"><div className="bg-white rounded-t-2xl w-full p-4 max-h-[92vh] overflow-y-auto"><div className="flex justify-between mb-3"><h3 className="text-lg font-bold">{editing ? "Modifier le vêlage" : "Enregistrer un vêlage"}</h3><button onClick={fermer} className="text-2xl text-gray-400 px-2">×</button></div>
      <form onSubmit={enregistrer} className="space-y-3">
        {lotBoucles && lotBoucles.restantes <= Math.ceil(lotBoucles.quantite * 0.25) && <div className={`rounded-lg border px-3 py-2 text-sm ${lotBoucles.restantes === 0 ? "border-red-300 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{lotBoucles.restantes === 0 ? "Lot de boucles épuisé. Ajoutez un nouveau lot dans les Paramètres." : "Le lot de boucles arrive bientôt à sa fin. Pensez à commander un nouveau lot."}</div>}
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">NUTRAV de la vache</label><input value={mere} onChange={(e) => changerMere(e.target.value)} readOnly={editing} required className={`w-full border rounded-lg px-3 py-2.5 font-mono ${editing ? "bg-gray-100 text-gray-700" : ""}`} />{mereNom && <p className="text-xs text-emerald-600 mt-1">{mereNom}</p>}</div><div><label className="block text-sm font-medium mb-1">Date du vêlage</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full border rounded-lg px-3 py-2.5" /></div></div>
        {editing && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">La mère ne peut pas encore être modifiée sur un vêlage déjà enregistré, afin d’éviter des incohérences dans la reproduction, le tarissement et les événements associés.</p>}
        <div><label className="block text-sm font-medium mb-1.5">Déroulement</label><div className="grid grid-cols-2 gap-2">{QUALIFICATIFS.map((q) => <button key={q.value} type="button" onClick={() => changerQualificatif(q.value)} className={`py-2.5 rounded-lg text-sm font-semibold border ${qualificatif === q.value ? `${q.color} text-white` : "border-gray-200 bg-white"}`}>{q.label}</button>)}</div></div>
        {!!PRECISIONS[qualificatif].length && <div><label className="block text-xs text-gray-500 mb-1.5">Précision</label><div className="grid grid-cols-2 gap-2">{PRECISIONS[qualificatif].map((p) => <button key={p.value} type="button" onClick={() => setPrecision(p.value)} className={`py-2 rounded-lg text-sm border ${precision === p.value ? "border-gray-500 bg-gray-100 font-semibold" : "border-gray-200"}`}>{p.label}</button>)}</div></div>}
        {qualificatif !== "AVORTEMENT" && <div className="space-y-2.5">
          {veaux.map((veau, i) => {
            const doublon = veau.nutrav !== "" && veaux.some((autre, j) => j !== i && autre.nutrav === veau.nutrav);
            const disponible = veau.nutrav !== "" && !numerosPris.has(veau.nutrav) && !doublon;
            return <div key={veau.detailId ?? veau.animalId ?? i} className="border border-gray-200 rounded-xl p-3 space-y-2.5"><div className="flex items-center justify-between"><p className="font-semibold text-gray-800">Veau {i + 1}</p>{(i > 0 || (editing && veaux.length > 1)) && !veau.animalId && <button type="button" onClick={() => supprimerVeau(i)} className="text-xs text-gray-500 px-2 py-1.5">Supprimer</button>}{veau.animalId && <span className="text-[11px] text-gray-500">Fiche existante conservée</span>}</div>
              <div className="space-y-2"><div><input value={veau.nutrav} onBlur={() => modifierVeau(i, { nutrav: normaliserNutrav(veau.nutrav, 4, true) })} onChange={(e) => modifierVeau(i, { nutrav: e.target.value.replace(/\D/g, "").slice(-4) })} placeholder="Numéro de travail" inputMode="numeric" className={`w-full border rounded-lg px-3 py-2.5 font-mono bg-white ${veau.nutrav && !disponible ? "border-red-400" : ""}`} />{veau.nutrav && <p className={`text-xs mt-1 ${disponible ? "text-emerald-600" : "text-red-600"}`}>{disponible ? "Numéro disponible" : "Numéro déjà utilisé"}</p>}</div><div><input value={veau.nunati} onChange={(e) => modifierVeau(i, { nunati: e.target.value.toUpperCase() })} placeholder="Numéro national" className={`w-full border rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 ${veau.nunati && numerosNationauxUtilises.includes(veau.nunati) && !nationauxInitiaux.has(veau.nunati) ? "border-red-400" : ""}`} />{!veau.nunati && <p className="mt-1 text-xs text-gray-500">Numéro national à compléter</p>}</div><p className="text-[11px] leading-4 text-gray-500">Vérifiez que ces numéros correspondent bien à la boucle utilisée.</p></div>
              <div className="grid grid-cols-2 gap-2">{(["M", "F"] as const).map((s) => <button key={s} type="button" onClick={() => modifierVeau(i, { sexe: s })} className={`py-2 rounded-lg border text-sm ${veau.sexe === s ? (s === "M" ? "bg-sky-500 text-white border-sky-500" : "bg-pink-500 text-white border-pink-500") : "bg-white border-gray-200"}`}>{s === "M" ? "♂ Mâle" : "♀ Femelle"}</button>)}</div>
              <input value={veau.nom} onChange={(e) => modifierVeau(i, { nom: e.target.value })} placeholder="Nom / surnom (optionnel)" className="w-full border rounded-lg px-3 py-2.5 bg-white" />
              {veau.animalId ? <p className="text-xs text-gray-500">Statut vivant conservé : ce veau possède déjà une fiche Animal.</p> : qualificatif === "MORT_NEE" ? <p className="text-xs text-gray-500">Statut mort-né appliqué automatiquement</p> : <button type="button" onClick={() => modifierVeau(i, { statut: veau.statut === "VIVANT" ? "MORT_NE" : "VIVANT" })} className="text-xs text-gray-500 underline underline-offset-2 py-1">{veau.statut === "VIVANT" ? "Signaler ce veau comme mort-né" : "Statut : mort-né — remettre vivant"}</button>}
            </div>;
          })}
          <button type="button" onClick={ajouterVeau} className="text-sm text-purple-700 border border-purple-200 bg-purple-50 rounded-full px-3 py-2">+ Naissance multiple</button>
        </div>}
        {qualificatif === "DIFFICILE" && !editing && <div className="bg-red-50 rounded-xl p-3"><label className="block text-sm font-semibold text-red-800 mb-2">Complications sanitaires (optionnel)</label><div className="grid grid-cols-2 gap-2">{COMPLICATIONS.map((c) => <button key={c} type="button" onClick={() => setComplications((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; })} className={`py-2 rounded-lg text-sm border ${complications.has(c) ? "border-red-500 bg-red-100" : "border-gray-200 bg-white"}`}>{c}</button>)}</div></div>}
        {editing && qualificatif === "DIFFICILE" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Les anciens événements sanitaires liés aux complications ne sont ni déplacés, ni supprimés, ni recréés pendant cette modification. Cela évite tout doublon.</p>}
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Nom du père</label><input value={pereNom} onChange={(e) => { setPereNom(e.target.value); setPereAuto(false); }} className="w-full border rounded-lg px-3 py-2.5" />{pereAuto && <p className="text-xs text-emerald-500 mt-1">Prérempli</p>}</div><div><label className="block text-sm font-medium mb-1">Capteur (optionnel)</label><select value={capteur} onChange={(e) => setCapteur(e.target.value)} className="w-full border rounded-lg px-3 py-2.5"><option value="">Aucun</option>{capteurs.map((c) => <option key={c.numero} value={c.numero}>Capteur {c.numero}{c.actif && c.animalNutrav ? ` — ${c.animalNutrav}` : ""}</option>)}</select></div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Moment (optionnel)</label><select value={moment} onChange={(e) => setMoment(e.target.value)} className="w-full border rounded-lg px-3 py-2.5"><option value="">Non renseigné</option><option value="Matin">Matin</option><option value="Soir">Soir</option></select></div><div><label className="block text-sm font-medium mb-1">Remarques</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2.5" /></div></div>
        {editing && changementsSensibles.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-sm font-semibold text-amber-950">Vous allez modifier :</p><ul className="mt-1 list-disc pl-5 text-xs leading-5 text-amber-900">{[...new Set(changementsSensibles)].map((changement) => <li key={changement}>{changement}</li>)}</ul></div>}
        <button disabled={saving} className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{saving ? "Enregistrement…" : editing ? "Enregistrer la modification" : "Enregistrer le vêlage"}</button>
      </form></div></div>}
  </>;
}
