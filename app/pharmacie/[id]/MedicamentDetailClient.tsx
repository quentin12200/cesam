"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, Plus, Trash2, Pencil, AlertTriangle, ShieldCheck } from "lucide-react";
import { CATEGORIES_MEDICAMENT } from "@/lib/medicament-categories";

interface MedicamentData {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  voie: string | null;
  prescriptionRequise: boolean;
  actif: boolean;
  commentaire: string | null;
  stockActuel?: number | null;
  stockUnite?: string | null;
  stockSeuilAlert?: number | null;
}

interface PreconisationData {
  id: string;
  indicationMotif: string | null;
  categorieAnimaux: string | null;
  agePoidsConcerne: string | null;
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
  frequence: string | null;
  dureeValeur: number | null;
  dureeUnite: string | null;
  nombreAdministrations: number | null;
  precautions: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitTraites: number | null;
  source: string | null;
  statut: string;
  commentaireVerification: string | null;
}

const STATUT_BADGE: Record<string, { label: string; classe: string }> = {
  A_VERIFIER: { label: "À vérifier", classe: "bg-orange-100 text-orange-700" },
  IMPORTE: { label: "Importé", classe: "bg-gray-100 text-gray-600" },
  VALIDE: { label: "Validé", classe: "bg-green-100 text-green-700" },
  REJETE: { label: "Rejeté", classe: "bg-red-100 text-red-700" },
  ARCHIVE: { label: "Archivé", classe: "bg-gray-100 text-gray-400" },
};

const DOSE_BASE_LABEL: Record<string, string> = {
  ANIMAL: "/ animal",
  KG: "/ kg",
  "100KG": "/ 100 kg",
  QUARTIER: "/ quartier",
};

const emptyPreco = {
  indicationMotif: "", categorieAnimaux: "", agePoidsConcerne: "",
  dose: "", unite: "ml", doseBase: "ANIMAL", voie: "", frequence: "",
  dureeValeur: "", dureeUnite: "JOUR", nombreAdministrations: "",
  precautions: "", delaiAttenteViandeJ: "", delaiAttenteLaitTraites: "",
};

