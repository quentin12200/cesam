"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, Plus, AlertTriangle, ShieldCheck } from "lucide-react";
import { CATEGORIES_MEDICAMENT } from "@/lib/medicament-categories";
import PreconisationFields, { VoieSelect } from "./PreconisationFields";
import RecordActionsMenu from "@/components/RecordActionsMenu";

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

const DUREE_UNITE_LABEL: Record<string, string> = {
  JOUR: "jour(s)",
  HEURE: "heure(s)",
  "48H": "période(s) de 48 h",
  SEMAINE: "semaine(s)",
  MOIS: "mois",
};

const emptyPreco = {
  indicationMotif: "", categorieAnimaux: "", agePoidsConcerne: "",
  dose: "", unite: "ml", doseBase: "ANIMAL", voie: "", frequence: "DOSE_UNIQUE",
  dureeValeur: "", dureeUnite: "JOUR", nombreAdministrations: "",
  precautions: "", delaiAttenteViandeJ: "", delaiAttenteLaitTraites: "",
};

export default function MedicamentDetailClient({ medicament, preconisations, ficheSeulement = false }: { medicament: MedicamentData; preconisations: PreconisationData[]; ficheSeulement?: boolean }) {
  const router = useRouter();

  const [form, setForm] = useState({
    nom: medicament.nom,
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
  const [nouvelleForm, setNouvelleForm] = useState({
    ...emptyPreco,
    voie: medicament.voie ?? "",
  });

  async function saveFiche(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/medicaments/${medicament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: form.nom,
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
    setNouvelleForm({ ...emptyPreco, voie: medicament.voie ?? "" });
    setAjoutOuvert(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Fiche médicament */}
      <form onSubmit={saveFiche} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm border-b pb-2">Fiche médicament</h3>
        <div><label className="text-xs text-gray-500 block mb-1">Nom</label><input required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm font-semibold" /></div>
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
          <VoieSelect
            label="Voie usuelle"
            value={form.voie}
            onChange={(value) => setForm((f) => ({ ...f, voie: value }))}
          />
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
            <PreconisationFields
              form={nouvelleForm}
              onChange={(field, value) =>
                setNouvelleForm((current) => ({ ...current, [field]: value }))
              }
            />
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
                    <PreconisationFields
                      key={p.id}
                      form={editForm}
                      onChange={(field, value) =>
                        setEditForm((current) => ({ ...current, [field]: value }))
                      }
                    />
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
                          {p.dureeValeur != null && (
                            <span>{p.dureeValeur} {DUREE_UNITE_LABEL[p.dureeUnite ?? "JOUR"] ?? p.dureeUnite}</span>
                          )}
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
                      <RecordActionsMenu
                        onEdit={() => commencerEdition(p)}
                        actions={[
                          ...(p.statut !== "ARCHIVE" ? [{ label: "Archiver", onSelect: () => changerStatut(p.id, "ARCHIVE") }] : []),
                          {
                            label: "Supprimer la saisie",
                            tone: "danger" as const,
                            confirmMessage: "Supprimer cette préconisation ?",
                            onSelect: () => supprimer(p.id),
                          },
                        ]}
                      />
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
