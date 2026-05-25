"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare, Square, Syringe, Pill, AlertTriangle,
  CheckCircle, CheckCircle2, X, List, LayoutGrid, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import VaccinationFormWrapper from "./VaccinationFormWrapper";
import VaccineQuickButton from "./VaccineQuickButton";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VeauItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  ageLabel: string;
  vaccinsManquants: { vaccin: string; urgent: boolean; raison: string }[];
}

export interface CryptoItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  joursAvantVelage: number;
  dateLabel: string;
  hasCrypto: boolean;
  hasRotavec: boolean;
}

export interface BolusItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  joursAvantVelage: number;
  dateLabel: string;
}

export interface RecentItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  vaccin: string;
  dateLabel: string;
}

interface Props {
  veauxAVacciner: VeauItem[];
  cryptoRotavec: CryptoItem[];
  bolus: BolusItem[];
  vaccinationsRecentes: RecentItem[];
}

// ── Key format: "nutrav::vaccin" ──────────────────────────────────────────────
function key(nutrav: string, vaccin: string) {
  return `${nutrav}::${vaccin}`;
}
function parseKey(k: string): { nutrav: string; vaccin: string } {
  const [nutrav, vaccin] = k.split("::");
  return { nutrav, vaccin };
}

const today = new Date().toISOString().slice(0, 10);

const VOIES = [
  { value: "IM", label: "IM — Intramusculaire" },
  { value: "SC", label: "SC — Sous-cutané" },
  { value: "IN", label: "IN — Intranasale" },
  { value: "PO", label: "PO — Oral (bolus)" },
];

