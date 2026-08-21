"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Save, Scale } from "lucide-react";
import {
  calculateRenewalProjection,
  countRenewalDecisions,
  groupCandidatesByParent,
  parentDisplay,
  probableEntryYear,
  projectionMessage,
  renewalPilotMessage,
  type CowExitDecision,
  type ParentIdentity,
  type RenewalDecision,
  type RenewalSettings,
} from "@/lib/herd-renewal";

export interface RenewalCandidate {
  id: string;
  nutrav: string;
  name: string | null;
  birthDate: string;
  category: string;
  categoryLabel: string;
  entryYear: number;
  mother: ParentIdentity | null;
  father: ParentIdentity | null;
  lastWeight: number | null;
  lastWeightDate: string | null;
}

export interface RenewalMother {
  id: string;
  nutrav: string;
  name: string | null;
}

const date = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
function ageLabel(birthDate: string) {
  const months = Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / (30.44 * 86400000)));
  return months < 24 ? `${months} mois` : `${Math.floor(months / 12)} ans ${months % 12} mois`;
}

function ToneMessage({ tone, children }: { tone: "green" | "orange" | "red"; children: React.ReactNode }) {
  const colors = tone === "green" ? "border-green-200 bg-green-50 text-green-900" : tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-orange-200 bg-orange-50 text-orange-900";
  return <p className={`rounded-xl border px-3 py-2.5 text-sm font-medium leading-5 ${colors}`}>{children}</p>;
}

