"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { VOIES_ADMINISTRATION } from "@/lib/medicament-categories";

type Medicament = { id: string; nom: string; voie: string | null; conditionnements: { doses: number }[] };
type MedicamentEtape = { medicamentId: string; voie: string; alternative: boolean; conditionnements: string };
type Etape = { label: string; cycle: string; reference: string; debutValeur: string; debutUnite: string; debutPosition: string; finValeur: string; finUnite: string; finPosition: string; recurrenceMois: string; obligatoire: boolean; medicaments: MedicamentEtape[] };
type Formulaire = { nom: string; label: string; description: string; categories: string[]; ageMinJours: string; ageMaxJours: string; sexeCible: string; stadeReproduction: string; gestante: string; rangVelageMin: string; rangVelageMax: string; lotCible: string; etapes: Etape[] };
type Protocole = any;
type Bloc = "medicament" | "qui" | "quand" | "etapes" | "lots";

const CATEGORIES = [{ code: "VEAU", label: "Veaux", cls: "bg-sky-100 text-sky-800" }, { code: "GENISSE", label: "Génisses", cls: "bg-violet-100 text-violet-800" }, { code: "VACHE", label: "Vaches", cls: "bg-pink-100 text-pink-800" }, { code: "TAUREAU", label: "Taureaux", cls: "bg-amber-100 text-amber-800" }];
const UNITES = ["JOUR", "SEMAINE", "MOIS"];
const PACKS_DEFAUT = "1, 5, 10, 25, 50";
const etapeVide = (label = "Primo"): Etape => ({ label, cycle: "INITIAL", reference: "NAISSANCE", debutValeur: "0", debutUnite: "JOUR", debutPosition: "APRES", finValeur: "30", finUnite: "JOUR", finPosition: "APRES", recurrenceMois: "", obligatoire: true, medicaments: [] });
const formulaireVide = (): Formulaire => ({ nom: "", label: "", description: "", categories: [], ageMinJours: "", ageMaxJours: "", sexeCible: "", stadeReproduction: "", gestante: "", rangVelageMin: "", rangVelageMax: "", lotCible: "", etapes: [etapeVide()] });
const libelleCategorie = (code: string) => CATEGORIES.find((c) => c.code === code)?.label ?? code;

