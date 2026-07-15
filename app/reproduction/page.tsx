"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getBadgeClass, getEtatLabel, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  RefreshCw, CheckCircle,
  Settings, Printer, Users, Stethoscope, Baby,
} from "lucide-react";
import ReproScrollRestorer from "./ReproScrollRestorer";

type EtatGestation = "GRIS" | "JAUNE" | "VERT" | "ROUGE" | "ROSE" | "REPOS";

interface VacheRepro {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  derniereSaillie: string | null;
  gestationEtat: string | null;
  dateVelagePrevue: string | null;
  dernierVelage: string | null;
  saillieId: string | null;
  taureauNom: string | null;
  derniereChaleur: string | null;
  aEchographier: boolean;
  estGenisse: boolean;
  categorie: string | null;
}

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
  traper: string | null;
}

type FilterEtat = "TOUS" | EtatGestation;

const filterLabels: Record<FilterEtat, string> = {
  TOUS: "Tous", GRIS: "Récente", JAUNE: "À écho",
  VERT: "Pleine", ROUGE: "Vide", ROSE: "Imminent", REPOS: "Repos",
};

const DUREE_GESTATION = 285;

// ── Composant recherche vache ──────────────────────────────────────────────
function VacheSearch({
  vaches, selectedId, onSelect, placeholder,
}: {
  vaches: VacheRepro[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = vaches.find((v) => v.id === selectedId);

  const filtered = vaches.filter((v) => {
    const q = query.toLowerCase();
    return v.nutrav.toLowerCase().includes(q) || (v.nobovi ?? "").toLowerCase().includes(q);
  });

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
        <span className="font-mono text-xs bg-green-700 text-white px-2 py-0.5 rounded">{selected.nutrav}</span>
        <span className="font-semibold text-sm text-gray-800 flex-1">{selected.nobovi ?? "Sans nom"}</span>
        <button type="button" onClick={() => onSelect("")} className="text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? "Tapez le numéro ou le nom…"}
        autoFocus
        className="w-full border border-gray-200 rounded-xl p-3 text-sm"
      />
      <div className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        {(query.length > 0 ? filtered : vaches).slice(0, 20).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => { onSelect(v.id); setQuery(""); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 text-left"
          >
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded w-12 text-center">{v.nutrav}</span>
            <span className="text-sm text-gray-700">{v.nobovi ?? "Sans nom"}</span>
          </button>
        ))}
        {query.length > 0 && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-3 text-sm">Aucune vache trouvée</div>
        )}
      </div>
    </div>
  );
}

