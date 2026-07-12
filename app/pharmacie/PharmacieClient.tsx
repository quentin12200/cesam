"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pill, FlaskConical, History, CheckCircle2, AlertTriangle, Clock, Pencil, Save, X, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TraitementItem {
  id: string;
  animalId: string;
  animalNutrav: string;
  animalNom: string | null;
  medicamentNom: string;
  medicamentId: string | null;
  dateDebut: string;
  dateFin: string;
  dureeJours: number;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  motif: string | null;
  veterinaire: string | null;
  statut: string;
  notes: string | null;
  delaiAttenteViandeJ: number | null;
  dateFinAttente: string | null;
  enCours: boolean;
  enAttente: boolean;
  joursRestantsAttente: number | null;
}

export interface MedicamentItem {
  id: string;
  nom: string;
  dci: string | null;
  categorie: string;
  voie: string | null;
  dosagePourKg: number | null;
  uniteDosage: string | null;
  delaiAttenteViandeJ: number | null;
  prescriptionRequise: boolean;
  actif: boolean;
  stockActuel: number | null;
  stockUnite: string | null;
  stockSeuilAlert: number | null;
  recentTraitements: { date: string; animalNutrav: string; motif: string | null }[];
}

interface Props {
  traitements: TraitementItem[];
  medicaments: MedicamentItem[];
}

// ── Category labels ────────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  ANTIBIOTIQUE: "Antibiotique",
  ANTIDOULEUR: "Antidouleur / AINS",
  ANTIPARASITAIRE: "Antiparasitaire",
  CORTICOIDE: "Corticoïde",
  VITAMINES: "Vitamines / Oligo",
  AUTRE: "Autre",
};

const CAT_COLORS: Record<string, string> = {
  ANTIBIOTIQUE: "bg-red-100 text-red-700",
  ANTIDOULEUR: "bg-orange-100 text-orange-700",
  ANTIPARASITAIRE: "bg-green-100 text-green-700",
  CORTICOIDE: "bg-purple-100 text-purple-700",
  VITAMINES: "bg-blue-100 text-blue-700",
  AUTRE: "bg-gray-100 text-gray-600",
};

// ── Add Médicament form ────────────────────────────────────────────────────────