// ── Checkbox row ──────────────────────────────────────────────────────────────
function CheckRow({
  k, label, detail, urgent, selected, onToggle,
}: {
  k: string; label: string; detail?: string; urgent?: boolean;
  selected: boolean; onToggle: (k: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
        selected
          ? "bg-green-50 border-green-300"
          : urgent
          ? "bg-red-50 border-red-200 hover:bg-red-100"
          : "bg-white border-gray-100 hover:bg-gray-50"
      }`}
    >
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        selected ? "bg-green-600 border-green-600" : "border-gray-300"
      }`}>
        {selected && <span className="text-white text-xs font-bold">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold">{label.split(" ")[0]}</span>
          <span className="text-sm text-gray-800">{label.split(" ").slice(1).join(" ")}</span>
          {urgent && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">URGENT</span>}
        </div>
        {detail && <div className="text-xs text-gray-400 mt-0.5">{detail}</div>}
      </div>
    </button>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title, icon, count, color, children, sectionKeys, selected, onToggleAll,
  sessionMode,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  children: React.ReactNode;
  sectionKeys: string[];
  selected: Set<string>;
  onToggleAll: (keys: string[], select: boolean) => void;
  sessionMode: boolean;
}) {
  if (count === 0) return null;
  const allSelected = sectionKeys.length > 0 && sectionKeys.every((k) => selected.has(k));
  const someSelected = sectionKeys.some((k) => selected.has(k));

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold flex items-center gap-2 ${color}`}>
          {icon}
          {title}
          <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
        </h3>
        {sessionMode && sectionKeys.length > 0 && (
          <button
            onClick={() => onToggleAll(sectionKeys, !allSelected)}
            className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
              allSelected
                ? "bg-green-600 text-white border-green-600"
                : "border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
            }`}
          >
            {allSelected ? "Tout désélectionner" : someSelected ? "Tout sélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ── Recent row with delete ────────────────────────────────────────────────────
function RecentRow({ vacc, onDeleted }: { vacc: RecentItem; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/vaccinations/${vacc.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{vacc.nutrav}</span>
        <span className="text-gray-700 truncate">{vacc.nobovi ?? "Sans nom"}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{vacc.vaccin}</span>
        <span className="text-xs text-gray-400">{vacc.dateLabel}</span>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "…" : "Confirmer"}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1">
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-gray-300 hover:text-red-400 transition-colors p-0.5 rounded"
            title="Annuler cette vaccination"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Recent section with bulk delete ──────────────────────────────────────────
function RecentSection({ items, onRefresh }: { items: RecentItem[]; onRefresh: () => void }) {
  const [confirmAll, setConfirmAll] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  async function handleDeleteAll() {
    setLoadingAll(true);
    try {
      await Promise.all(items.map((v) => fetch(`/api/vaccinations/${v.id}`, { method: "DELETE" })));
      onRefresh();
    } finally {
      setLoadingAll(false);
      setConfirmAll(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          Vaccinations récentes (7 derniers jours)
        </h3>
        {confirmAll ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteAll}
              disabled={loadingAll}
              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {loadingAll ? "…" : `Supprimer les ${items.length}`}
            </button>
            <button onClick={() => setConfirmAll(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmAll(true)}
            className="text-xs text-red-400 hover:text-red-600 font-medium border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            Tout supprimer
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">Appuyer sur ✕ pour annuler une erreur de saisie</p>
      <div className="space-y-1">
        {items.map((vacc) => (
          <RecentRow key={vacc.id} vacc={vacc} onDeleted={onRefresh} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SanitaireClient({ veauxAVacciner, cryptoRotavec, bolus, vaccinationsRecentes }: Props) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"animal" | "traitement">("animal");
  const [sessionMode, setSessionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [batchDate, setBatchDate] = useState(today);
  const [batchVoie, setBatchVoie] = useState("IM");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Toggle session mode ──────────────────────────────────────────────────────
  function toggleSession() {
    setSessionMode((v) => !v);
    setSelected(new Set());
  }

  // ── Selection helpers ────────────────────────────────────────────────────────
  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function toggleAll(keys: string[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (select ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  // ── Precompute keys per section ──────────────────────────────────────────────
  const veauxKeys = useMemo(
    () => veauxAVacciner.flatMap((a) => a.vaccinsManquants.map((v) => key(a.nutrav, v.vaccin))),
    [veauxAVacciner]
  );
  const cryptoKeys = useMemo(
    () =>
      cryptoRotavec.flatMap((a) => [
        ...(!a.hasCrypto ? [key(a.nutrav, "CRYPTO")] : []),
        ...(!a.hasRotavec ? [key(a.nutrav, "ROTAVEC")] : []),
      ]),
    [cryptoRotavec]
  );
  const bolusKeys = useMemo(() => bolus.map((a) => key(a.nutrav, "BOLUS")), [bolus]);

  // ── Par traitement: group all items by vaccin ────────────────────────────────
  const groupsByVaccin = useMemo(() => {
    const groups = new Map<string, { nutrav: string; nobovi: string | null; detail: string; urgent?: boolean }[]>();
    for (const veau of veauxAVacciner) {
      for (const v of veau.vaccinsManquants) {
        if (!groups.has(v.vaccin)) groups.set(v.vaccin, []);
        groups.get(v.vaccin)!.push({ nutrav: veau.nutrav, nobovi: veau.nobovi, detail: veau.ageLabel, urgent: v.urgent });
      }
    }
    for (const v of cryptoRotavec) {
      if (!v.hasCrypto) {
        if (!groups.has("CRYPTO")) groups.set("CRYPTO", []);
        groups.get("CRYPTO")!.push({ nutrav: v.nutrav, nobovi: v.nobovi, detail: `J-${v.joursAvantVelage} · ${v.dateLabel}` });
      }
      if (!v.hasRotavec) {
        if (!groups.has("ROTAVEC")) groups.set("ROTAVEC", []);
        groups.get("ROTAVEC")!.push({ nutrav: v.nutrav, nobovi: v.nobovi, detail: `J-${v.joursAvantVelage} · ${v.dateLabel}` });
      }
    }
    for (const b of bolus) {
      if (!groups.has("BOLUS")) groups.set("BOLUS", []);
      groups.get("BOLUS")!.push({ nutrav: b.nutrav, nobovi: b.nobovi, detail: `J-${b.joursAvantVelage} · ${b.dateLabel}` });
    }
    return groups;
  }, [veauxAVacciner, cryptoRotavec, bolus]);

  const allTraitementKeys = useMemo(
    () => [...groupsByVaccin.entries()].flatMap(([vaccin, animals]) => animals.map((a) => key(a.nutrav, vaccin))),
    [groupsByVaccin]
  );

  // ── Batch submit ─────────────────────────────────────────────────────────────
  async function handleBatchSubmit() {
    setSaving(true);
    try {
      const items = [...selected].map((k) => parseKey(k));
      const res = await fetch("/api/vaccinations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, date: batchDate, voie: batchVoie }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const { count } = await res.json();
      setSuccessMsg(`✓ ${count} traitement${count > 1 ? "s" : ""} enregistré${count > 1 ? "s" : ""} !`);
      setSelected(new Set());
      setShowModal(false);
      setSessionMode(false);
      router.refresh();
    } catch {
      // ignore — retry
    } finally {
      setSaving(false);
    }
  }

  const urgents = veauxAVacciner.filter((a) => a.vaccinsManquants.some((v) => v.urgent));
  const totalPending = veauxKeys.length + cryptoKeys.length + bolusKeys.length;

  return (
    <>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-xl font-bold text-red-600">{urgents.length}</div>
          <div className="text-xs text-gray-500 mt-1">Urgents</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-xl font-bold text-yellow-600">{veauxAVacciner.length}</div>
          <div className="text-xs text-gray-500 mt-1">À vacciner</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-xl font-bold text-pink-600">{cryptoRotavec.length}</div>
          <div className="text-xs text-gray-500 mt-1">Crypto/Rotavec</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-xl font-bold text-amber-600">{bolus.length}</div>
          <div className="text-xs text-gray-500 mt-1">Bolus</div>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Controls bar */}
      <div className="bg-white rounded-xl shadow p-3 flex items-center justify-between gap-2 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("animal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "animal" ? "bg-white text-gray-800 shadow" : "text-gray-500"
            }`}
          >
            <List size={13} /> Par animal
          </button>
          <button
            onClick={() => setViewMode("traitement")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "traitement" ? "bg-white text-gray-800 shadow" : "text-gray-500"
            }`}
          >
            <LayoutGrid size={13} /> Par vaccin
          </button>
        </div>

        {/* Session toggle */}
        {totalPending > 0 && (
          <button
            onClick={toggleSession}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              sessionMode
                ? "bg-green-600 text-white border-green-600"
                : "border-green-300 text-green-700 hover:bg-green-50"
            }`}
          >
            {sessionMode ? <CheckSquare size={15} /> : <Square size={15} />}
            {sessionMode ? "Session active" : "Mode session"}
          </button>
        )}
      </div>

      {/* Vaccination form (always available) */}
      <VaccinationFormWrapper />

      {/* ── VUE PAR ANIMAL ─────────────────────────────────────────────────── */}
      {viewMode === "animal" && (
        <>
          {/* Bolus */}
          <Section
            title="Bolus / Métrabol pré-vélage"
            icon={<Pill size={16} className="text-amber-500" />}
            count={bolus.length}
            color="text-amber-800"
            sectionKeys={bolusKeys}
            selected={selected}
            onToggleAll={toggleAll}
            sessionMode={sessionMode}
          >
            {bolus.map((v) => {
              const k = key(v.nutrav, "BOLUS");
              return sessionMode ? (
                <CheckRow
                  key={k}
                  k={k}
                  label={`${v.nutrav} ${v.nobovi ?? "Sans nom"}`}
                  detail={`Vélage dans ${v.joursAvantVelage}j — ${v.dateLabel}`}
                  selected={selected.has(k)}
                  onToggle={toggle}
                />
              ) : (
                <div key={v.id} className="border border-amber-100 rounded-lg p-3 bg-amber-50 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/troupeau/${v.nutrav}`} className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{v.nutrav}</Link>
                      <span className="text-sm font-medium text-gray-800">{v.nobovi ?? "Sans nom"}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Vélage dans {v.joursAvantVelage}j — {v.dateLabel}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs bg-amber-400 text-white px-2 py-1 rounded-full">J-{v.joursAvantVelage}</span>
                    <VaccineQuickButton nutrav={v.nutrav} vaccin="BOLUS" label="+ Bolus" />
                    <VaccineQuickButton nutrav={v.nutrav} vaccin="METRABOL" label="+ Métrabol" />
                  </div>
                </div>
              );
            })}
          </Section>

          {/* Crypto / Rotavec */}
          <Section
            title="Crypto / Rotavec pré-vélage"
            icon={<Syringe size={16} className="text-pink-500" />}
            count={cryptoRotavec.length}
            color="text-pink-800"
            sectionKeys={cryptoKeys}
            selected={selected}
            onToggleAll={toggleAll}
            sessionMode={sessionMode}
          >
            {cryptoRotavec.map((v) => {
              const kc = key(v.nutrav, "CRYPTO");
              const kr = key(v.nutrav, "ROTAVEC");
              return sessionMode ? (
                <div key={v.id} className="space-y-1">
                  {!v.hasCrypto && (
                    <CheckRow k={kc} label={`${v.nutrav} ${v.nobovi ?? "Sans nom"} — CRYPTO`}
                      detail={`J-${v.joursAvantVelage} · ${v.dateLabel}`}
                      selected={selected.has(kc)} onToggle={toggle} />
                  )}
                  {!v.hasRotavec && (
                    <CheckRow k={kr} label={`${v.nutrav} ${v.nobovi ?? "Sans nom"} — ROTAVEC`}
                      detail={`J-${v.joursAvantVelage} · ${v.dateLabel}`}
                      selected={selected.has(kr)} onToggle={toggle} />
                  )}
                </div>
              ) : (
                <div key={v.id} className="border border-pink-100 rounded-lg p-3 bg-pink-50 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/troupeau/${v.nutrav}`} className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{v.nutrav}</Link>
                      <span className="text-sm font-medium text-gray-800">{v.nobovi ?? "Sans nom"}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Vélage dans {v.joursAvantVelage}j — {v.dateLabel}</div>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.hasCrypto ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {v.hasCrypto ? "✓" : "✗"} CRYPTO
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.hasRotavec ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {v.hasRotavec ? "✓" : "✗"} ROTAVEC
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs bg-pink-400 text-white px-2 py-1 rounded-full">J-{v.joursAvantVelage}</span>
                    {!v.hasCrypto && <VaccineQuickButton nutrav={v.nutrav} vaccin="CRYPTO" label="+ Crypto" />}
                    {!v.hasRotavec && <VaccineQuickButton nutrav={v.nutrav} vaccin="ROTAVEC" label="+ Rotavec" />}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* Veaux à vacciner */}
          <Section
            title="Veaux à vacciner"
            icon={<AlertTriangle size={16} className="text-yellow-500" />}
            count={veauxAVacciner.length}
            color="text-yellow-800"
            sectionKeys={veauxKeys}
            selected={selected}
            onToggleAll={toggleAll}
            sessionMode={sessionMode}
          >
            {veauxAVacciner.length === 0 ? (
              <div className="text-center text-gray-400 py-6">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                Tous les protocoles sont à jour !
              </div>
            ) : (
              veauxAVacciner.map((animal) => {
                const estUrgent = animal.vaccinsManquants.some((v) => v.urgent);
                return sessionMode ? (
                  <div key={animal.id} className="space-y-1">
                    {animal.vaccinsManquants.map((v) => {
                      const k = key(animal.nutrav, v.vaccin);
                      return (
                        <CheckRow key={k} k={k}
                          label={`${animal.nutrav} ${animal.nobovi ?? "Sans nom"} — ${v.vaccin}`}
                          detail={`${animal.ageLabel} · ${v.raison}`}
                          urgent={v.urgent}
                          selected={selected.has(k)}
                          onToggle={toggle}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div key={animal.id} className={`border rounded-lg p-3 ${estUrgent ? "border-red-200 bg-red-50" : "border-yellow-100 bg-yellow-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/troupeau/${animal.nutrav}`} className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{animal.nutrav}</Link>
                          <span className="text-sm font-medium text-gray-800">{animal.nobovi ?? "Sans nom"}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{animal.ageLabel}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {animal.vaccinsManquants.map((v) => (
                            <span key={v.vaccin} className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.urgent ? "bg-red-500 text-white" : "bg-yellow-400 text-black"}`}>
                              {v.vaccin}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{animal.vaccinsManquants.map((v) => v.raison).join(" • ")}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {estUrgent && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">URGENT</span>}
                        {animal.vaccinsManquants.slice(0, 2).map((v) => (
                          <VaccineQuickButton key={v.vaccin} nutrav={animal.nutrav} vaccin={v.vaccin} label={`+ ${v.vaccin}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </Section>

          {/* Empty state */}
          {totalPending === 0 && (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <CheckCircle2 size={36} className="mx-auto mb-3 text-green-500" />
              <div className="font-semibold text-gray-700">Tout est à jour !</div>
              <div className="text-sm text-gray-400 mt-1">Aucun traitement en attente</div>
            </div>
          )}
        </>
      )}

      {/* ── VUE PAR VACCIN ─────────────────────────────────────────────────── */}
      {viewMode === "traitement" && (
        <>
          {groupsByVaccin.size === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <CheckCircle2 size={36} className="mx-auto mb-3 text-green-500" />
              <div className="font-semibold text-gray-700">Tout est à jour !</div>
              <div className="text-sm text-gray-400 mt-1">Aucun traitement en attente</div>
            </div>
          ) : (
            [...groupsByVaccin.entries()].map(([vaccin, animals]) => {
              const groupKeys = animals.map((a) => key(a.nutrav, vaccin));
              const allSel = groupKeys.every((k) => selected.has(k));
              const isUrgentGroup = animals.some((a) => a.urgent);
              const bgHeader = isUrgentGroup ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200";
              return (
                <div key={vaccin} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${bgHeader}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                        isUrgentGroup ? "bg-red-500 text-white" :
                        vaccin === "CRYPTO" || vaccin === "ROTAVEC" ? "bg-pink-500 text-white" :
                        vaccin === "BOLUS" || vaccin === "METRABOL" ? "bg-amber-500 text-white" :
                        "bg-purple-600 text-white"
                      }`}>{vaccin}</span>
                      <span className="text-sm text-gray-600">{animals.length} animal{animals.length > 1 ? "x" : ""}</span>
                    </div>
                    {sessionMode && (
                      <button
                        onClick={() => toggleAll(groupKeys, !allSel)}
                        className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
                          allSel ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"
                        }`}
                      >
                        {allSel ? "Tout désél." : "Tout sél."}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50 px-2 py-2 space-y-1">
                    {animals.map((a) => {
                      const k = key(a.nutrav, vaccin);
                      return sessionMode ? (
                        <CheckRow key={k} k={k}
                          label={`${a.nutrav} ${a.nobovi ?? "Sans nom"}`}
                          detail={a.detail}
                          urgent={a.urgent}
                          selected={selected.has(k)}
                          onToggle={toggle}
                        />
                      ) : (
                        <div key={k} className="flex items-center justify-between py-2 px-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/troupeau/${a.nutrav}`} className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                                {a.nutrav}
                              </Link>
                              <span className="text-sm text-gray-800">{a.nobovi ?? "Sans nom"}</span>
                              {a.urgent && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">URGENT</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 ml-0.5">{a.detail}</div>
                          </div>
                          <VaccineQuickButton nutrav={a.nutrav} vaccin={vaccin} label="+ Valider" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Tout sélectionner global */}
          {sessionMode && groupsByVaccin.size > 0 && (
            <button
              onClick={() => toggleAll(allTraitementKeys, allTraitementKeys.every((k) => selected.has(k)) ? false : true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-colors"
            >
              {allTraitementKeys.every((k) => selected.has(k)) ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          )}
        </>
      )}

      {/* Vaccinations récentes */}
      {vaccinationsRecentes.length > 0 && (
        <RecentSection items={vaccinationsRecentes} onRefresh={() => router.refresh()} />
      )}

      {/* ── Floating selection bar ────────────────────────────────────────────── */}
      {sessionMode && selected.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="bg-green-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-base">{selected.size} traitement{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}</div>
              <div className="text-xs text-green-200 mt-0.5">
                {[...new Set([...selected].map((k) => parseKey(k).vaccin))].join(", ")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 rounded-xl text-sm font-medium hover:bg-green-500 transition-colors"
              >
                <X size={15} /> Tout décocher
              </button>
              <button
                onClick={() => { setBatchDate(today); setShowModal(true); }}
                className="bg-white text-green-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-green-50 active:scale-95 transition-all"
              >
                Valider ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch modal ───────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.currentTarget === e.target) setShowModal(false); }}
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Confirmer la session</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Résumé */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
              <div className="text-sm font-semibold text-green-800 mb-2">
                {selected.size} traitement{selected.size > 1 ? "s" : ""} à enregistrer
              </div>
              <div className="space-y-1">
                {[...groupsByVaccin.entries()]
                  .map(([vaccin, animals]) => {
                    const count = animals.filter((a) => selected.has(key(a.nutrav, vaccin))).length;
                    if (count === 0) return null;
                    return (
                      <div key={vaccin} className="flex items-center justify-between text-xs text-green-700">
                        <span className="font-medium">{vaccin}</span>
                        <span>{count} animal{count > 1 ? "x" : ""}</span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date de traitement</label>
                <input
                  type="date"
                  value={batchDate}
                  max={today}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                {batchDate && (() => {
                  const daysAgo = Math.floor((Date.now() - new Date(batchDate).getTime()) / 86400000);
                  if (daysAgo > 30) return (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      ⚠️ Date ancienne ({daysAgo} jours) — les animaux disparaîtront bien de la liste après enregistrement.
                    </p>
                  );
                  return null;
                })()}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Voie d&apos;administration</label>
                <select
                  value={batchVoie}
                  onChange={(e) => setBatchVoie(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  {VOIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <button
                onClick={handleBatchSubmit}
                disabled={saving || !batchDate}
                className="w-full py-3 bg-green-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-98 transition-all"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2"><RefreshCw size={16} className="animate-spin" /> Enregistrement…</span>
                ) : (
                  `Enregistrer ${selected.size} traitement${selected.size > 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
