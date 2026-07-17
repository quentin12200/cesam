"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getBadgeClass, getEtatLabel, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  RefreshCw, CheckCircle,
  Settings, Printer, Users, Baby, MoreHorizontal, Eye,
} from "lucide-react";
import ReproductionStatusEditor from "@/components/ReproductionStatusEditor";
import type { EtatGestation as EtatGestationPartage } from "@/lib/utils";
import ReproScrollRestorer from "./ReproScrollRestorer";
import { ACTION_VISUALS } from "@/components/action-visuals";
import TroupeauTabs from "@/components/TroupeauTabs";
import {
  VOICE_REPRODUCTION_STORAGE_KEY,
  type VoiceReproductionDraft,
} from "@/lib/voice-actions";

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
  reproductionEtatManuel: EtatGestation | null;
  reproductionEtatPrecedent: EtatGestation | null;
  reproductionEtatModifieAt: string | null;
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

const reproductionCardStates: Record<EtatGestation, { label: string; border: string; text: string }> = {
  VERT: { label: "Pleine", border: "border-green-500", text: "text-green-700" },
  ROUGE: { label: "Vide", border: "border-red-400", text: "text-red-700" },
  JAUNE: { label: "À écho", border: "border-amber-400", text: "text-amber-700" },
  REPOS: { label: "Repos post-vêlage", border: "border-sky-400", text: "text-sky-700" },
  ROSE: { label: "Imminent", border: "border-pink-400", text: "text-pink-700" },
  GRIS: { label: "Saillie récente", border: "border-slate-300", text: "text-slate-600" },
};

const DUREE_GESTATION = 285;
const ChaleurIcon = ACTION_VISUALS.chaleur.icon;
const SaillieIcon = ACTION_VISUALS.saillieIA.icon;

