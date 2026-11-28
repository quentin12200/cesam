"use client";
import DelaiAttenteInput from "@/app/components/DelaiAttenteInput";
import DoseUnitSelect from "@/app/components/DoseUnitSelect";
import { normaliserUniteDose } from "@/lib/dose-units";


import { X } from "lucide-react";
import { VOIES_ADMINISTRATION } from "@/lib/medicament-categories";
import MedicamentPicker, { type MedicamentOption } from "./MedicamentPicker";
import ExecutantSelect, { type Intervenant } from "./ExecutantSelect";

export interface TraitementDraft {
  key: string;
  medicament: MedicamentOption | null;
  voie: string;
  executant: string;
  dose: string;
  uniteDosage: string;
  motif: string;
  doseUnique: boolean;
  delaiViande?: string;
  delaiLait?: string;
  frequence: string;
  dureeJours: string;
}

interface Props {
  draft: TraitementDraft;
  medicaments: MedicamentOption[];
  intervenants: Intervenant[];
  onChange: (draft: TraitementDraft) => void;
  onRemove: () => void;
  onIntervenantAdded: (i: Intervenant) => void;
  removable: boolean;
  simulation?: boolean;
  createSimulation?: (nom:string)=>MedicamentOption;
}

export default function TraitementDraftRow({ draft, medicaments, intervenants, onChange, onRemove, onIntervenantAdded, removable, simulation = false, createSimulation }: Props) {
  function set<K extends keyof TraitementDraft>(field: K, value: TraitementDraft[K]) {
    onChange({ ...draft, [field]: value });
  }

  function choisirMedicament(m: MedicamentOption | null) {
    if (!m) {
      onChange({ ...draft, medicament: null });
      return;
    }

    const rang: Record<string, number> = { VALIDE: 0, A_VERIFIER: 1, IMPORTE: 2 };
    const preconisation = [...(m.preconisations ?? [])]
      .sort((a, b) => (rang[a.statut] ?? 9) - (rang[b.statut] ?? 9))[0];

    const voieProposee = preconisation?.voie ?? m.voie ?? "";
    const voieNormalisee = VOIES_ADMINISTRATION.find(
      (voie) => voie.code === voieProposee.toUpperCase()
    )?.code ?? voieProposee;

    onChange({
      ...draft,
      medicament: m,
      voie: voieNormalisee,
      delaiViande: m.delaiAttenteViandeJ == null ? "" : String(m.delaiAttenteViandeJ),
      delaiLait: m.delaiAttenteLaitJ == null ? "" : String(m.delaiAttenteLaitJ),
      // Une préconisation par kg ou par 100 kg n'est pas une dose administrée.
      // Ne jamais recopier une valeur de référence dans la dose réelle.
      dose: "",
      uniteDosage: normaliserUniteDose(preconisation?.unite ?? m.uniteDosage),
      motif: preconisation?.indicationMotif ?? draft.motif,
    });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-gray-50/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
          <MedicamentPicker allowQuickCreate={!simulation || !!createSimulation} createSimulation={simulation?createSimulation:undefined} medicaments={medicaments} value={draft.medicament} onChange={choisirMedicament} />
        </div>
        {removable && (
          <button type="button" onClick={onRemove} className="mt-5 shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
            <X size={15} />
          </button>
        )}
      </div>

      {draft.medicament && !draft.medicament.temporaire && (
        <section key={draft.medicament.id} aria-label="Informations de posologie de la pharmacie" className="rounded-lg border border-gray-200 bg-white p-2 text-xs space-y-1">
          <p className="font-semibold">Posologies de référence</p>
          <p className="text-amber-900">À vérifier avant administration. La dose administrée reste à renseigner manuellement.</p>
          {draft.medicament.nom.trim().toUpperCase() === "TOLFINE" && !/tolf[ée]nam/i.test(draft.medicament.dci ?? "") && <p role="alert" className="font-semibold text-red-800">Substance active incohérente ou manquante : vérifier la fiche et la prescription avant utilisation.</p>}
          {draft.medicament.preconisations.length > 0 ? (
            <table className="w-full table-fixed text-left break-words">
              <thead><tr className="text-gray-500"><th className="w-1/4">Voie</th><th className="w-1/2">Dose réf.</th><th>Durée</th></tr></thead>
              <tbody>{draft.medicament.preconisations.map(p => <tr key={p.id} className="border-t align-top">
                <td className="py-1">{p.voie || "—"}<span className="block text-gray-600">{p.statut === "VALIDE" ? "Validée" : p.statut === "A_VERIFIER" ? "À vérifier" : "Non validée"}</span></td>
                <td className="py-1 font-medium">{p.dose != null ? `${p.dose} ${p.unite ?? "unité ?" } ${p.doseBase ?? "(base ?)"}` : "—"}</td>
                <td className="py-1">{p.dureeValeur != null ? `${p.dureeValeur} ${p.dureeUnite || "unité ?"}` : "—"}</td>
              </tr>)}</tbody>
            </table>
          ) : <p>{draft.medicament.dosagePourKg != null ? `${draft.medicament.dosagePourKg} ${draft.medicament.uniteDosage ?? "unité ?"} / kg — à vérifier` : "Aucune posologie enregistrée"}</p>}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-medium text-blue-800">Délais d’attente et détails</summary>
            <div className="space-y-2">
              <p>Fiche : {draft.medicament.voie || "Voie non renseignée"} · Viande : {draft.medicament.delaiAttenteViandeJ===-1?"Interdit":draft.medicament.delaiAttenteViandeJ ?? "?"} j · Lait : {draft.medicament.delaiAttenteLaitJ===-1?"Interdit":draft.medicament.delaiAttenteLaitJ ?? "?"} j</p>
              {draft.medicament.preconisations.map(p => <p key={p.id}>{p.voie || "—"} · {p.indicationMotif || "Indication non renseignée"} · Fréquence : {p.frequence || "Non renseignée"} · Viande : {p.delaiAttenteViandeJ ?? "?"} j · Lait : {p.delaiAttenteLaitTraites ?? "?"} traites</p>)}
              {!simulation && <a className="font-semibold text-blue-800 underline" href={`/pharmacie/${draft.medicament.id}`} target="_blank" rel="noopener noreferrer">Voir la fiche pharmacie</a>}
            </div>
          </details>
        </section>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Voie d&apos;administration *</label>
          <select aria-label="Voie d’administration" value={draft.voie} onChange={(e) => set("voie", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Sélectionner…</option>
            {draft.voie && !VOIES_ADMINISTRATION.some((voie) => voie.code === draft.voie) && (
              <option value={draft.voie}>{draft.voie}</option>
            )}
            {VOIES_ADMINISTRATION.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Exécutant(e) *</label>
          <ExecutantSelect simulation={simulation} intervenants={intervenants} value={draft.executant} onChange={(v) => set("executant", v)} onAdded={onIntervenantAdded} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Dose</label>
          <input type="text" inputMode="decimal" value={draft.dose} onChange={(e) => set("dose", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" aria-label="Dose administrée" placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Unité</label>
          <DoseUnitSelect value={draft.uniteDosage} onChange={v=>set("uniteDosage",v)}/>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Motif</label>
          <input value={draft.motif} onChange={(e) => set("motif", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Mammite" />
        </div>
      </div>
      {draft.medicament?.temporaire && <div className="rounded border p-2 text-xs"><p className="font-semibold">Délais d’attente (à compléter plus tard)</p><div className="grid grid-cols-2 gap-2"><DelaiAttenteInput label="Délai viande" value={draft.delaiViande??""} onChange={v=>set("delaiViande",v)}/><DelaiAttenteInput label="Délai lait" value={draft.delaiLait??""} onChange={v=>set("delaiLait",v)}/></div><p className="text-amber-800">Vide = inconnu, jamais zéro.</p></div>}
      <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 text-sm">
        <input type="checkbox" checked={draft.doseUnique} onChange={(e) => set("doseUnique", e.target.checked)} className="h-4 w-4 accent-green-700" />
        Dose unique
      </label>
      {!draft.doseUnique && <div className="grid grid-cols-2 gap-2.5">
        <div><label className="text-xs text-gray-500 block mb-1">Fréquence</label><input value={draft.frequence} onChange={(e) => set("frequence", e.target.value)} placeholder="ex : matin et soir" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Durée (jours)</label><input type="number" min={2} value={draft.dureeJours} onChange={(e) => set("dureeJours", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
      </div>}
    </div>
  );
}