function ResumeBloc({ titre, resume, ouvert, onClick, children }: { titre: string; resume: string; ouvert: boolean; onClick: () => void; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border bg-white"><button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-3 text-left"><span className="flex-1"><b className="block text-sm text-gray-900">{titre}</b><small className="block truncate text-xs text-gray-500">{resume}</small></span><ChevronDown size={17} className={`text-gray-400 transition ${ouvert ? "rotate-180" : ""}`} /></button>{ouvert && <div className="border-t p-3">{children}</div>}</section>;
}

export default function ProtocoleEditor({ protocoles, medicaments }: { protocoles: Protocole[]; medicaments: Medicament[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Formulaire>(formulaireVide());
  const [ouvert, setOuvert] = useState(false), [bloc, setBloc] = useState<Bloc>("medicament"), [editingId, setEditingId] = useState<string | null>(null), [saving, setSaving] = useState(false), [choixCategories, setChoixCategories] = useState(false), [affiner, setAffiner] = useState(false), [personnaliser, setPersonnaliser] = useState(false);

  const setEtape = (index: number, data: Partial<Etape>) => setForm((f) => ({ ...f, etapes: f.etapes.map((e, i) => i === index ? { ...e, ...data } : e) }));
  const ouvrirCreation = () => { setEditingId(null); setForm(formulaireVide()); setBloc("medicament"); setAffiner(false); setPersonnaliser(false); setOuvert(true); };
  function ouvrirEdition(p: Protocole) {
    setEditingId(p.id);
    setForm({ nom: p.nom, label: p.label, description: p.description ?? "", categories: p.categoriesJson ? JSON.parse(p.categoriesJson) : [], ageMinJours: String(p.ageMinJours ?? ""), ageMaxJours: String(p.ageMaxJours ?? ""), sexeCible: p.sexeCible ?? "", stadeReproduction: p.stadeReproduction ?? "", gestante: p.gestante == null ? "" : String(p.gestante), rangVelageMin: String(p.rangVelageMin ?? ""), rangVelageMax: String(p.rangVelageMax ?? ""), lotCible: p.lotCible ?? "", etapes: p.etapes?.length ? p.etapes.map((e: any) => ({ ...e, debutValeur: String(e.debutValeur), finValeur: String(e.finValeur), recurrenceMois: String(e.recurrenceMois ?? ""), medicaments: e.medicaments.map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie ?? "", alternative: m.alternative, conditionnements: medicaments.find((med) => med.id === m.medicamentId)?.conditionnements.map((c) => c.doses).join(", ") || PACKS_DEFAUT })) })) : [etapeVide()] });
    setBloc("medicament"); setOuvert(true);
  }
  async function enregistrer() {
    setSaving(true);
    const body = { ...form, ageMinJours: form.ageMinJours ? Number(form.ageMinJours) : 0, ageMaxJours: form.ageMaxJours ? Number(form.ageMaxJours) : null, gestante: form.gestante === "" ? null : form.gestante === "true", rangVelageMin: form.rangVelageMin ? Number(form.rangVelageMin) : null, rangVelageMax: form.rangVelageMax ? Number(form.rangVelageMax) : null };
    const res = await fetch(editingId ? `/api/protocoles/${editingId}` : "/api/protocoles", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      for (const e of form.etapes) for (const m of e.medicaments) { const doses = m.conditionnements.split(/[,; ]+/).map(Number).filter((n) => n > 0); if (m.medicamentId && doses.length) await fetch(`/api/medicaments/${m.medicamentId}/conditionnements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doses }) }); }
      setOuvert(false); router.refresh();
    }
    setSaving(false);
  }
  async function supprimer(id: string) { if (confirm("Supprimer ce protocole ?")) { await fetch(`/api/protocoles/${id}`, { method: "DELETE" }); router.refresh(); } }
  async function basculer(p: Protocole) { await fetch(`/api/protocoles/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !p.actif }) }); router.refresh(); }
  function dupliquer(p: Protocole) { ouvrirEdition(p); setEditingId(null); setForm((f) => ({ ...f, nom: `${f.nom}_COPIE`, label: `${f.label} — copie` })); }

  const resumeQui = form.categories.length ? form.categories.map(libelleCategorie).join(", ") : "Choisir les animaux";
  const resumeQuand = form.etapes[0]?.reference === "VELAGE" ? `${form.etapes[0].debutValeur} à ${form.etapes[0].finValeur} ${form.etapes[0].finUnite.toLowerCase()} autour du vêlage` : form.ageMinJours || form.ageMaxJours ? `Âge ${form.ageMinJours || "0"} à ${form.ageMaxJours || "∞"} jours` : "Définir la fenêtre";
  const resumeEtapes = form.etapes.map((e) => e.label).join(" → ");
  const medsChoisis = [...new Set(form.etapes.flatMap((e) => e.medicaments.map((m) => m.medicamentId).filter(Boolean)))];
  const premierMedicament = medicaments.find((m) => m.id === form.etapes[0]?.medicaments[0]?.medicamentId);
  function choisirPremierMedicament(id: string) {
    const med = medicaments.find((m) => m.id === id);
    if (!med) return;
    const code = med.nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    setForm((f) => ({ ...f, nom: f.nom || code, label: f.label || med.nom, etapes: f.etapes.map((e, index) => index === 0 ? { ...e, medicaments: [{ medicamentId: med.id, voie: med.voie || "IM", alternative: false, conditionnements: med.conditionnements.map((c) => c.doses).join(", ") || PACKS_DEFAUT }] } : e) }));
    setBloc("qui");
  }

  return <div className="space-y-3">
    <button onClick={ouvrirCreation} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-700 text-sm font-semibold text-white"><Plus size={17} /> Créer un protocole</button>
    {ouvert && <div className="space-y-3 rounded-xl bg-gray-50 p-2 shadow-inner">
      <div className="flex items-center gap-2 px-1"><h3 className="min-w-0 flex-1 truncate text-lg font-bold">{form.label || "Nouveau protocole"}</h3><button onClick={() => setOuvert(false)}><X size={20} /></button></div>

      <ResumeBloc titre="Médicament" resume={premierMedicament?.nom || "À choisir en premier"} ouvert={bloc === "medicament"} onClick={() => setBloc("medicament")}>
        <label className="block text-xs font-medium text-gray-500">Quel médicament utiliser ?</label>
        <select value={premierMedicament?.id || ""} onChange={(e) => choisirPremierMedicament(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-green-300 bg-white px-3 text-base font-semibold"><option value="">Sélectionner dans la pharmacie</option>{medicaments.map((med) => <option key={med.id} value={med.id}>{med.nom}</option>)}</select>
        {premierMedicament && <button type="button" onClick={() => setPersonnaliser(true)} className="mt-2 text-xs text-gray-500">Modifier le nom ou ajouter une note</button>}
        {personnaliser && <div className="mt-2 grid grid-cols-2 gap-2"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Nom du protocole" className="rounded-lg border px-2 py-2 text-sm" /><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Note facultative" className="rounded-lg border px-2 py-2 text-sm" /></div>}
      </ResumeBloc>

      <ResumeBloc titre="Qui ?" resume={resumeQui} ouvert={bloc === "qui"} onClick={() => setBloc("qui")}>
        <div className="relative"><button type="button" onClick={() => setChoixCategories((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-sm"><span>Catégories d’animaux</span><ChevronDown size={15} /></button>{choixCategories && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white p-2 shadow-xl">{CATEGORIES.map((c) => <label key={c.code} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={form.categories.includes(c.code)} onChange={() => setForm((f) => ({ ...f, categories: f.categories.includes(c.code) ? f.categories.filter((x) => x !== c.code) : [...f.categories, c.code] }))} />{c.label}</label>)}</div>}</div>
        <div className="mt-2 flex flex-wrap gap-1">{form.categories.map((code) => { const c = CATEGORIES.find((x) => x.code === code); return <span key={code} className={`rounded-full px-2 py-1 text-xs font-medium ${c?.cls}`}>{c?.label}</span>; })}</div>
        {!affiner && <button type="button" onClick={() => setAffiner(true)} className="mt-2 text-xs font-medium text-green-700">+ Affiner par sexe, âge, gestation ou lot</button>}
        {affiner && <div className="mt-2 grid grid-cols-2 gap-2"><select value={form.sexeCible} onChange={(e) => setForm({ ...form, sexeCible: e.target.value })} className="rounded-lg border px-2 py-2 text-sm"><option value="">Tous les sexes</option><option value="M">Mâles</option><option value="F">Femelles</option></select><select value={form.gestante} onChange={(e) => setForm({ ...form, gestante: e.target.value })} className="rounded-lg border px-2 py-2 text-sm"><option value="">Toutes gestations</option><option value="true">Gestantes</option><option value="false">Non gestantes</option></select><input type="number" value={form.ageMinJours} onChange={(e) => setForm({ ...form, ageMinJours: e.target.value })} placeholder="Âge min. (jours)" className="rounded-lg border px-3 py-2 text-sm" /><input type="number" value={form.ageMaxJours} onChange={(e) => setForm({ ...form, ageMaxJours: e.target.value })} placeholder="Âge max. (jours)" className="rounded-lg border px-3 py-2 text-sm" /><input value={form.lotCible} onChange={(e) => setForm({ ...form, lotCible: e.target.value })} placeholder="Lot facultatif" className="col-span-2 rounded-lg border px-3 py-2 text-sm" /></div>}
      </ResumeBloc>

      <ResumeBloc titre="Quand ?" resume={resumeQuand} ouvert={bloc === "quand"} onClick={() => setBloc("quand")}>
        <p className="mb-2 text-xs text-gray-500">La fenêtre se règle dans chaque étape et suit automatiquement la date de vêlage prévue.</p>
        <div className="flex gap-2">{["NAISSANCE", "VELAGE", "ETAPE_PRECEDENTE"].map((ref) => <button type="button" key={ref} onClick={() => setForm((f) => ({ ...f, etapes: f.etapes.map((e) => ({ ...e, reference: ref })) }))} className={`flex-1 rounded-lg border px-1 py-2 text-xs ${form.etapes.every((e) => e.reference === ref) ? "border-green-500 bg-green-50 text-green-800" : ""}`}>{ref === "NAISSANCE" ? "Âge" : ref === "VELAGE" ? "Vêlage" : "Étape précédente"}</button>)}</div>
      </ResumeBloc>

      <ResumeBloc titre="Étapes" resume={resumeEtapes || "Ajouter les interventions"} ouvert={bloc === "etapes"} onClick={() => setBloc("etapes")}>
        <div className="mb-3 flex flex-wrap items-center gap-y-1 pb-1">{form.etapes.map((e, i) => <div key={i} className="flex items-center"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${e.cycle === "ENTRETIEN" ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>{e.label || `Étape ${i + 1}`}</span>{i < form.etapes.length - 1 && <span className="mx-1 text-gray-300">→</span>}</div>)}</div>
        <div className="space-y-2">{form.etapes.map((e, i) => <div key={i} className="rounded-xl border p-2.5"><div className="flex gap-2"><input value={e.label} onChange={(x) => setEtape(i, { label: x.target.value })} className="min-w-0 flex-1 border-0 font-semibold outline-none" /><select value={e.cycle} onChange={(x) => setEtape(i, { cycle: x.target.value })} className="rounded border text-xs"><option value="INITIAL">Initial</option><option value="ENTRETIEN">Entretien</option></select>{form.etapes.length > 1 && <button onClick={() => setForm((f) => ({ ...f, etapes: f.etapes.filter((_, n) => n !== i) }))}><Trash2 size={15} /></button>}</div>
          <select value={e.reference} onChange={(x) => setEtape(i, { reference: x.target.value })} className="mt-2 w-full rounded-lg border px-2 py-2 text-sm"><option value="NAISSANCE">À partir de l’âge</option><option value="VELAGE">Autour du vêlage</option><option value="ETAPE_PRECEDENTE">Après l’étape précédente</option><option value="DATE_FIXE">Date fixe</option></select>
          <div className="mt-2 grid grid-cols-2 gap-2">{(["debut", "fin"] as const).map((bord) => <div key={bord}><small className="text-gray-500">{bord === "debut" ? "De" : "À"}</small><div className="grid grid-cols-3 gap-1"><input type="number" value={e[`${bord}Valeur`]} onChange={(x) => setEtape(i, { [`${bord}Valeur`]: x.target.value })} className="min-w-0 rounded border px-1 text-sm" /><select value={e[`${bord}Unite`]} onChange={(x) => setEtape(i, { [`${bord}Unite`]: x.target.value })} className="min-w-0 rounded border text-xs">{UNITES.map((u) => <option key={u}>{u.toLowerCase()}</option>)}</select><select value={e[`${bord}Position`]} onChange={(x) => setEtape(i, { [`${bord}Position`]: x.target.value })} className="min-w-0 rounded border text-xs"><option value="AVANT">avant</option><option value="APRES">après</option></select></div></div>)}</div>
          {e.cycle === "ENTRETIEN" && <input type="number" value={e.recurrenceMois} onChange={(x) => setEtape(i, { recurrenceMois: x.target.value })} placeholder="Répéter tous les X mois" className="mt-2 w-full rounded-lg border px-2 py-2 text-sm" />}
          <div className="mt-2 space-y-1">{e.medicaments.map((m, mi) => { const med = medicaments.find((x) => x.id === m.medicamentId); return <div key={mi} className="flex items-center gap-1"><select value={m.medicamentId} onChange={(x) => { const choisi = medicaments.find((v) => v.id === x.target.value); setEtape(i, { medicaments: e.medicaments.map((v, n) => n === mi ? { ...v, medicamentId: x.target.value, voie: choisi?.voie ?? "IM", conditionnements: choisi?.conditionnements.map((c) => c.doses).join(", ") || PACKS_DEFAUT } : v) }); }} className="min-w-0 flex-1 rounded border px-1 py-2 text-xs"><option value="">Médicament</option>{medicaments.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select><select value={m.voie} onChange={(x) => setEtape(i, { medicaments: e.medicaments.map((v, n) => n === mi ? { ...v, voie: x.target.value } : v) })} className="w-16 rounded border py-2 text-xs">{VOIES_ADMINISTRATION.map((v) => <option key={v.code}>{v.code}</option>)}</select><button onClick={() => setEtape(i, { medicaments: e.medicaments.filter((_, n) => n !== mi) })}><X size={14} /></button>{med && <span className="hidden">{med.nom}</span>}</div>; })}<button type="button" onClick={() => setEtape(i, { medicaments: [...e.medicaments, { medicamentId: "", voie: "IM", alternative: false, conditionnements: PACKS_DEFAUT }] })} className="text-xs text-blue-700">+ Médicament</button></div>
          <div className="mt-2 flex flex-wrap gap-1">{e.medicaments.map((m) => medicaments.find((x) => x.id === m.medicamentId)).filter(Boolean).map((m) => <span key={m!.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">{m!.nom}</span>)}</div>
        </div>)}<button type="button" onClick={() => setForm((f) => ({ ...f, etapes: [...f.etapes, etapeVide(f.etapes.some((e) => e.label.includes("Rappel")) ? "Rappel annuel" : "Rappel")] }))} className="w-full rounded-lg border border-dashed py-2 text-sm text-green-700">+ Ajouter un rappel</button></div>
      </ResumeBloc>

      <ResumeBloc titre="Lots / doses" resume={medsChoisis.length ? `${medsChoisis.length} médicament(s) · alertes individuelles et groupées` : "Choisir les conditionnements"} ouvert={bloc === "lots"} onClick={() => setBloc("lots")}>
        <div className="space-y-2">{medsChoisis.length === 0 ? <p className="text-sm text-gray-400">Ajoutez d’abord un médicament dans une étape.</p> : medsChoisis.map((id) => { const med = medicaments.find((m) => m.id === id)!; const occur = form.etapes.flatMap((e) => e.medicaments).find((m) => m.medicamentId === id)!; return <div key={id} className="rounded-lg bg-gray-50 p-2"><b className="text-sm">{med.nom}</b><label className="mt-1 block text-xs text-gray-500">Conditionnements en doses</label><input value={occur.conditionnements || PACKS_DEFAUT} onChange={(x) => setForm((f) => ({ ...f, etapes: f.etapes.map((e) => ({ ...e, medicaments: e.medicaments.map((m) => m.medicamentId === id ? { ...m, conditionnements: x.target.value } : m) })) }))} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></div>; })}<div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">Alertes actives : chaque animal reste signalé. Les animaux dont les fenêtres se chevauchent seront regroupés avec le conditionnement le plus adapté.</div></div>
      </ResumeBloc>

      <button disabled={saving || !form.nom || !form.label} onClick={() => void enregistrer()} className="min-h-12 w-full rounded-xl bg-green-700 font-semibold text-white disabled:opacity-40">{saving ? "Enregistrement…" : "Enregistrer le protocole"}</button>
    </div>}

    {protocoles.map((p) => <div key={p.id} className={`rounded-xl border bg-white p-3 shadow-sm ${p.actif ? "" : "opacity-50"}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><b className="text-sm">{p.label}</b><div className="mt-1 flex flex-wrap gap-1">{(p.categoriesJson ? JSON.parse(p.categoriesJson) : []).map((code: string) => <span key={code} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">{libelleCategorie(code)}</span>)}</div><p className="mt-1 text-xs text-gray-500">{p.etapes?.map((e: any) => e.label).join(" → ") || "Protocole historique"}</p></div><button onClick={() => ouvrirEdition(p)}><Pencil size={15} /></button><button onClick={() => dupliquer(p)}><Copy size={15} /></button><button onClick={() => void supprimer(p.id)}><Trash2 size={15} /></button><button onClick={() => void basculer(p)} className={`h-6 w-10 rounded-full ${p.actif ? "bg-green-500" : "bg-gray-300"}`} /></div></div>)}
  </div>;
}