function formatDateCompacte(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

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
  const [menuVacheId, setMenuVacheId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);

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

  useEffect(() => {
    function closeRowMenu(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest("[data-repro-menu]")) setMenuVacheId(null);
    }

    document.addEventListener("mousedown", closeRowMenu);
    return () => document.removeEventListener("mousedown", closeRowMenu);
  }, []);

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

  const brouillonVocalTraite = useRef(false);
  useEffect(() => {
    if (brouillonVocalTraite.current || loading || searchParams.get("brouillonVocal") !== "1") return;
    const brut = sessionStorage.getItem(VOICE_REPRODUCTION_STORAGE_KEY);
    if (!brut) return;

    try {
      const draft = JSON.parse(brut) as VoiceReproductionDraft;
      const animalIds = vaches
        .filter((vache) => draft.target.nutravs.includes(vache.nutrav))
        .map((vache) => vache.id);
      if (animalIds.length === 0) return;

      brouillonVocalTraite.current = true;
      sessionStorage.removeItem(VOICE_REPRODUCTION_STORAGE_KEY);
      setSaillieAnimalIds(animalIds);
      setSaillieAnimalId("");
      setSaillieDate(draft.date || new Date().toISOString().split("T")[0]);
      setSaillieType(draft.type);
      setSaillieTaureauId(draft.type === "NATURELLE" ? draft.taureau?.id ?? "" : "");
      setSaillieTaureauNom("");
      setIaSelectedId(draft.type === "IA" ? draft.taureau?.id ?? "" : "");
      setIaNupere("");
      setIaNopere("");
      setIaTraper("");
      setSaillieError(null);
      setShowSaillieForm(true);
    } catch {
      sessionStorage.removeItem(VOICE_REPRODUCTION_STORAGE_KEY);
    }
  }, [loading, searchParams, taureaux, vaches]);

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
    etat: v.reproductionEtatManuel ?? getEtatGestation(
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
  function toggleSelection(animalId: string) {
    setSelectedAnimalIds((ids) => ids.includes(animalId) ? ids.filter((id) => id !== animalId) : [...ids, animalId]);
  }

  async function passerSelectionAEcho() {
    if (selectedAnimalIds.length === 0) return;
    if (!window.confirm(`Passer ${selectedAnimalIds.length} animal(aux) au statut « À écho » ?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/reproduction/statut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds: selectedAnimalIds, statut: "JAUNE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Modification impossible");
      setMessage(`${selectedAnimalIds.length} animal(aux) passé(s) à écho`);
      setSelectedAnimalIds([]);
      setSelectionMode(false);
      await fetchData();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Modification impossible");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaillieSubmit(e: React.FormEvent) {
    e.preventDefault();
    const animalIds = saillieAnimalIds.length > 0 ? saillieAnimalIds : saillieAnimalId ? [saillieAnimalId] : [];
    if (animalIds.length === 0) { setSaillieError("Sélectionnez une vache"); return; }
    if (!saillieDate) { setSaillieError("Choisissez une date"); return; }
    setSaving(true);
    try {
      let taureauId: string | undefined;
      if (saillieType === "NATURELLE") {
        if (saillieTaureauId) {
          taureauId = saillieTaureauId;
        } else if (saillieTaureauNom.trim()) {
          const res = await fetch("/api/taureaux", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nupere: saillieTaureauNom.trim(), nopere: saillieTaureauNom.trim(), present: true }),
          });
          if (res.status === 409) {
            taureauId = taureaux.find((t) => t.nupere === saillieTaureauNom.trim() || (t.nopere ?? "") === saillieTaureauNom.trim())?.id;
          } else if (res.ok) {
            taureauId = (await res.json()).id;
          }
        }
      } else {
        if (iaSelectedId) {
          taureauId = iaSelectedId;
        } else if (iaNupere.trim()) {
          const res = await fetch("/api/taureaux", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nupere: iaNupere.trim(), nopere: iaNopere.trim() || null, traper: iaTraper.trim() || null, present: false }),
          });
          if (res.status === 409) {
            taureauId = taureaux.find((t) => t.nupere === iaNupere.trim())?.id;
          } else if (res.ok) {
            taureauId = (await res.json()).id;
          }
        }
      }
      const res = await fetch("/api/saillies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds, date: saillieDate, type: saillieType, taureauId }),
      });
      if (!res.ok) {
        setSaillieError((await res.json().catch(() => ({}))).error ?? "Erreur serveur");
        return;
      }
      setMessage(animalIds.length > 1 ? `✓ Saillie enregistrée pour ${animalIds.length} vaches !` : "✓ Saillie enregistrée !");
      setShowSaillieForm(false);
      setFilterEtat("TOUS");
      await fetchData();
    } catch (err) {
      setSaillieError("Erreur réseau : " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleChaleurSubmit(e: React.FormEvent) {
    e.preventDefault();
    const animalIds = chaleurAnimalIds.length > 0 ? chaleurAnimalIds : chaleurAnimalId ? [chaleurAnimalId] : [];
    if (animalIds.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/chaleurs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds, date: chaleurDate, notes: chaleurNotes.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setMessage(animalIds.length > 1 ? `✓ Chaleur enregistrée pour ${animalIds.length} vaches !` : "✓ Chaleur enregistrée !");
      setShowChaleurForm(false);
      await fetchData();
    } catch {
      setMessage("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleEchoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const joursGestationFinal = echoUnite === "mois" ? Math.round(echoJours * 30.5) : echoJours;
      const res = await fetch("/api/echographies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saillieId: echoSaillieId, date: echoDate, resultat: echoResultat,
          joursGestation: echoResultat === "PLEINE" ? joursGestationFinal : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("✓ Échographie enregistrée !");
      setShowEchoForm(false);
      await fetchData();
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function marquerVide(vache: VacheRepro) {
    if (!vache.saillieId) return;
    setSaving(true);
    try {
      await fetch("/api/echographies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saillieId: vache.saillieId, date: today, resultat: "VIDE" }),
      });
      setMessage(`${vache.nutrav} marquée vide`);
      setConfirmVideId(null);
      await fetchData();
    } catch {
      setMessage("Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSaillie(vache: VacheRepro) {
    if (!vache.saillieId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/saillies/${vache.saillieId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(`Erreur : ${data.error ?? "impossible de supprimer"}`);
        return;
      }
      setMessage(`✓ Saillie de ${vache.nutrav} supprimée`);
      setConfirmDeleteSaillieId(null);
      await fetchData();
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleGroupageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (groupageIds.length === 0) { setGroupageError("Sélectionnez au moins une vache"); return; }
    if (!groupageDate) { setGroupageError("Choisissez une date"); return; }
    setSaving(true);
    setGroupageError(null);
    try {
      const taureauId = groupageTaureauId || undefined;
      const results = await Promise.allSettled(
        groupageIds.map((id) =>
          fetch("/api/saillies", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ animalId: id, date: groupageDate, type: groupageType, taureauId }),
          })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const ko = results.length - ok;
      setMessage(`✓ Groupage : ${ok} saillie${ok > 1 ? "s" : ""} enregistrée${ok > 1 ? "s" : ""}${ko > 0 ? ` (${ko} échec)` : ""}`);
      setShowGroupageForm(false);
      setFilterEtat("TOUS");
      await fetchData();
    } catch {
      setGroupageError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  const groupageFiltered = vaches.filter((v) => {
    const q = groupageQuery.toLowerCase();
    return v.nutrav.toLowerCase().includes(q) || (v.nobovi ?? "").toLowerCase().includes(q);
  });

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <TroupeauTabs />

      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
<div>
            <h2 className="text-xl font-bold text-gray-800">Reproduction</h2>
            <p className="text-xs text-gray-500">Suivre les femelles reproductrices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reproduction/impression" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" title="Imprimer">
            <Printer size={18} />
          </Link>
          <Link href="/taureaux" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" title="Taureaux">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* Action spécifique au module */}
      <div>
        <button
          type="button"
          onClick={openGroupageForm}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <Users size={18} />
          Groupage
        </button>
      </div>

      {/* Message de retour */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage(null)} className="font-bold ml-2 text-lg leading-none">×</button>
        </div>
      )}

      {/* Le calendrier de gestation détaillé vit maintenant sur la page Vélage */}
      <Link
        href="/velage"
        className="flex items-center gap-2 bg-white rounded-xl shadow px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Baby size={18} className="text-pink-500" />
        <span className="flex-1 font-medium">Voir le calendrier de gestation et enregistrer un vélage</span>
        <span className="text-gray-400">→</span>
      </Link>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow p-2 flex gap-1 overflow-x-auto">
        {(["TOUS", "ROUGE", "REPOS", "JAUNE", "VERT", "ROSE", "GRIS"] as FilterEtat[]).map((etat) => {
          const count = etat === "TOUS" ? vachesAvecEtat.length : counts[etat];
          const isActive = filterEtat === etat;
          const cls =
            etat === "TOUS" ? (isActive ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600")
            : etat === "ROUGE" ? (isActive ? "bg-red-500 text-white" : "bg-red-100 text-red-600")
            : etat === "JAUNE" ? (isActive ? "bg-yellow-400 text-black" : "bg-yellow-50 text-yellow-700")
            : etat === "VERT" ? (isActive ? "bg-green-500 text-white" : "bg-green-100 text-green-700")
            : etat === "ROSE" ? (isActive ? "bg-pink-400 text-white" : "bg-pink-100 text-pink-600")
            : etat === "REPOS" ? (isActive ? "bg-sky-500 text-white" : "bg-sky-100 text-sky-700")
            : (isActive ? "bg-gray-400 text-white" : "bg-gray-100 text-gray-600");
          return (
            <button key={etat} onClick={() => setFilterEtat(etat)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${cls}`}>
              {filterLabels[etat]} <span className="font-bold ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Sélection multiple */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setSelectionMode((active) => !active); setSelectedAnimalIds([]); }}
          className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${selectionMode ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 bg-white text-gray-700"}`}
        >
          {selectionMode ? "Annuler la sélection" : "Sélectionner plusieurs animaux"}
        </button>
        {selectionMode && selectedAnimalIds.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={passerSelectionAEcho}
            className="min-h-10 rounded-xl bg-amber-500 px-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Passer à écho ({selectedAnimalIds.length})
          </button>
        )}
      </div>

      {/* Liste vaches */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vache) => {
            const joursDepuisChaleur = vache.derniereChaleur
              ? differenceInDays(now, new Date(vache.derniereChaleur)) : null;
            const joursAvantVelage = vache.dateVelagePrevue
              ? differenceInDays(new Date(vache.dateVelagePrevue), now) : null;
            const carteEtat = reproductionCardStates[vache.etat];
            const categorie = vache.estGenisse
              ? "Génisse"
              : vache.categorie === "A_ENGRAISSER"
                ? "À engraisser"
                : null;
            const terme = joursAvantVelage === null
              ? null
              : joursAvantVelage >= 0
                ? `J-${joursAvantVelage}`
                : `J+${Math.abs(joursAvantVelage)}`;

            return (
              <article key={vache.id} className={`rounded-xl border-2 bg-white px-3 py-2.5 shadow-sm ${carteEtat.border}`}>
                {/* Ligne 1 : identité et statut */}
                <div className="flex min-w-0 items-center gap-2">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedAnimalIds.includes(vache.id)}
                      onChange={() => toggleSelection(vache.id)}
                      aria-label={`Sélectionner ${vache.nutrav}`}
                      className="h-5 w-5 shrink-0 accent-green-700"
                    />
                  )}
                  <Link
                    href={`/troupeau/${vache.nutrav}`}
                    className="shrink-0 font-mono text-sm font-bold text-green-800 hover:underline"
                  >
                    {vache.nutrav}
                  </Link>
                  <span className="text-gray-300">—</span>
                  <Link
                    href={`/troupeau/${vache.nutrav}`}
                    className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 hover:text-green-800"
                  >
                    {vache.nobovi ?? "Sans nom"}
                  </Link>
                  <div className="flex shrink-0 items-center">
                    <span className={`max-w-28 text-right text-[11px] font-bold leading-tight ${carteEtat.text}`}>
                      {carteEtat.label}
                    </span>
                    <ReproductionStatusEditor
                      animalIds={[vache.id]}
                      currentStatus={vache.etat as EtatGestationPartage}
                      previousStatus={vache.reproductionEtatPrecedent as EtatGestationPartage | null}
                      onChanged={fetchData}
                    />
                  </div>
                </div>

                {/* Ligne 2 : informations secondaires */}
                <div className="mt-1 flex min-w-0 items-center gap-x-2 overflow-hidden text-[11px] leading-4 text-gray-500">
                  {categorie && <span className="shrink-0">{categorie}</span>}
                  {categorie && vache.derniereSaillie && <span className="text-gray-300">·</span>}
                  <span className="truncate">
                    {vache.derniereSaillie
                      ? `Saillie : ${formatDateCompacte(new Date(vache.derniereSaillie))}`
                      : "Pas de saillie"}
                    {vache.taureauNom ? ` · Père : ${vache.taureauNom}` : ""}
                  </span>
                  {vache.derniereSaillie && new Date(vache.derniereSaillie) > now && (
                    <span className="shrink-0 font-semibold text-red-600">Date future</span>
                  )}
                </div>

                {/* Ligne 3 : terme, alertes et actions */}
                <div className="mt-1.5 flex min-h-9 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {vache.dateVelagePrevue && (vache.etat === "VERT" || vache.etat === "ROSE") ? (
                      <p className="truncate text-xs font-bold text-green-700">
                        Terme : {formatDateCompacte(new Date(vache.dateVelagePrevue))} · {terme}
                      </p>
                    ) : vache.derniereChaleur ? (
                      <p className="truncate text-[11px] text-pink-600">
                        Chaleur : {formatDateCompacte(new Date(vache.derniereChaleur))} · J+{joursDepuisChaleur}
                      </p>
                    ) : (
                      <span className="text-[11px] text-gray-400">Aucun terme calculé</span>
                    )}
                  </div>

                  {joursDepuisChaleur !== null && joursDepuisChaleur <= 2 && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      En chaleur
                    </span>
                  )}
                  {joursDepuisChaleur !== null && joursDepuisChaleur >= 19 && joursDepuisChaleur <= 21 && (
                    <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                      Retour J+{joursDepuisChaleur} ?
                    </span>
                  )}

                  <div data-repro-menu className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmVideId(null);
                        setConfirmDeleteSaillieId(null);
                        setMenuVacheId((id) => id === vache.id ? null : vache.id);
                      }}
                      aria-label={`Actions pour ${vache.nutrav}`}
                      aria-expanded={menuVacheId === vache.id}
                      aria-haspopup="menu"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                    >
                      <MoreHorizontal size={20} />
                    </button>

                    {menuVacheId === vache.id && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMenuVacheId(null); openChaleurForm(vache); }}
                          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-pink-700 hover:bg-pink-50"
                        >
                          <ChaleurIcon size={18} />
                          Chaleur
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMenuVacheId(null); openSaillieForm(vache); }}
                          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50"
                        >
                          <SaillieIcon size={18} />
                          Saillie / IA
                        </button>
                        {(vache.etat === "JAUNE" || vache.etat === "GRIS") && vache.saillieId && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setMenuVacheId(null); openEchoForm(vache); }}
                            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                          >
                            <CheckCircle size={18} />
                            Échographie
                          </button>
                        )}
                        <Link
                          role="menuitem"
                          href={`/troupeau/${vache.nutrav}`}
                          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Eye size={18} />
                          Voir la fiche
                        </Link>

                        {vache.saillieId && (
                          <>
                            <div className="my-1 border-t border-gray-100" />
                            {vache.etat !== "ROUGE" && vache.etat !== "REPOS" && (
                              confirmVideId === vache.id ? (
                                <div className="rounded-lg bg-blue-50 p-2.5">
                                  <p className="mb-2 text-xs font-medium text-blue-800">Marquer cette vache vide ?</p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => marquerVide(vache)}
                                      disabled={saving}
                                      className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white"
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmVideId(null)}
                                      className="rounded-lg px-2 py-1.5 text-xs text-gray-600"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => setConfirmVideId(vache.id)}
                                  className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                                >
                                  Marquer vide
                                </button>
                              )
                            )}

                            {confirmDeleteSaillieId === vache.id ? (
                              <div className="rounded-lg bg-red-50 p-2.5">
                                <p className="mb-2 text-xs font-medium text-red-800">Supprimer la saillie enregistrée ?</p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => deleteSaillie(vache)}
                                    disabled={saving}
                                    className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white"
                                  >
                                    Supprimer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSaillieId(null)}
                                    className="rounded-lg px-2 py-1.5 text-xs text-gray-600"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => setConfirmDeleteSaillieId(vache.id)}
                                className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Saillie incorrecte
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">Aucune vache dans cette catégorie</div>
          )}
        </div>
      )}

      {/* ── Modal Chaleur ───────────────────────────────────────────────── */}
      {showChaleurForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800"><ChaleurIcon size={20} className="text-pink-600" /> Chaleur</h3>
              <button onClick={() => setShowChaleurForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleChaleurSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vache{chaleurAnimalIds.length > 1 ? "s" : ""}</label>
                {chaleurAnimalIds.length > 0 ? (
                  <VachesSelectionnees vaches={vaches} ids={chaleurAnimalIds} onChange={setChaleurAnimalIds} />
                ) : (
                  <VacheSearch vaches={vaches} selectedId={chaleurAnimalId} onSelect={setChaleurAnimalId} placeholder="Numéro ou nom de la vache…" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;observation</label>
                <DateInput value={chaleurDate} onChange={setChaleurDate} required
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={chaleurNotes} onChange={(e) => setChaleurNotes(e.target.value)}
                  placeholder="ex : chaleur forte, montée, mucus…"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
              </div>
              <button type="submit" disabled={saving || (chaleurAnimalIds.length === 0 && !chaleurAnimalId)}
                className="w-full bg-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? "Enregistrement…" : chaleurAnimalIds.length > 1 ? `Enregistrer pour ${chaleurAnimalIds.length} vaches` : "Enregistrer la chaleur"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Saillie ───────────────────────────────────────────────── */}
      {showSaillieForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800"><SaillieIcon size={20} className="text-fuchsia-600" /> Saillie / IA</h3>
              <button onClick={() => setShowSaillieForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSaillieSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vache{saillieAnimalIds.length > 1 ? "s" : ""}</label>
                {saillieAnimalIds.length > 0 ? (
                  <VachesSelectionnees vaches={vaches} ids={saillieAnimalIds} onChange={setSaillieAnimalIds} />
                ) : (
                  <VacheSearch vaches={vaches} selectedId={saillieAnimalId} onSelect={setSaillieAnimalId} placeholder="Numéro ou nom de la vache…" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <DateInput value={saillieDate} onChange={setSaillieDate} required
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSaillieType("NATURELLE")}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${saillieType === "NATURELLE" ? "bg-green-700 text-white border-green-700" : "border-gray-200 text-gray-600"}`}>
                    🐄 Naturelle
                  </button>
                  <button type="button" onClick={() => setSaillieType("IA")}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${saillieType === "IA" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600"}`}>
                    💉 Insémination
                  </button>
                </div>
              </div>

              {saillieType === "NATURELLE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taureau <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <TaureauSearch
                    taureaux={farmBulls}
                    selectedId={saillieTaureauId}
                    onSelect={(id, nom) => { setSaillieTaureauId(id ?? ""); setSaillieTaureauNom(id ? "" : nom); }}
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