function ChoiceButton({ active, children, onClick, tone = "green" }: { active: boolean; children: React.ReactNode; onClick: () => void; tone?: "green" | "amber" | "red" }) {
  const activeClass = tone === "red" ? "border-red-600 bg-red-600 text-white" : tone === "amber" ? "border-amber-500 bg-amber-500 text-white" : "border-green-700 bg-green-700 text-white";
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${active ? activeClass : "border-gray-200 bg-white text-gray-600"}`}>{children}</button>;
}

export default function RenewalDashboard({ currentMothers, candidates, mothers, initialSettings }: { currentMothers: number; candidates: RenewalCandidate[]; mothers: RenewalMother[]; initialSettings: RenewalSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [candidateDecisions, setCandidateDecisions] = useState<Record<string, RenewalDecision>>(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, "GARDER"])));
  const [exitDecisions, setExitDecisions] = useState<Record<string, CowExitDecision>>(() => Object.fromEntries(mothers.map((mother) => [mother.id, "PAS_PREVUE"])));
  const [compare, setCompare] = useState(false);
  const [view, setView] = useState<"liste" | "pere" | "mere">("liste");
  const [sort, setSort] = useState<"age" | "poids" | "naissance" | "pere" | "mere">("age");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const { kept, review, rejected } = countRenewalDecisions(candidateDecisions);
  const plannedExits = mothers.filter((mother) => exitDecisions[mother.id] === "DECIDEE").length;
  const projection = calculateRenewalProjection({ currentMothers, targetMothers: settings.targetMothers, renewalRatePercent: settings.renewalRatePercent, candidates: candidates.length, keptCandidates: kept, plannedExits });
  const pilot = renewalPilotMessage(candidates.length, projection.annualNeed);
  const projected = projectionMessage(currentMothers, kept, plannedExits);

  const displayCandidates = useMemo(() => candidates.map((candidate) => ({ ...candidate, entryYear: probableEntryYear(candidate.birthDate, settings.firstCalvingAgeMonths) })), [candidates, settings.firstCalvingAgeMonths]);
  const sorted = useMemo(() => [...displayCandidates].sort((a, b) => {
    if (sort === "poids") return (b.lastWeight ?? -1) - (a.lastWeight ?? -1);
    if (sort === "naissance") return a.birthDate.localeCompare(b.birthDate);
    if (sort === "pere") return parentDisplay(a.father, "father").localeCompare(parentDisplay(b.father, "father"), "fr");
    if (sort === "mere") return parentDisplay(a.mother, "mother").localeCompare(parentDisplay(b.mother, "mother"), "fr");
    return a.birthDate.localeCompare(b.birthDate);
  }), [displayCandidates, sort]);
  const groups = view === "pere" ? groupCandidatesByParent(sorted, (candidate) => candidate.father, "Père inconnu") : groupCandidatesByParent(sorted, (candidate) => candidate.mother, "Mère inconnue");
  const years = [...new Set(displayCandidates.map((candidate) => candidate.entryYear))].sort();

  async function saveSettings() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/renouvellement-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false);
    setMessage(response.ok ? "Objectifs enregistrés." : "Impossible d’enregistrer les objectifs.");
  }

  if (compare) {
    return <div className="space-y-3">
      <button type="button" onClick={() => setCompare(false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-gray-700 shadow-sm"><ArrowLeft size={16} /> Renouvellement</button>
      <div className="sticky top-2 z-20 rounded-xl border border-green-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between"><strong>{candidates.length} candidates</strong><span className="text-xs text-gray-500">Objectif estimé : {projection.annualNeed}</span></div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs"><span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-800">{kept} garder</span><span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800">{review} à revoir</span><span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-800">{rejected} sortir</span></div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm">
        {(["liste", "pere", "mere"] as const).map((item) => <ChoiceButton key={item} active={view === item} onClick={() => setView(item)}>{item === "liste" ? "Candidates" : item === "pere" ? "Par père" : "Par mère"}</ChoiceButton>)}
        <label className="ml-auto flex items-center gap-1 text-xs text-gray-500">Trier<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700"><option value="age">Âge</option><option value="poids">Poids</option><option value="naissance">Date de naissance</option><option value="pere">Père</option><option value="mere">Mère</option></select></label>
      </div>
      {view === "liste" ? <div className="space-y-2">{sorted.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} decision={candidateDecisions[candidate.id]} onDecision={(decision) => setCandidateDecisions((current) => ({ ...current, [candidate.id]: decision }))} />)}</div>
        : <div className="space-y-3">{groups.map((group) => <section key={group.key} className="space-y-2"><h3 className="px-1 text-sm font-black text-gray-800">{group.label} — {group.candidates.length} fille{group.candidates.length > 1 ? "s" : ""}</h3>{group.candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} decision={candidateDecisions[candidate.id]} onDecision={(decision) => setCandidateDecisions((current) => ({ ...current, [candidate.id]: decision }))} />)}</section>)}</div>}
    </div>;
  }

  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat value={currentMothers} label="mères actuelles" />
      <Stat value={projection.annualNeed} label="besoin / an" />
      <Stat value={candidates.length} label="candidates" />
      <Stat value={plannedExits} label="sorties prévues" />
    </section>

    <section className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Objectif mères" value={settings.targetMothers} onChange={(value) => setSettings((current) => ({ ...current, targetMothers: value }))} />
        <NumberField label="Renouvellement %" value={settings.renewalRatePercent} onChange={(value) => setSettings((current) => ({ ...current, renewalRatePercent: value }))} />
        <NumberField label="1er vêlage (mois)" value={settings.firstCalvingAgeMonths} onChange={(value) => setSettings((current) => ({ ...current, firstCalvingAgeMonths: value }))} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-gray-500">Hypothèse visible : entrée comme mère à {settings.firstCalvingAgeMonths} mois.</p><button type="button" disabled={saving} onClick={saveSettings} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-green-700 px-3 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> Enregistrer</button></div>
      {message && <p className="mt-1 text-xs font-medium text-gray-600">{message}</p>}
    </section>

    <ToneMessage tone={pilot.tone}>{pilot.text}</ToneMessage>
    <ToneMessage tone={projected.tone}><strong>Projection : {projection.projectedMothers} mères.</strong> {projected.text}</ToneMessage>

    <section className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-gray-900">Candidates actuelles : {candidates.length}</h2><p className="text-xs text-gray-500">Marge initiale : {projection.selectionMargin >= 0 ? "+" : ""}{projection.selectionMargin}</p></div><button type="button" onClick={() => setCompare(true)} className="min-h-10 rounded-lg bg-green-700 px-3 text-sm font-bold text-white">Comparer les candidates</button></div>
      <div className="mt-3 flex flex-wrap gap-2">{years.map((year) => <span key={year} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">Entrées probables {year} · {displayCandidates.filter((candidate) => candidate.entryYear === year).length}</span>)}</div>
    </section>

    <details className="rounded-xl bg-white shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 font-bold text-gray-900">Vaches susceptibles de sortir <span className="flex items-center gap-1 text-sm text-gray-500">{plannedExits} prévue{plannedExits > 1 ? "s" : ""}<ChevronDown size={16} /></span></summary>
      <div className="space-y-2 border-t border-gray-100 p-3">{mothers.map((mother) => <div key={mother.id} className="rounded-lg border border-gray-100 p-2"><p className="font-bold text-gray-900">{mother.nutrav} <span className="font-medium text-gray-600">{mother.name}</span></p><div className="mt-2 flex flex-wrap gap-1.5"><ChoiceButton active={exitDecisions[mother.id] === "DECIDEE"} tone="red" onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "DECIDEE" }))}>Réforme décidée</ChoiceButton><ChoiceButton active={exitDecisions[mother.id] === "A_SURVEILLER"} tone="amber" onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "A_SURVEILLER" }))}>À surveiller</ChoiceButton><ChoiceButton active={exitDecisions[mother.id] === "PAS_PREVUE"} onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "PAS_PREVUE" }))}>Pas prévue</ChoiceButton></div></div>)}</div>
    </details>
    <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">Les choix de sélection et de sortie restent temporaires dans cette vue : aucun animal n’est modifié et aucune réforme n’est enregistrée.</p>
  </div>;
}

function CandidateCard({ candidate, decision, onDecision }: { candidate: RenewalCandidate; decision: RenewalDecision; onDecision: (decision: RenewalDecision) => void }) {
  return <article className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2"><div><h3 className="font-black text-gray-900">{candidate.nutrav} {candidate.name}</h3><p className="text-xs text-gray-500">{candidate.categoryLabel} · entrée probable {candidate.entryYear}</p></div>{candidate.lastWeight !== null && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800"><Scale size={13} /> {candidate.lastWeight} kg</span>}</div>
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700"><p><span className="text-gray-400">Mère :</span> {parentDisplay(candidate.mother, "mother")}</p><p><span className="text-gray-400">Père :</span> {parentDisplay(candidate.father, "father")}</p><p>{ageLabel(candidate.birthDate)}</p><p>{candidate.lastWeightDate ? `Pesée ${date.format(new Date(candidate.lastWeightDate))}` : "Pas de pesée"}</p></div>
    <div className="mt-3 grid grid-cols-3 gap-1.5"><ChoiceButton active={decision === "GARDER"} onClick={() => onDecision("GARDER")}><Check size={12} className="inline" /> Garder</ChoiceButton><ChoiceButton active={decision === "A_REVOIR"} tone="amber" onClick={() => onDecision("A_REVOIR")}>À revoir</ChoiceButton><ChoiceButton active={decision === "SORTIR"} tone="red" onClick={() => onDecision("SORTIR")}>Sortir</ChoiceButton></div>
  </article>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-black text-green-800">{value}</p><p className="text-xs font-medium text-gray-500">{label}</p></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="min-w-0 text-[11px] font-bold text-gray-600">{label}<input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-200 px-2 text-base font-bold text-gray-900 outline-none focus:border-green-600" /></label>; }