function AddMedicamentForm({ onDone }: { onDone: () => void }) {
  const [nom, setNom] = useState("");
  const [dci, setDci] = useState("");
  const [categorie, setCategorie] = useState("ANTIBIOTIQUE");
  const [voie, setVoie] = useState("");
  const [delai, setDelai] = useState("");
  const [delaiLait, setDelaiLait] = useState("");
  const [rx, setRx] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);
    await fetch("/api/medicaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom,
        dci: dci || null,
        categorie,
        voie: voie || null,
        delaiAttenteViandeJ: delai !== "" ? Number(delai) : null,
        delaiAttenteLaitJ: delaiLait !== "" ? Number(delaiLait) : null,
        prescriptionRequise: rx,
      }),
    });
    setSaving(false);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Nom commercial *</label>
          <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm uppercase" placeholder="ex: METACAM" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">DCI (générique)</label>
          <input value={dci} onChange={(e) => setDci(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Méloxicam" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Voie admin.</label>
          <input value={voie} onChange={(e) => setVoie(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="IM, SC, PO..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Attente viande (j)</label>
          <input type="number" min={0} value={delai} onChange={(e) => setDelai(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0 = aucun" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Attente lait (j)</label>
          <input type="number" min={0} value={delaiLait} onChange={(e) => setDelaiLait(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0 = aucun" />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={rx} onChange={(e) => setRx(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm">Prescription requise</span>
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !nom.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save size={14} /> Ajouter
        </button>
        <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Médicament card ────────────────────────────────────────────────────────────

function StockBadge({ stock, seuil, unite }: { stock: number | null; seuil: number | null; unite: string | null }) {
  if (stock == null) return null;
  const low = seuil != null && stock <= seuil;
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
      low ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"
    }`}>
      {stock} {unite ?? "u"}
      {low && " ⚠"}
    </span>
  );
}

function MedicamentCard({ med }: { med: MedicamentItem }) {
  const [editing, setEditing] = useState(false);
  const [delai, setDelai] = useState(String(med.delaiAttenteViandeJ ?? ""));
  const [voie, setVoie] = useState(med.voie ?? "");
  const [stock, setStock] = useState(med.stockActuel != null ? String(med.stockActuel) : "");
  const [stockUnite, setStockUnite] = useState(med.stockUnite ?? "");
  const [stockSeuil, setStockSeuil] = useState(med.stockSeuilAlert != null ? String(med.stockSeuilAlert) : "");
  const [saving, setSaving] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const router = useRouter();

  async function toggleActif() {
    await fetch(`/api/medicaments/${med.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !med.actif }),
    });
    router.refresh();
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/medicaments/${med.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voie: voie || null,
        delaiAttenteViandeJ: delai !== "" ? Number(delai) : null,
        stockActuel: stock !== "" ? Number(stock) : null,
        stockUnite: stockUnite || null,
        stockSeuilAlert: stockSeuil !== "" ? Number(stockSeuil) : null,
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function adjustStock(delta: number) {
    const current = med.stockActuel ?? 0;
    const next = Math.max(0, current + delta);
    await fetch(`/api/medicaments/${med.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockActuel: next }),
    });
    router.refresh();
  }

  return (
    <div className={`bg-white rounded-xl shadow border p-3 ${!med.actif ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-gray-800">{med.nom}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_COLORS[med.categorie] ?? "bg-gray-100"}`}>
              {CAT_LABELS[med.categorie] ?? med.categorie}
            </span>
            {med.prescriptionRequise && (
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">Rx</span>
            )}
            <StockBadge stock={med.stockActuel} seuil={med.stockSeuilAlert} unite={med.stockUnite} />
          </div>
          {med.dci && <div className="text-xs text-gray-500 mt-0.5">{med.dci}</div>}
          <Link href={`/pharmacie/${med.id}`} className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
            Fiche & préconisations →
          </Link>

          {editing ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div>
                  <label className="text-xs text-gray-400">Voie</label>
                  <input value={voie} onChange={(e) => setVoie(e.target.value)}
                    className="block w-24 border rounded px-2 py-1 text-xs mt-0.5" placeholder="IM/SC..." />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Délai viande (j)</label>
                  <input type="number" min={0} value={delai} onChange={(e) => setDelai(e.target.value)}
                    className="block w-20 border rounded px-2 py-1 text-xs mt-0.5" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div>
                  <label className="text-xs text-gray-400">Stock actuel</label>
                  <input type="number" min={0} step="0.5" value={stock} onChange={(e) => setStock(e.target.value)}
                    className="block w-20 border rounded px-2 py-1 text-xs mt-0.5" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Unité</label>
                  <input value={stockUnite} onChange={(e) => setStockUnite(e.target.value)}
                    className="block w-20 border rounded px-2 py-1 text-xs mt-0.5" placeholder="flacon" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Seuil alerte</label>
                  <input type="number" min={0} step="0.5" value={stockSeuil} onChange={(e) => setStockSeuil(e.target.value)}
                    className="block w-20 border rounded px-2 py-1 text-xs mt-0.5" placeholder="1" />
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={save} disabled={saving}
                  className="p-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                  <Save size={12} />
                </button>
                <button onClick={() => setEditing(false)} className="p-1.5 border rounded text-gray-500 hover:bg-gray-50">
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                {med.voie && <span>{med.voie}</span>}
                {med.delaiAttenteViandeJ != null && (
                  <span className={med.delaiAttenteViandeJ > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                    Attente viande : {med.delaiAttenteViandeJ === 0 ? "aucune" : `${med.delaiAttenteViandeJ}j`}
                  </span>
                )}
              </div>

              {/* Stock quick-adjust */}
              {med.stockActuel != null && (
                <div className="flex items-center gap-1 mt-1.5">
                  <button onClick={() => adjustStock(-1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200 text-sm font-bold">−</button>
                  <span className="text-xs text-gray-600 min-w-[40px] text-center">{med.stockActuel} {med.stockUnite ?? "u"}</span>
                  <button onClick={() => adjustStock(1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200 text-sm font-bold">+</button>
                </div>
              )}

              {/* Dernières prescriptions */}
              {med.recentTraitements.length > 0 && (
                <div className="mt-2">
                  <button onClick={() => setShowRecent((v) => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    {showRecent ? "▲" : "▼"} {med.recentTraitements.length} prescription{med.recentTraitements.length > 1 ? "s" : ""} récente{med.recentTraitements.length > 1 ? "s" : ""}
                  </button>
                  {showRecent && (
                    <div className="mt-1 space-y-0.5">
                      {med.recentTraitements.map((t, i) => (
                        <div key={i} className="text-xs text-gray-500 flex gap-2">
                          <span className="font-mono bg-gray-100 px-1 rounded">{t.animalNutrav}</span>
                          <span>{new Date(t.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                          {t.motif && <span className="text-gray-400 truncate">{t.motif}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-700 border border-transparent hover:border-gray-200 rounded">
              <Pencil size={13} />
            </button>
          )}
          <button onClick={toggleActif}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${med.actif ? "bg-green-500" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${med.actif ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── En cours tab ──────────────────────────────────────────────────────────────

function EnCoursTab({ traitements, onRefresh }: { traitements: TraitementItem[]; onRefresh: () => void }) {
  const actifs = traitements.filter((t) => t.enCours || t.enAttente);
  const router = useRouter();

  async function terminer(id: string) {
    await fetch(`/api/traitements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "TERMINE" }),
    });
    onRefresh();
    router.refresh();
  }

  if (actifs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircle2 size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun traitement en cours</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actifs.map((t) => (
        <div key={t.id} className={`bg-white rounded-xl shadow border p-4 border-l-4 ${
          t.enCours ? "border-blue-400" : t.joursRestantsAttente && t.joursRestantsAttente > 0 ? "border-orange-400" : "border-gray-200"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/troupeau/${t.animalNutrav}`}
                  className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 transition-colors">
                  {t.animalNutrav}
                </Link>
                {t.animalNom && <span className="text-sm font-semibold text-gray-800">{t.animalNom}</span>}
              </div>

              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{t.medicamentNom}</span>
                {t.voie && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.voie}</span>}
                {t.dose != null && (
                  <span className="text-xs text-gray-500">{t.dose} {t.uniteDosage ?? "ml"}</span>
                )}
              </div>

              {t.motif && <div className="text-xs text-gray-500 mt-1">Motif : {t.motif}</div>}

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {t.enCours && (
                  <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                    <Clock size={11} /> Traitement jusqu&apos;au {formatDate(new Date(t.dateFin))}
                  </span>
                )}
                {t.enAttente && t.joursRestantsAttente != null && t.joursRestantsAttente > 0 && (
                  <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium">
                    <AlertTriangle size={11} /> Attente viande : {t.joursRestantsAttente}j restants
                  </span>
                )}
              </div>

              {t.veterinaire && <div className="text-xs text-gray-400 mt-1">Vét. : {t.veterinaire}</div>}
            </div>

            {t.statut === "EN_COURS" && (
              <button onClick={() => terminer(t.id)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                <CheckCircle2 size={13} /> Terminer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Historique tab ────────────────────────────────────────────────────────────

function HistoriqueTab({ traitements }: { traitements: TraitementItem[] }) {
  const termines = traitements.filter((t) => !t.enCours && !t.enAttente);

  if (termines.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <History size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun traitement terminé</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {termines.map((t) => (
        <div key={t.id} className="bg-white rounded-xl shadow border p-3 opacity-75">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/troupeau/${t.animalNutrav}`}
              className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100">
              {t.animalNutrav}
            </Link>
            {t.animalNom && <span className="text-sm font-medium text-gray-700">{t.animalNom}</span>}
            <span className="text-sm text-gray-600">{t.medicamentNom}</span>
            <span className="ml-auto text-xs text-gray-400">{formatDate(new Date(t.dateDebut))}</span>
          </div>
          {t.motif && <div className="text-xs text-gray-400 mt-0.5">{t.motif}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PharmacieClient({ traitements, medicaments }: Props) {
  const [onglet, setOnglet] = useState<"encours" | "medicaments" | "historique">("encours");
  const [showAddMed, setShowAddMed] = useState(false);
  const [, forceRefresh] = useState(0);

  const enCoursCount = traitements.filter((t) => t.enCours || t.enAttente).length;
  const attenteCount = traitements.filter((t) => t.enAttente && t.joursRestantsAttente && t.joursRestantsAttente > 0).length;

  const tabs = [
    { id: "encours" as const, label: "En cours", count: enCoursCount, alert: attenteCount > 0 },
    { id: "medicaments" as const, label: "Médicaments", count: medicaments.filter((m) => m.actif).length },
    { id: "historique" as const, label: "Historique", count: traitements.filter((t) => !t.enCours && !t.enAttente).length },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setOnglet(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === tab.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab.alert ? "bg-orange-500 text-white" :
                onglet === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {onglet === "encours" && (
        <EnCoursTab traitements={traitements} onRefresh={() => forceRefresh((n) => n + 1)} />
      )}

      {onglet === "medicaments" && (
        <div className="space-y-3">
          {!showAddMed && (
            <button onClick={() => setShowAddMed(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
              <Plus size={16} /> Ajouter un médicament
            </button>
          )}
          {showAddMed && <AddMedicamentForm onDone={() => setShowAddMed(false)} />}

          {Object.entries(CAT_LABELS).map(([cat]) => {
            const meds = medicaments.filter((m) => m.categorie === cat);
            if (meds.length === 0) return null;
            return (
              <div key={cat}>
                <div className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${CAT_COLORS[cat] ?? "bg-gray-100"}`}>
                  {CAT_LABELS[cat]}
                </div>
                <div className="space-y-2">
                  {meds.map((m) => <MedicamentCard key={m.id} med={m} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onglet === "historique" && <HistoriqueTab traitements={traitements} />}
    </div>
  );
}
