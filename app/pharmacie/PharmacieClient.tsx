"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, ChevronDown, Search, Plus, Save, X, Stethoscope } from "lucide-react";
import { normalizeSearch } from "@/lib/fuzzy-search";
import { CATEGORIES_MEDICAMENT, getCategorieMedicament, formatVoie, formatDoseBase, formatStatutConsultation } from "@/lib/medicament-categories";
import OrdonnancesClient, { type OrdonnanceItem } from "@/app/ordonnances/OrdonnancesClient";
import SaisiePrixClient from "./SaisiePrixClient";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PreconisationSummary {
  id: string;
  indicationMotif: string | null;
  categorieAnimaux: string | null;
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
  statut: string;
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
  delaiAttenteLaitJ: number | null;
  prescriptionRequise: boolean;
  actif: boolean;
  favori: boolean;
  actions: string | null;
  stockActuel: number | null;
  stockUnite: string | null;
  stockSeuilAlert: number | null;
  conditionnements: Array<{
    id: string;
    quantiteFlacon: number | null;
    uniteFlacon: string | null;
    doses: number;
    prixFlaconEur: number | null;
  }>;
  preconisations: PreconisationSummary[];
}

interface Props {
  medicaments: MedicamentItem[];
  ordonnances: OrdonnanceItem[];
}

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
          <label className="text-xs text-gray-500 block mb-1">Substance active (DCI)</label>
          <input value={dci} onChange={(e) => setDci(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Méloxicam" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Catégorie principale</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            {CATEGORIES_MEDICAMENT.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
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
          <span className="text-sm">Ordonnance requise</span>
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

// ── Ligne annuaire (compacte, extensible) ──────────────────────────────────────

function MedicamentRow({ med, expanded, onToggle }: { med: MedicamentItem; expanded: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [favBusy, setFavBusy] = useState(false);
  const cat = getCategorieMedicament(med.categorie);
  const actionsList = med.actions ? med.actions.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const voieTexte = formatVoie(med.voie);
  const stockBas = med.stockSeuilAlert != null && med.stockActuel != null && med.stockActuel <= med.stockSeuilAlert;

  async function toggleFavori(e: React.MouseEvent) {
    e.stopPropagation();
    setFavBusy(true);
    await fetch(`/api/medicaments/${med.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favori: !med.favori }),
    });
    setFavBusy(false);
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
    <div className={`bg-white rounded-xl shadow border overflow-hidden ${!med.actif ? "opacity-50" : ""}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <button type="button" onClick={toggleFavori} disabled={favBusy} className="shrink-0" aria-label="Favori">
          <Star size={17} className={med.favori ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
        </button>
        <span className="font-mono text-sm font-bold text-gray-800 shrink-0">{med.nom}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: cat.bg, color: cat.text }}>
          {cat.label}
        </span>
        {med.dci && <span className="text-xs text-gray-500 truncate min-w-0 flex-1 hidden sm:inline">{med.dci}</span>}
        {med.prescriptionRequise && (
          <span className="text-xs text-red-600 font-medium shrink-0 hidden md:inline">Ordonnance requise</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 shrink-0">
          Voir plus <ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/60 space-y-3 text-sm">
          {med.dci && <p className="text-xs text-gray-500 sm:hidden">{med.dci}</p>}
          {med.prescriptionRequise && <p className="text-xs text-red-600 font-medium md:hidden">Ordonnance requise</p>}

          {actionsList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Actions</div>
              <div className="flex flex-wrap gap-1.5">
                {actionsList.map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}

          {med.preconisations.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Principales préconisations</div>
              <div className="space-y-1">
                {med.preconisations.map((p) => (
                  <div key={p.id} className="text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-gray-700">{p.indicationMotif || "Sans indication précisée"}</span>
                    {p.dose != null && <span>{p.dose} {p.unite} {formatDoseBase(p.doseBase)}</span>}
                    {p.voie && <span>{formatVoie(p.voie)}</span>}
                    <span className="text-gray-400">({formatStatutConsultation(p.statut)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {voieTexte && <span><span className="text-gray-400">Voie :</span> {voieTexte}</span>}
            {med.delaiAttenteViandeJ != null && (
              <span className={med.delaiAttenteViandeJ > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                Délai viande : {med.delaiAttenteViandeJ === 0 ? "aucun" : `${med.delaiAttenteViandeJ} j`}
              </span>
            )}
            {med.delaiAttenteLaitJ != null && (
              <span className={med.delaiAttenteLaitJ > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                Délai lait : {med.delaiAttenteLaitJ === 0 ? "aucun" : `${med.delaiAttenteLaitJ} j`}
              </span>
            )}
          </div>

          {med.stockActuel != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Stock :</span>
              <button type="button" onClick={() => adjustStock(-1)}
                className="w-6 h-6 flex items-center justify-center bg-white border rounded text-gray-600 hover:bg-gray-100 text-sm font-bold">−</button>
              <span className={`text-xs min-w-[48px] text-center ${stockBas ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                {med.stockActuel} {med.stockUnite ?? "u"}{stockBas && " ⚠"}
              </span>
              <button type="button" onClick={() => adjustStock(1)}
                className="w-6 h-6 flex items-center justify-center bg-white border rounded text-gray-600 hover:bg-gray-100 text-sm font-bold">+</button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/pharmacie/${med.id}`}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white">
              Consulter la fiche complète
            </Link>
            <Link href={`/sanitaire/nouvel-evenement?medicament=${med.id}`}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Stethoscope size={12} /> Créer un événement sanitaire avec ce médicament
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Répertoire ──────────────────────────────────────────────────────────────────

type Mode = "alpha" | "favoris" | "categorie";

function Repertoire({ medicaments, onSaisiePrix }: { medicaments: MedicamentItem[]; onSaisiePrix: () => void }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("alpha");
  const [catFilter, setCatFilter] = useState("");
  const [showAddMed, setShowAddMed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search.trim());
    return medicaments.filter((m) => {
      if (catFilter && m.categorie !== catFilter) return false;
      if (mode === "favoris" && !m.favori) return false;
      if (!q) return true;
      return normalizeSearch(`${m.nom} ${m.dci ?? ""}`).includes(q);
    });
  }, [medicaments, search, mode, catFilter]);

  return (
    <div className="space-y-3">
      {/* Barre supérieure */}
      <div className="bg-white rounded-xl shadow p-3 space-y-2.5">
        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
          <Search size={15} className="text-gray-400 mr-2 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un médicament, une substance active…" className="w-full text-sm outline-none" />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs">
            {([["alpha", "A → Z"], ["favoris", "★ Favoris"], ["categorie", "Catégories"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${mode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>

          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-600">
            <option value="">Toutes catégories</option>
            {CATEGORIES_MEDICAMENT.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>

          <button type="button" onClick={() => setShowAddMed((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
            <Plus size={13} /> Ajouter un médicament
          </button>
          <button type="button" onClick={onSaisiePrix}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            Saisie des prix
          </button>
        </div>
      </div>

      {showAddMed && <AddMedicamentForm onDone={() => setShowAddMed(false)} />}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">Aucun médicament ne correspond à la recherche</div>
      )}

      {mode === "categorie" ? (
        <div className="space-y-4">
          {CATEGORIES_MEDICAMENT.filter((c) => !catFilter || c.code === catFilter).map((c) => {
            const meds = filtered.filter((m) => m.categorie === c.code).sort((a, b) => a.nom.localeCompare(b.nom));
            if (meds.length === 0) return null;
            return (
              <div key={c.code}>
                <div className="text-xs font-semibold px-2 py-1 rounded mb-2 inline-block" style={{ background: c.bg, color: c.text }}>
                  {c.label}
                </div>
                <div className="space-y-2">
                  {meds.map((m) => (
                    <MedicamentRow key={m.id} med={m} expanded={expandedId === m.id}
                      onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {[...filtered].sort((a, b) => a.nom.localeCompare(b.nom)).map((m) => (
            <MedicamentRow key={m.id} med={m} expanded={expandedId === m.id}
              onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PharmacieClient({ medicaments, ordonnances }: Props) {
  const [vue, setVue] = useState<"medicaments" | "ordonnances">("medicaments");
  const [saisiePrix, setSaisiePrix] = useState(false);
  const ordonnancesActives = ordonnances.filter((o) => o.statut !== "ARCHIVE").length;

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {([
          ["medicaments", "Médicaments", medicaments.filter((m) => m.actif).length],
          ["ordonnances", "Ordonnances", ordonnancesActives],
        ] as const).map(([id, label, count]) => (
          <button key={id} onClick={() => setVue(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              vue === id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${vue === id ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {vue === "medicaments"
        ? saisiePrix
          ? <SaisiePrixClient medicaments={medicaments} onRetour={() => setSaisiePrix(false)} />
          : <Repertoire medicaments={medicaments} onSaisiePrix={() => setSaisiePrix(true)} />
        : <OrdonnancesClient ordonnances={ordonnances} />}
    </div>
  );
}