export default function MedicamentDetailClient({ medicament, preconisations }: { medicament: MedicamentData; preconisations: PreconisationData[] }) {
  const router = useRouter();

  const [form, setForm] = useState({
    dci: medicament.dci ?? "",
    forme: medicament.forme ?? "",
    categorie: medicament.categorie,
    voie: medicament.voie ?? "",
    prescriptionRequise: medicament.prescriptionRequise,
    actif: medicament.actif,
    commentaire: medicament.commentaire ?? "",
    stockActuel: medicament.stockActuel != null ? String(medicament.stockActuel) : "",
    stockUnite: medicament.stockUnite ?? "",
    stockSeuilAlert: medicament.stockSeuilAlert != null ? String(medicament.stockSeuilAlert) : "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouvelleForm, setNouvelleForm] = useState(emptyPreco);

  async function saveFiche(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/medicaments/${medicament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dci: form.dci || null,
        forme: form.forme || null,
        categorie: form.categorie,
        voie: form.voie || null,
        prescriptionRequise: form.prescriptionRequise,
        actif: form.actif,
        commentaire: form.commentaire || null,
        stockActuel: form.stockActuel !== "" ? Number(form.stockActuel) : null,
        stockUnite: form.stockUnite || null,
        stockSeuilAlert: form.stockSeuilAlert !== "" ? Number(form.stockSeuilAlert) : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  function commencerEdition(p: PreconisationData) {
    setEditingId(p.id);
    setEditForm({
      indicationMotif: p.indicationMotif ?? "",
      categorieAnimaux: p.categorieAnimaux ?? "",
      agePoidsConcerne: p.agePoidsConcerne ?? "",
      dose: p.dose != null ? String(p.dose) : "",
      unite: p.unite ?? "",
      doseBase: p.doseBase ?? "ANIMAL",
      voie: p.voie ?? "",
      frequence: p.frequence ?? "",
      dureeValeur: p.dureeValeur != null ? String(p.dureeValeur) : "",
      dureeUnite: p.dureeUnite ?? "JOUR",
      nombreAdministrations: p.nombreAdministrations != null ? String(p.nombreAdministrations) : "",
      precautions: p.precautions ?? "",
      delaiAttenteViandeJ: p.delaiAttenteViandeJ != null ? String(p.delaiAttenteViandeJ) : "",
      delaiAttenteLaitTraites: p.delaiAttenteLaitTraites != null ? String(p.delaiAttenteLaitTraites) : "",
    });
  }

  async function enregistrerEdition(id: string) {
    await fetch(`/api/preconisations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    router.refresh();
  }

  async function changerStatut(id: string, statut: string) {
    await fetch(`/api/preconisations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    router.refresh();
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cette préconisation ?")) return;
    await fetch(`/api/preconisations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/preconisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nouvelleForm, medicamentId: medicament.id, statut: "A_VERIFIER", source: "Saisie manuelle" }),
    });
    setNouvelleForm(emptyPreco);
    setAjoutOuvert(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Fiche médicament */}
      <form onSubmit={saveFiche} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm border-b pb-2">Fiche médicament</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Substance active</label>
            <input value={form.dci} onChange={(e) => setForm((f) => ({ ...f, dci: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="À compléter" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Forme / présentation</label>
            <input value={form.forme} onChange={(e) => setForm((f) => ({ ...f, forme: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Solution injectable, oblet..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Catégorie</label>
            <select value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              {CATEGORIES_MEDICAMENT.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Voie usuelle</label>
            <input value={form.voie} onChange={(e) => setForm((f) => ({ ...f, voie: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="IM, SC, VO..." />
          </div>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={form.prescriptionRequise} onChange={(e) => setForm((f) => ({ ...f, prescriptionRequise: e.target.checked }))} />
            Prescription requise
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} />
            Actif
          </label>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Commentaire général</label>
          <textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
            rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Stock actuel</label>
            <input type="number" min={0} step="0.5" value={form.stockActuel} onChange={(e) => setForm((f) => ({ ...f, stockActuel: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Unité</label>
            <input value={form.stockUnite} onChange={(e) => setForm((f) => ({ ...f, stockUnite: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="flacon" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Seuil alerte</label>
            <input type="number" min={0} step="0.5" value={form.stockSeuilAlert} onChange={(e) => setForm((f) => ({ ...f, stockSeuilAlert: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1" />
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saved ? "Enregistré" : saving ? "Enregistrement…" : "Enregistrer la fiche"}
        </button>
      </form>

      {/* Préconisations */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Préconisations ({preconisations.length})</h3>
          <button type="button" onClick={() => setAjoutOuvert((v) => !v)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
            <Plus size={13} /> Ajouter
          </button>
        </div>

        {ajoutOuvert && (
          <form onSubmit={ajouter} className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <input value={nouvelleForm.indicationMotif} onChange={(e) => setNouvelleForm((f) => ({ ...f, indicationMotif: e.target.value }))}
              placeholder="Indication / motif" className="w-full border rounded-lg px-2.5 py-1.5 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input value={nouvelleForm.categorieAnimaux} onChange={(e) => setNouvelleForm((f) => ({ ...f, categorieAnimaux: e.target.value }))}
                placeholder="Catégorie animaux" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input value={nouvelleForm.agePoidsConcerne} onChange={(e) => setNouvelleForm((f) => ({ ...f, agePoidsConcerne: e.target.value }))}
                placeholder="Âge / poids" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input value={nouvelleForm.voie} onChange={(e) => setNouvelleForm((f) => ({ ...f, voie: e.target.value }))}
                placeholder="Voie" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.1" value={nouvelleForm.dose} onChange={(e) => setNouvelleForm((f) => ({ ...f, dose: e.target.value }))}
                placeholder="Dose" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input value={nouvelleForm.unite} onChange={(e) => setNouvelleForm((f) => ({ ...f, unite: e.target.value }))}
                placeholder="Unité (ml...)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <select value={nouvelleForm.doseBase} onChange={(e) => setNouvelleForm((f) => ({ ...f, doseBase: e.target.value }))}
                className="border rounded-lg px-2.5 py-1.5 text-sm bg-white">
                <option value="ANIMAL">par animal</option>
                <option value="KG">par kg</option>
                <option value="100KG">par 100 kg</option>
                <option value="QUARTIER">par quartier</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input value={nouvelleForm.frequence} onChange={(e) => setNouvelleForm((f) => ({ ...f, frequence: e.target.value }))}
                placeholder="Fréquence" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input type="number" value={nouvelleForm.dureeValeur} onChange={(e) => setNouvelleForm((f) => ({ ...f, dureeValeur: e.target.value }))}
                placeholder="Durée" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input type="number" value={nouvelleForm.nombreAdministrations} onChange={(e) => setNouvelleForm((f) => ({ ...f, nombreAdministrations: e.target.value }))}
                placeholder="Nb administrations" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={nouvelleForm.delaiAttenteViandeJ} onChange={(e) => setNouvelleForm((f) => ({ ...f, delaiAttenteViandeJ: e.target.value }))}
                placeholder="Délai attente viande (j)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
              <input type="number" value={nouvelleForm.delaiAttenteLaitTraites} onChange={(e) => setNouvelleForm((f) => ({ ...f, delaiAttenteLaitTraites: e.target.value }))}
                placeholder="Délai attente lait (traites)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
            </div>
            <textarea value={nouvelleForm.precautions} onChange={(e) => setNouvelleForm((f) => ({ ...f, precautions: e.target.value }))}
              placeholder="Précautions particulières" rows={2} className="w-full border rounded-lg px-2.5 py-1.5 text-sm resize-none" />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Enregistrer</button>
              <button type="button" onClick={() => setAjoutOuvert(false)} className="px-3 py-1.5 text-xs text-gray-500 border rounded-lg">Annuler</button>
            </div>
          </form>
        )}

        {preconisations.length === 0 && !ajoutOuvert && (
          <p className="text-sm text-gray-400 text-center py-4">Aucune préconisation enregistrée</p>
        )}

        <div className="space-y-2">
          {preconisations.map((p) => {
            const badge = STATUT_BADGE[p.statut] ?? STATUT_BADGE.IMPORTE;
            const enEdition = editingId === p.id;
            return (
              <div key={p.id} className={`border rounded-lg p-3 text-sm ${p.statut === "A_VERIFIER" ? "border-orange-200 bg-orange-50/40" : "border-gray-100"}`}>
                {enEdition ? (
                  <div className="space-y-2">
                    <input value={editForm.indicationMotif} onChange={(e) => setEditForm((f) => ({ ...f, indicationMotif: e.target.value }))}
                      placeholder="Indication / motif" className="w-full border rounded-lg px-2.5 py-1.5 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={editForm.categorieAnimaux} onChange={(e) => setEditForm((f) => ({ ...f, categorieAnimaux: e.target.value }))}
                        placeholder="Catégorie animaux" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input value={editForm.agePoidsConcerne} onChange={(e) => setEditForm((f) => ({ ...f, agePoidsConcerne: e.target.value }))}
                        placeholder="Âge / poids" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input value={editForm.voie} onChange={(e) => setEditForm((f) => ({ ...f, voie: e.target.value }))}
                        placeholder="Voie" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" step="0.1" value={editForm.dose} onChange={(e) => setEditForm((f) => ({ ...f, dose: e.target.value }))}
                        placeholder="Dose" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input value={editForm.unite} onChange={(e) => setEditForm((f) => ({ ...f, unite: e.target.value }))}
                        placeholder="Unité" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <select value={editForm.doseBase} onChange={(e) => setEditForm((f) => ({ ...f, doseBase: e.target.value }))}
                        className="border rounded-lg px-2.5 py-1.5 text-sm bg-white">
                        <option value="ANIMAL">par animal</option>
                        <option value="KG">par kg</option>
                        <option value="100KG">par 100 kg</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={editForm.frequence} onChange={(e) => setEditForm((f) => ({ ...f, frequence: e.target.value }))}
                        placeholder="Fréquence" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input type="number" value={editForm.dureeValeur} onChange={(e) => setEditForm((f) => ({ ...f, dureeValeur: e.target.value }))}
                        placeholder="Durée" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input type="number" value={editForm.nombreAdministrations} onChange={(e) => setEditForm((f) => ({ ...f, nombreAdministrations: e.target.value }))}
                        placeholder="Nb administrations" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={editForm.delaiAttenteViandeJ} onChange={(e) => setEditForm((f) => ({ ...f, delaiAttenteViandeJ: e.target.value }))}
                        placeholder="Délai attente viande (j)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                      <input type="number" value={editForm.delaiAttenteLaitTraites} onChange={(e) => setEditForm((f) => ({ ...f, delaiAttenteLaitTraites: e.target.value }))}
                        placeholder="Délai attente lait (traites)" className="border rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <textarea value={editForm.precautions} onChange={(e) => setEditForm((f) => ({ ...f, precautions: e.target.value }))}
                      placeholder="Précautions particulières" rows={2} className="w-full border rounded-lg px-2.5 py-1.5 text-sm resize-none" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => enregistrerEdition(p.id)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Enregistrer</button>
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-gray-500 border rounded-lg">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">{p.indicationMotif || "Sans indication précisée"}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.classe}`}>{badge.label}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {p.dose != null && <span>{p.dose} {p.unite} {DOSE_BASE_LABEL[p.doseBase ?? ""] ?? ""}</span>}
                          {p.voie && <span>{p.voie}</span>}
                          {p.frequence && <span>{p.frequence}</span>}
                          {p.dureeValeur != null && <span>{p.dureeValeur} {p.dureeUnite === "48H" ? "× 48h" : "jour(s)"}</span>}
                          {p.categorieAnimaux && <span>{p.categorieAnimaux}</span>}
                          {p.agePoidsConcerne && <span>{p.agePoidsConcerne}</span>}
                        </div>
                        {(p.delaiAttenteViandeJ != null || p.delaiAttenteLaitTraites != null) && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {p.delaiAttenteViandeJ != null && `Délai viande : ${p.delaiAttenteViandeJ}j`}
                            {p.delaiAttenteViandeJ != null && p.delaiAttenteLaitTraites != null ? " · " : ""}
                            {p.delaiAttenteLaitTraites != null && `Délai lait : ${p.delaiAttenteLaitTraites} traites`}
                          </div>
                        )}
                        {p.precautions && <div className="text-xs text-gray-500 mt-0.5">⚠ {p.precautions}</div>}
                        {p.commentaireVerification && (
                          <div className="flex items-start gap-1 text-xs text-orange-700 mt-1">
                            <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {p.commentaireVerification}
                          </div>
                        )}
                        {p.source && <div className="text-xs text-gray-300 mt-1">{p.source}</div>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button type="button" onClick={() => commencerEdition(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => supprimer(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {p.statut !== "VALIDE" && (
                        <button type="button" onClick={() => changerStatut(p.id, "VALIDE")}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
                          <ShieldCheck size={12} /> Valider
                        </button>
                      )}
                      {p.statut !== "REJETE" && (
                        <button type="button" onClick={() => changerStatut(p.id, "REJETE")}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                          Rejeter
                        </button>
                      )}
                      {p.statut !== "ARCHIVE" && (
                        <button type="button" onClick={() => changerStatut(p.id, "ARCHIVE")}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100">
                          Archiver
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