function VachesSelectionnees({
  vaches, ids, onChange,
}: {
  vaches: VacheRepro[];
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-green-800">
        {ids.length} vache{ids.length > 1 ? "s" : ""} sélectionnée{ids.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const vache = vaches.find((item) => item.id === id);
          return (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-green-200 px-2 py-1 text-xs text-gray-700">
              <span className="font-mono font-semibold">{vache?.nutrav ?? "…"}</span>
              {vache?.nobovi && <span>{vache.nobovi}</span>}
              <button
                type="button"
                aria-label="Retirer cette vache"
                onClick={() => onChange(ids.filter((animalId) => animalId !== id))}
                className="ml-0.5 text-gray-400 hover:text-red-600 text-base leading-none"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers dates JJ/MM/AA ────────────────────────────────────────────────
function parseShortDate(val: string): string {
  // Accepte JJ/MM/AA ou JJ/MM/AAAA → YYYY-MM-DD
  const clean = val.replace(/[^0-9/]/g, "");
  const parts = clean.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  if (!d || !m || !y) return "";
  const year = y.length === 2 ? (parseInt(y) >= 50 ? "19" : "20") + y : y;
  if (d.length !== 2 || m.length !== 2 || year.length !== 4) return "";
  return `${year}-${m}-${d}`;
}

function toShortDate(iso: string): string {
  // YYYY-MM-DD → JJ/MM/AA
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y.slice(2)}`;
}

function DateInput({ value, onChange, required, placeholder, className }: {
  value: string; // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(toShortDate(value));
  // Track the last ISO value we pushed upward so the effect can tell apart
  // an external change (form opening) from a re-render caused by our own onChange.
  const ownValueRef = useRef(value);

  useEffect(() => {
    if (value !== ownValueRef.current) {
      ownValueRef.current = value;
      setRaw(toShortDate(value));
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^0-9/]/g, "");
    // Auto-insert slashes after DD and MM
    if (v.length === 2 && !v.includes("/") && raw.length === 1) v = v + "/";
    if (v.length === 5 && v.split("/").length === 2 && raw.length === 4) v = v + "/";
    setRaw(v);
    const iso = parseShortDate(v);
    if (iso) {
      ownValueRef.current = iso;
      onChange(iso);
    } else if (v === "") {
      ownValueRef.current = "";
      onChange("");
    }
    // For partial input, don't call onChange — keep old parent value to avoid effect reset
  }

  const isValid = raw === "" || !!parseShortDate(raw);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={handleChange}
      required={required}
      placeholder={placeholder ?? "JJ/MM/AA"}
      maxLength={8}
      className={`${className ?? ""} ${!isValid ? "border-red-400" : ""}`}
    />
  );
}

// ── Autocomplete taureau (saisie libre + création auto) ───────────────────
function TaureauSearch({
  taureaux, selectedId, onSelect, onClear,
}: {
  taureaux: Taureau[];
  selectedId: string;
  onSelect: (id: string | null, nom: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = taureaux.find((t) => t.id === selectedId);

  const filtered = query.length > 0
    ? taureaux.filter((t) =>
        (t.nopere ?? t.nupere).toLowerCase().includes(query.toLowerCase()) ||
        t.nupere.toLowerCase().includes(query.toLowerCase())
      )
    : taureaux;

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
        <span className="text-2xl">🐂</span>
        <span className="font-semibold text-sm text-gray-800 flex-1">{selected.nopere ?? selected.nupere}</span>
        <button type="button" onClick={() => { onClear(); setQuery(""); }} className="text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onClear(); }}
        placeholder="Nom du taureau…"
        className="w-full border border-gray-200 rounded-xl p-3 text-sm"
      />
      {query.length > 0 && (
        <div className="mt-1 rounded-xl border border-gray-100 bg-white divide-y divide-gray-50 max-h-48 overflow-y-auto">
          {filtered.map((t) => (
            <button key={t.id} type="button"
              onClick={() => { onSelect(t.id, t.nopere ?? t.nupere); setQuery(""); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 text-left">
              <span className="text-lg">🐂</span>
              <span className="text-sm text-gray-700">{t.nopere ?? t.nupere}</span>
              <span className="text-xs text-gray-400 font-mono ml-auto">{t.nupere}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <button type="button"
              onClick={() => { onSelect(null, query); setQuery(""); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-yellow-50 text-left text-sm text-yellow-700 font-medium">
              <span>➕</span> Créer « {query} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Contenu principal ──────────────────────────────────────────────────────
function ReproductionContent() {
  const [vaches, setVaches] = useState<VacheRepro[]>([]);
  const [taureaux, setTaureaux] = useState<Taureau[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialFiltre = (searchParams.get("filtre") as FilterEtat) ?? "TOUS";
  const [filterEtat, setFilterEtat] = useState<FilterEtat>(initialFiltre);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmVideId, setConfirmVideId] = useState<string | null>(null);
  const [confirmDeleteSaillieId, setConfirmDeleteSaillieId] = useState<string | null>(null);

  // ── Saillie form state ──
  const [showSaillieForm, setShowSaillieForm] = useState(false);
  const [saillieAnimalId, setSaillieAnimalId] = useState("");
  const [saillieAnimalIds, setSaillieAnimalIds] = useState<string[]>([]);
  const [saillieDate, setSaillieDate] = useState("");
  const [saillieType, setSaillieType] = useState<"NATURELLE" | "IA">("NATURELLE");
  const [saillieTaureauId, setSaillieTaureauId] = useState("");
  const [saillieTaureauNom, setSaillieTaureauNom] = useState("");
  const [iaSelectedId, setIaSelectedId] = useState("");
  const [iaNupere, setIaNupere] = useState("");
  const [iaNopere, setIaNopere] = useState("");
  const [iaTraper, setIaTraper] = useState("");
  const [saillieError, setSaillieError] = useState<string | null>(null);

  // ── Chaleur form state ──
  const [showChaleurForm, setShowChaleurForm] = useState(false);
  const [chaleurAnimalId, setChaleurAnimalId] = useState("");
  const [chaleurAnimalIds, setChaleurAnimalIds] = useState<string[]>([]);
  const [chaleurDate, setChaleurDate] = useState("");
  const [chaleurNotes, setChaleurNotes] = useState("");

  // ── Echo form state ──
  const [showEchoForm, setShowEchoForm] = useState(false);
  const [selectedVache, setSelectedVache] = useState<VacheRepro | null>(null);
  const [echoSaillieId, setEchoSaillieId] = useState("");
  const [echoDate, setEchoDate] = useState(new Date().toISOString().split("T")[0]);
  const [echoResultat, setEchoResultat] = useState("PLEINE");
  const [echoJours, setEchoJours] = useState(45);
  const [echoUnite, setEchoUnite] = useState<"jours" | "mois">("jours");

  // ── Groupage form state ──
  const [showGroupageForm, setShowGroupageForm] = useState(false);
  const [groupageIds, setGroupageIds] = useState<string[]>([]);
  const [groupageDate, setGroupageDate] = useState("");
  const [groupageType, setGroupageType] = useState<"NATURELLE" | "IA">("NATURELLE");
  const [groupageTaureauId, setGroupageTaureauId] = useState("");
  const [groupageQuery, setGroupageQuery] = useState("");
  const [groupageError, setGroupageError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const actionRapideTraitee = useRef(false);
  useEffect(() => {
    if (actionRapideTraitee.current) return;
    const action = searchParams.get("action");
    const ids = (searchParams.get("animaux") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0 || (action !== "chaleur" && action !== "saillie")) return;

    actionRapideTraitee.current = true;
    if (action === "chaleur") {
      setChaleurAnimalIds(ids);
      setChaleurAnimalId("");
      setChaleurDate(new Date().toISOString().split("T")[0]);
      setChaleurNotes("");
      setShowChaleurForm(true);
    } else {
      setSaillieAnimalIds(ids);
      setSaillieAnimalId("");
      setSaillieDate(new Date().toISOString().split("T")[0]);
      setSaillieType("NATURELLE");
      setSaillieTaureauId("");
      setSaillieTaureauNom("");
      setIaSelectedId("");
      setIaNupere("");
      setIaNopere("");
      setIaTraper("");
      setSaillieError(null);
      setShowSaillieForm(true);
    }
  }, [searchParams]);

  async function fetchData() {
    setLoading(true);
    try {
      const [repro, taureauData] = await Promise.all([
        fetch("/api/reproduction", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/taureaux", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setVaches(repro.vaches ?? []);
      setTaureaux(taureauData.taureaux ?? []);
    } catch {
      setMessage("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  function openSaillieForm(vache?: VacheRepro) {
    setSaillieAnimalId(vache?.id ?? "");
    setSaillieAnimalIds([]);
    setSaillieDate(today);
    setSaillieType("NATURELLE");
    setSaillieTaureauId("");
    setSaillieTaureauNom("");
    setIaSelectedId(""); setIaNupere(""); setIaNopere(""); setIaTraper("");
    setSaillieError(null);
    setShowSaillieForm(true);
  }

  function openChaleurForm(vache?: VacheRepro) {
    setChaleurAnimalId(vache?.id ?? "");
    setChaleurAnimalIds([]);
    setChaleurDate(today);
    setChaleurNotes("");
    setShowChaleurForm(true);
  }

  function openEchoForm(vache: VacheRepro) {
    setSelectedVache(vache);
    setEchoSaillieId(vache.saillieId!);
    setEchoResultat("PLEINE");
    setEchoDate(today);
    const j = vache.derniereSaillie
      ? differenceInDays(new Date(), new Date(vache.derniereSaillie)) : 45;
    setEchoJours(Math.max(1, j));
    setEchoUnite("jours");
    setShowEchoForm(true);
  }

  function openGroupageForm() {
    setGroupageIds([]);
    setGroupageDate(today);
    setGroupageType("NATURELLE");
    setGroupageTaureauId("");
    setGroupageQuery("");
    setGroupageError(null);
    setShowGroupageForm(true);
  }

  // ── Computed ──
  const vachesAvecEtat = vaches.map((v) => ({
    ...v,
    etat: getEtatGestation(
      v.derniereSaillie ? new Date(v.derniereSaillie) : null,
      v.gestationEtat,
      v.dateVelagePrevue ? new Date(v.dateVelagePrevue) : null,
      v.dernierVelage ? new Date(v.dernierVelage) : null,
      v.aEchographier
    ) as EtatGestation,
  }));

  const filtered = filterEtat === "TOUS" ? vachesAvecEtat : vachesAvecEtat.filter((v) => v.etat === filterEtat);
  const counts: Record<EtatGestation, number> = { GRIS: 0, JAUNE: 0, VERT: 0, ROUGE: 0, ROSE: 0, REPOS: 0 };
  vachesAvecEtat.forEach((v) => counts[v.etat]++);

  const farmBulls = taureaux.filter((t) => t.present);
  const iaBulls = taureaux.filter((t) => !t.present);
  const now = new Date();

  const echoJoursEffectifs = echoUnite === "mois" ? Math.round(echoJours * 30.5) : echoJours;
  const echoDateConception = echoResultat === "PLEINE" && echoJoursEffectifs > 0
    ? addDays(new Date(echoDate), -echoJoursEffectifs) : null;
  const echoDateVelagePrevue = echoResultat === "PLEINE" && echoJoursEffectifs > 0
    ? addDays(new Date(echoDate), DUREE_GESTATION - echoJoursEffectifs) : null;
  const joursAvantVelage = echoDateVelagePrevue
    ? differenceInDays(echoDateVelagePrevue, new Date(echoDate)) : null;

  // ── Handlers ──
  async function handleSaillieSubmit(e: React.FormEvent) {
    e.preventDefault();
    const animalIds = saillieAnimalIds.length > 0 ? saillieAnimalIds : saillieAnimalId ? [saillieAnimalId] : [];
    if (animalIds.length === 0) { setSaillieError("Sélectionnez une vache"); return; }
    if (!saillieDate) { setSaillieError("Choisissez une date"); return; }
    setSaving(true);
    try {
  …6923 tokens truncated… "" : nom); }}
                    onClear={() => { setSaillieTaureauId(""); setSaillieTaureauNom(""); }}
                  />
                  {saillieTaureauNom && !saillieTaureauId && (
                    <p className="text-xs text-yellow-700 mt-1 bg-yellow-50 px-3 py-1.5 rounded-lg">
                      Le taureau « {saillieTaureauNom} » sera créé automatiquement.
                    </p>
                  )}
                </div>
              )}

              {saillieType === "IA" && (
                <div className="space-y-3">
                  {iaBulls.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IA déjà utilisés</label>
                      <div className="flex flex-wrap gap-2">
                        {iaBulls.map((t) => (
                          <button key={t.id} type="button"
                            onClick={() => { setIaSelectedId(iaSelectedId === t.id ? "" : t.id); setIaNupere(""); }}
                            className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${iaSelectedId === t.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 bg-white"}`}>
                            {t.nopere ?? t.nupere}{t.traper && <span className="ml-1 opacity-70">· {t.traper}</span>}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 my-3">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs text-gray-400">ou nouveau</span>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>
                    </div>
                  )}
                  <div className={`space-y-2 ${iaSelectedId ? "opacity-30 pointer-events-none" : ""}`}>
                    <input type="text" value={iaNupere} onChange={(e) => { setIaNupere(e.target.value); setIaSelectedId(""); }}
                      placeholder="Référence / N° paillette" className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={iaNopere} onChange={(e) => { setIaNopere(e.target.value); setIaSelectedId(""); }}
                        placeholder="Nom taureau" className="border border-gray-200 rounded-xl p-3 text-sm" />
                      <input type="text" value={iaTraper} onChange={(e) => { setIaTraper(e.target.value); setIaSelectedId(""); }}
                        placeholder="Race / Origine" className="border border-gray-200 rounded-xl p-3 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {saillieError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{saillieError}</div>
              )}
              <button type="submit" disabled={saving || (saillieAnimalIds.length === 0 && !saillieAnimalId) || !saillieDate}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? "Enregistrement…" : saillieAnimalIds.length > 1 ? `Enregistrer pour ${saillieAnimalIds.length} vaches` : "Enregistrer la saillie"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Groupage ──────────────────────────────────────────────── */}
      {showGroupageForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">👥 Groupage — saillie multiple</h3>
              <button onClick={() => setShowGroupageForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleGroupageSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <DateInput value={groupageDate} onChange={setGroupageDate} required
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setGroupageType("NATURELLE")}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${groupageType === "NATURELLE" ? "bg-green-700 text-white border-green-700" : "border-gray-200 text-gray-600"}`}>
                    🐄 Naturelle
                  </button>
                  <button type="button" onClick={() => setGroupageType("IA")}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${groupageType === "IA" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600"}`}>
                    💉 IA
                  </button>
                </div>
              </div>
              {groupageType === "NATURELLE" && farmBulls.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taureau <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {farmBulls.map((t) => (
                      <button key={t.id} type="button"
                        onClick={() => setGroupageTaureauId(groupageTaureauId === t.id ? "" : t.id)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 text-xs transition-all ${groupageTaureauId === t.id ? "bg-green-700 text-white border-green-700" : "border-gray-200 text-gray-700"}`}>
                        <span className="text-xl mb-0.5">🐂</span>
                        <span className="font-bold">{t.nopere ?? t.nupere}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {groupageType === "IA" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dose / Taureau IA <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <select
                    value={groupageTaureauId}
                    onChange={(e) => setGroupageTaureauId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white"
                  >
                    <option value="">— Non précisé —</option>
                    {taureaux.map((t) => (
                      <option key={t.id} value={t.id}>{t.nopere ?? t.nupere}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vaches sélectionnées <span className="text-green-700 font-bold">({groupageIds.length})</span>
                </label>
                <input type="text" value={groupageQuery} onChange={(e) => setGroupageQuery(e.target.value)}
                  placeholder="Filtrer par numéro ou nom…"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-2" />
                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {groupageFiltered.slice(0, 30).map((v) => {
                    const sel = groupageIds.includes(v.id);
                    return (
                      <button key={v.id} type="button"
                        onClick={() => setGroupageIds((ids) => sel ? ids.filter((x) => x !== v.id) : [...ids, v.id])}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${sel ? "bg-green-50" : "hover:bg-gray-50"}`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${sel ? "bg-green-700 border-green-700" : "border-gray-300"}`}>
                          {sel && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v.nutrav}</span>
                        <span className="text-sm text-gray-700">{v.nobovi ?? "Sans nom"}</span>
                      </button>
                    );
                  })}
                </div>
                {groupageIds.length > 0 && (
                  <button type="button" onClick={() => setGroupageIds([])}
                    className="text-xs text-red-400 mt-1 hover:text-red-600">Tout désélectionner</button>
                )}
              </div>
              {groupageError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{groupageError}</div>
              )}
              <button type="submit" disabled={saving || groupageIds.length === 0 || !groupageDate}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? "Enregistrement…" : `Enregistrer pour ${groupageIds.length} vache${groupageIds.length > 1 ? "s" : ""}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Échographie ───────────────────────────────────────────── */}
      {showEchoForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Résultat échographie
                {selectedVache && <span className="text-sm font-normal text-gray-500 ml-2">— {selectedVache.nutrav} {selectedVache.nobovi ?? ""}</span>}
              </h3>
              <button onClick={() => setShowEchoForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleEchoSubmit} className="space-y-4">
              {!selectedVache && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vache</label>
                  <select value={echoSaillieId}
                    onChange={(e) => { setEchoSaillieId(e.target.value); const v = vachesAvecEtat.find((x) => x.saillieId === e.target.value); if (v) openEchoForm(v); }}
                    required className="w-full border border-gray-200 rounded-xl p-3 text-sm">
                    <option value="">Sélectionner…</option>
                    {vachesAvecEtat.filter((v) => v.saillieId && (v.etat === "JAUNE" || v.etat === "GRIS")).map((v) => (
                      <option key={v.saillieId} value={v.saillieId!}>{v.nutrav} – {v.nobovi ?? "Sans nom"} (saillie {formatDate(new Date(v.derniereSaillie!))})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de l&apos;écho</label>
                <DateInput value={echoDate} onChange={setEchoDate} required
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
                {selectedVache?.derniereSaillie && (() => {
                  const j = differenceInDays(new Date(echoDate), new Date(selectedVache.derniereSaillie));
                  return j > 0 ? <p className="text-xs text-gray-400 mt-1">Saillie le {formatDate(new Date(selectedVache.derniereSaillie))} · {j} j avant l&apos;écho</p> : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEchoResultat("PLEINE")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 ${echoResultat === "PLEINE" ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-700"}`}>
                    ✓ Pleine
                  </button>
                  <button type="button" onClick={() => setEchoResultat("VIDE")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 ${echoResultat === "VIDE" ? "bg-red-500 text-white border-red-500" : "border-gray-200 text-gray-700"}`}>
                    ✗ Vide
                  </button>
                </div>
              </div>
              {echoResultat === "PLEINE" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jours de gestation à la date de l&apos;écho</label>
                    <div className="flex gap-2">
                      <input type="number" value={echoJours} onChange={(e) => setEchoJours(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1} max={echoUnite === "mois" ? 9 : 284} required
                        className="flex-1 border border-gray-200 rounded-xl p-3 text-sm text-center font-bold text-lg" />
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                        {(["jours", "mois"] as const).map((u) => (
                          <button key={u} type="button" onClick={() => setEchoUnite(u)}
                            className={`px-3 py-2 text-sm font-medium ${echoUnite === u ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    {echoUnite === "mois" && <p className="text-xs text-gray-400 mt-1">≈ {echoJoursEffectifs} jours</p>}
                  </div>
                  {echoDateConception && echoDateVelagePrevue && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Début de gestation</span>
                        <span className="font-semibold text-gray-800">{echoDateConception.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                      <div className="h-px bg-gray-200" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Terme prévu (285j)</span>
                        <span className="font-bold text-green-700">{echoDateVelagePrevue.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                      {joursAvantVelage !== null && (
                        <div className={`text-center text-xs font-semibold py-1 px-2 rounded-lg ${joursAvantVelage <= 30 ? "bg-pink-100 text-pink-700" : joursAvantVelage <= 60 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                          dans {joursAvantVelage} jours
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button type="submit" disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? "Enregistrement…" : "Enregistrer résultat"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReproductionPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">Chargement…</div>}>
      <ReproductionContent />
    </Suspense>
  );
}
