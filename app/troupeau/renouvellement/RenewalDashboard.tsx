"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Save, Scale, Settings } from "lucide-react";
import {
  buildRenewalGenerationProjection,
  calculateAnnualRenewalNeed,
  countRenewalDecisions,
  groupCandidatesByParent,
  parentDisplay,
  renewalGenerationForDate,
  type CowExitDecision,
  type FirstCalvingAverage,
  type MotherAudit,
  type ParentIdentity,
  type RenewalDecision,
  type RenewalSettings,
  type RenewalStage,
} from "@/lib/herd-renewal";

export interface RenewalCandidate {
  id: string;
  nutrav: string;
  name: string | null;
  birthDate: string;
  category: RenewalStage;
  categoryLabel: string;
  entryDate: string;
  entrySource: "EXPECTED_CALVING" | "HISTORICAL_AVERAGE";
  mother: ParentIdentity | null;
  father: ParentIdentity | null;
  lastWeight: number | null;
  lastWeightDate: string | null;
}

export interface RenewalMother { id: string; nutrav: string; name: string | null; category: string; automaticExit: boolean }
const date = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const stageShortLabels: Record<RenewalStage, string> = { PETITE_GENISSE: "Petites", MOYENNE_GENISSE: "Moyennes", GRANDE_GENISSE: "Grandes" };

function ageLabel(birthDate: string) {
  const months = Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / (30.44 * 86400000)));
  return months < 24 ? `${months} mois` : `${Math.floor(months / 12)} ans ${months % 12} mois`;
}

function ChoiceButton({ active, children, onClick, tone = "green", disabled = false }: { active: boolean; children: React.ReactNode; onClick: () => void; tone?: "green" | "amber" | "red"; disabled?: boolean }) {
  const activeClass = tone === "red" ? "border-red-600 bg-red-600 text-white" : tone === "amber" ? "border-amber-500 bg-amber-500 text-white" : "border-green-700 bg-green-700 text-white";
  return <button type="button" disabled={disabled} aria-pressed={active} onClick={onClick} className={`min-h-10 rounded-lg border px-2 py-1 text-xs font-bold transition disabled:opacity-60 ${active ? activeClass : "border-gray-200 bg-white text-gray-600"}`}>{children}</button>;
}

export default function RenewalDashboard({ motherAudit, pipelineCandidates, preselectionCount, mothers, firstCalvingAverage, initialSettings }: { motherAudit: MotherAudit; pipelineCandidates: RenewalCandidate[]; preselectionCount: number; mothers: RenewalMother[]; firstCalvingAverage: FirstCalvingAverage; initialSettings: RenewalSettings }) {
  const petiteCandidates = pipelineCandidates.filter((candidate) => candidate.category === "PETITE_GENISSE");
  const [settings, setSettings] = useState(initialSettings);
  const [candidateDecisions, setCandidateDecisions] = useState<Record<string, RenewalDecision>>(() => Object.fromEntries(petiteCandidates.map((candidate) => [candidate.id, "NON_DECIDEE"])));
  const [exitDecisions, setExitDecisions] = useState<Record<string, CowExitDecision>>(() => Object.fromEntries(mothers.map((mother) => [mother.id, mother.automaticExit ? "DECIDEE" : "PAS_PREVUE"])));
  const [compare, setCompare] = useState(false);
  const [view, setView] = useState<"liste" | "pere" | "mere">("liste");
  const [sort, setSort] = useState<"age" | "poids" | "naissance" | "pere" | "mere">("age");
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const { undecided, kept, review, rejected } = countRenewalDecisions(candidateDecisions);
  const plannedExits = mothers.filter((mother) => exitDecisions[mother.id] === "DECIDEE").length;
  const annualNeed = calculateAnnualRenewalNeed(settings.targetMothers, settings.renewalRatePercent);
  const generationOf = (candidate: RenewalCandidate) => renewalGenerationForDate(candidate.entryDate, settings.renewalGenerationStartMonth);
  const entries = pipelineCandidates.map((candidate) => ({ id: candidate.id, entryDate: candidate.entryDate, included: candidate.category !== "PETITE_GENISSE" || candidateDecisions[candidate.id] === "GARDER" }));
  const generations = buildRenewalGenerationProjection({ currentDate: new Date(), generationStartMonth: settings.renewalGenerationStartMonth, currentMothers: motherAudit.total, targetMothers: settings.targetMothers, entries, identifiedExitsCurrentGeneration: plannedExits });
  const selectionGap = petiteCandidates.length - annualNeed;

  const sorted = useMemo(() => [...petiteCandidates].sort((a, b) => {
    if (sort === "poids") return (b.lastWeight ?? -1) - (a.lastWeight ?? -1);
    if (sort === "naissance") return a.birthDate.localeCompare(b.birthDate);
    if (sort === "pere") return parentDisplay(a.father, "father").localeCompare(parentDisplay(b.father, "father"), "fr");
    if (sort === "mere") return parentDisplay(a.mother, "mother").localeCompare(parentDisplay(b.mother, "mother"), "fr");
    return a.birthDate.localeCompare(b.birthDate);
  }), [petiteCandidates, sort]);
  const groups = view === "pere" ? groupCandidatesByParent(sorted, (candidate) => candidate.father, "Père inconnu") : groupCandidatesByParent(sorted, (candidate) => candidate.mother, "Mère inconnue");

  async function saveSettings() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/renouvellement-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false); setMessage(response.ok ? "Réglages enregistrés." : "Impossible d’enregistrer les réglages.");
  }

  if (compare) return <div className="space-y-3">
    <button type="button" onClick={() => setCompare(false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-gray-700 shadow-sm"><ArrowLeft size={16} /> Renouvellement</button>
    <div className="sticky top-2 z-20 rounded-xl border border-green-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between"><strong>{petiteCandidates.length} petites génisses</strong><span className="text-xs text-gray-500">Repère : {annualNeed}</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs"><span className="rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-700">{undecided} à décider</span><span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-800">{kept} gardée{kept > 1 ? "s" : ""}</span><span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800">{review} à revoir</span><span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-800">{rejected} sortie{rejected > 1 ? "s" : ""}</span></div>
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm">
      {(["liste", "pere", "mere"] as const).map((item) => <ChoiceButton key={item} active={view === item} onClick={() => setView(item)}>{item === "liste" ? "Candidates" : item === "pere" ? "Par père" : "Par mère"}</ChoiceButton>)}
      <label className="ml-auto flex items-center gap-1 text-xs text-gray-500">Trier<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700"><option value="age">Âge</option><option value="poids">Poids</option><option value="naissance">Naissance</option><option value="pere">Père</option><option value="mere">Mère</option></select></label>
    </div>
    {view === "liste" ? <div className="space-y-2">{sorted.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} decision={candidateDecisions[candidate.id]} onDecision={(decision) => setCandidateDecisions((current) => ({ ...current, [candidate.id]: decision }))} />)}</div>
      : <div className="space-y-3">{groups.map((group) => <section key={group.key} className="space-y-2"><h3 className="px-1 text-sm font-black text-gray-800">{group.label} — {group.candidates.length} fille{group.candidates.length > 1 ? "s" : ""}</h3>{group.candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} decision={candidateDecisions[candidate.id]} onDecision={(decision) => setCandidateDecisions((current) => ({ ...current, [candidate.id]: decision }))} />)}</section>)}</div>}
  </div>;

  return <div className="space-y-3">
    <section className="rounded-2xl bg-gradient-to-br from-emerald-900 to-green-700 p-3 text-white shadow-sm">
      <div className="grid grid-cols-3 divide-x divide-white/20 text-center"><DashboardNumber value={motherAudit.total} label="Mères" /><DashboardNumber value={plannedExits} label="À sortir" /><DashboardNumber value={annualNeed} label="Renouvellement" suffix="/ génération" /></div>
      <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2 text-xs text-emerald-50"><span>Objectif : <strong>{settings.targetMothers}</strong></span><details className="relative"><summary className="cursor-pointer list-none rounded-full bg-white/15 px-2.5 py-1 font-bold"><Settings size={13} className="mr-1 inline" />Réglages</summary><div className="absolute right-0 z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-xl bg-white p-3 text-gray-800 shadow-xl"><div className="grid grid-cols-2 gap-2"><NumberField label="Objectif mères" value={settings.targetMothers} onChange={(value) => setSettings((current) => ({ ...current, targetMothers: value }))} /><NumberField label="Renouvellement %" value={settings.renewalRatePercent} onChange={(value) => setSettings((current) => ({ ...current, renewalRatePercent: value }))} /></div><label className="mt-3 block text-[11px] font-bold text-gray-600">Début de la campagne de renouvellement<select value={settings.renewalGenerationStartMonth} onChange={(event) => setSettings((current) => ({ ...current, renewalGenerationStartMonth: Number(event.target.value) }))} className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold text-gray-900">{monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><button type="button" disabled={saving} onClick={saveSettings} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-green-700 px-3 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> Enregistrer</button>{message && <p className="mt-1 text-center text-xs font-medium text-gray-600">{message}</p>}</div></details></div>
    </section>

    <section className="rounded-2xl border border-lime-200 bg-lime-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-lime-800">Sélection en cours</p><div className="mt-1 flex items-end justify-between gap-3"><div><strong className="text-2xl font-black text-gray-950">{petiteCandidates.length}</strong><span className="ml-1 text-sm font-bold text-gray-700">petites génisses</span><p className="text-xs text-gray-600">Repère : {annualNeed}</p></div><button type="button" onClick={() => setCompare(true)} className="min-h-10 rounded-xl bg-green-700 px-4 text-sm font-black text-white">Comparer</button></div><p className={`mt-2 text-sm font-bold ${selectionGap < 0 ? "text-red-700" : selectionGap > 0 ? "text-orange-700" : "text-green-700"}`}>{selectionGap > 0 ? `${selectionGap} à écarter environ` : selectionGap < 0 ? `${Math.abs(selectionGap)} candidate${Math.abs(selectionGap) > 1 ? "s" : ""} manquante${Math.abs(selectionGap) > 1 ? "s" : ""}` : "Repère atteint"}</p></section>

    <section className="rounded-xl bg-white p-3 shadow-sm"><p className="text-sm font-black text-gray-900">Mères présentes : {motherAudit.total}</p><p className="text-xs text-gray-500">1er vêlage typique : <strong>{firstCalvingAverage.medianMonths.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mois</strong> · {firstCalvingAverage.sampleSize} référence{firstCalvingAverage.sampleSize > 1 ? "s" : ""}</p><details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-green-700">Voir le détail</summary><div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-50 p-2 text-gray-600"><span>Vaches</span><strong className="text-right">{motherAudit.cows}</strong><span>À engraisser</span><strong className="text-right">{motherAudit.toFatten}</strong><span>En engraissement</span><strong className="text-right">{motherAudit.fattening}</strong><span>Moyenne 1er vêlage</span><strong className="text-right">{firstCalvingAverage.averageMonths.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mois</strong>{motherAudit.inconsistentIds.length > 0 && <><span className="text-red-700">Incohérences à vérifier</span><strong className="text-right text-red-700">{motherAudit.inconsistentIds.length}</strong></>}</div>{firstCalvingAverage.fallback && <p className="mt-1 text-gray-500">Faute de références fiables, l’estimation utilise 36 mois.</p>}</details></section>

    <section><div className="mb-2 flex items-center justify-between"><h2 className="font-black text-gray-900">Mes générations</h2><span className="text-[11px] text-gray-500">Campagne dès {monthNames[settings.renewalGenerationStartMonth - 1].toLowerCase()}</span></div><div className="flex snap-x gap-2 overflow-x-auto pb-1">{generations.map((generation) => { const candidates = petiteCandidates.filter((candidate) => generationOf(candidate) === generation.generation).length; const isSelection = candidates > 0 && generation.entries === 0; return <button key={generation.generation} type="button" onClick={() => setSelectedGeneration(selectedGeneration === generation.generation ? null : generation.generation)} className={`min-w-[10.5rem] snap-start rounded-xl border p-3 text-left shadow-sm ${selectedGeneration === generation.generation ? "border-green-600 bg-green-50" : "border-gray-100 bg-white"}`}><span className="text-[11px] font-black uppercase text-gray-500">Gén. {generation.generation}</span><p className="mt-1 text-lg font-black text-gray-950">{isSelection ? `${candidates} candidates` : `${generation.entries} futures mères`}</p><p className={`mt-1 text-xs font-bold ${generation.remainingExits > 0 ? "text-orange-700" : "text-green-700"}`}>{isSelection ? "Sélection en cours" : generation.remainingExits > 0 ? `${generation.remainingExits} sorties à prévoir` : "Équilibre identifié"}</p><span className="mt-2 inline-flex items-center text-[11px] text-gray-500">Détail <ChevronRight size={12} /></span></button>; })}</div>{selectedGeneration !== null && <GenerationDetail generation={selectedGeneration} candidates={pipelineCandidates.filter((candidate) => generationOf(candidate) === selectedGeneration)} summary={generations.find((generation) => generation.generation === selectedGeneration)} startMonth={settings.renewalGenerationStartMonth} />}</section>

    <section className="rounded-xl bg-white p-3 shadow-sm"><div className="flex items-center gap-1 text-center"><PipelineStep label="Petites" value={petiteCandidates.length} /><ChevronRight size={16} className="shrink-0 text-gray-300" /><PipelineStep label="Moyennes" value={pipelineCandidates.filter((candidate) => candidate.category === "MOYENNE_GENISSE").length} /><ChevronRight size={16} className="shrink-0 text-gray-300" /><PipelineStep label="Grandes" value={pipelineCandidates.filter((candidate) => candidate.category === "GRANDE_GENISSE").length} /><ChevronRight size={16} className="shrink-0 text-gray-300" /><PipelineStep label="Vaches" value={motherAudit.total} /></div>{preselectionCount > 0 && <p className="mt-2 text-center text-[11px] font-semibold text-amber-700">Présélections à venir : {preselectionCount}</p>}</section>

    <details className="rounded-xl bg-white shadow-sm"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 font-bold text-gray-900">Vaches susceptibles de sortir <span className="text-sm text-gray-500">{plannedExits} prévue{plannedExits > 1 ? "s" : ""}</span></summary><div className="space-y-2 border-t border-gray-100 p-3">{mothers.map((mother) => <div key={mother.id} className="rounded-lg border border-gray-100 p-2"><div className="flex items-center justify-between gap-2"><p className="font-bold text-gray-900">{mother.nutrav} <span className="font-medium text-gray-600">{mother.name}</span></p>{mother.automaticExit && <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">Sortie prévue</span>}</div><div className="mt-2 flex flex-wrap gap-1.5"><ChoiceButton disabled={mother.automaticExit} active={exitDecisions[mother.id] === "DECIDEE"} tone="red" onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "DECIDEE" }))}>Réforme décidée</ChoiceButton><ChoiceButton disabled={mother.automaticExit} active={exitDecisions[mother.id] === "A_SURVEILLER"} tone="amber" onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "A_SURVEILLER" }))}>À surveiller</ChoiceButton><ChoiceButton disabled={mother.automaticExit} active={exitDecisions[mother.id] === "PAS_PREVUE"} onClick={() => setExitDecisions((current) => ({ ...current, [mother.id]: "PAS_PREVUE" }))}>Pas prévue</ChoiceButton></div></div>)}</div></details>
    <p className="px-2 text-center text-[11px] text-gray-500">Les choix restent temporaires : aucun animal n’est modifié.</p>
  </div>;
}

function CandidateCard({ candidate, decision, onDecision }: { candidate: RenewalCandidate; decision: RenewalDecision; onDecision: (decision: RenewalDecision) => void }) { return <article className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h3 className="font-black text-gray-900">{candidate.nutrav} {candidate.name}</h3><p className="text-xs text-gray-500">Entrée estimée {date.format(new Date(candidate.entryDate))}</p></div>{candidate.lastWeight !== null && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800"><Scale size={13} /> {candidate.lastWeight} kg</span>}</div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700"><p><span className="text-gray-400">Mère :</span> {parentDisplay(candidate.mother, "mother")}</p><p><span className="text-gray-400">Père :</span> {parentDisplay(candidate.father, "father")}</p><p>{ageLabel(candidate.birthDate)}</p><p>{candidate.lastWeightDate ? `Pesée ${date.format(new Date(candidate.lastWeightDate))}` : "Pas de pesée"}</p></div>{decision === "NON_DECIDEE" && <p className="mt-2 text-xs font-bold text-gray-500">À décider</p>}<div className="mt-2 grid grid-cols-3 gap-1.5"><ChoiceButton active={decision === "GARDER"} onClick={() => onDecision("GARDER")}><Check size={12} className="inline" /> Garder</ChoiceButton><ChoiceButton active={decision === "A_REVOIR"} tone="amber" onClick={() => onDecision("A_REVOIR")}>À revoir</ChoiceButton><ChoiceButton active={decision === "SORTIR"} tone="red" onClick={() => onDecision("SORTIR")}>Sortir</ChoiceButton></div></article>; }
function GenerationDetail({ generation, candidates, summary, startMonth }: { generation: number; candidates: RenewalCandidate[]; summary: ReturnType<typeof buildRenewalGenerationProjection>[number] | undefined; startMonth: number }) { const endMonth = startMonth === 1 ? 12 : startMonth - 1; const endYear = startMonth === 1 ? generation : generation + 1; return <div className="mt-2 rounded-xl border border-green-100 bg-white p-3 text-xs shadow-sm"><p className="font-black text-gray-900">Génération {generation}</p><p className="text-gray-500">Du 1er {monthNames[startMonth - 1].toLowerCase()} {generation} au dernier jour de {monthNames[endMonth - 1].toLowerCase()} {endYear}</p><div className="mt-2 flex flex-wrap gap-1.5">{(["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE"] as RenewalStage[]).map((stage) => <span key={stage} className="rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-700">{stageShortLabels[stage]} {candidates.filter((candidate) => candidate.category === stage).length}</span>)}</div>{summary && <p className="mt-2 text-gray-700">{summary.entries} entrée{summary.entries > 1 ? "s" : ""} retenue{summary.entries > 1 ? "s" : ""} · {summary.identifiedExits} sortie{summary.identifiedExits > 1 ? "s" : ""} identifiée{summary.identifiedExits > 1 ? "s" : ""} · <strong>{summary.remainingExits} encore à prévoir</strong></p>}</div>; }
function DashboardNumber({ value, label, suffix }: { value: number; label: string; suffix?: string }) { return <div className="px-1"><p className="text-[10px] font-black uppercase tracking-wide text-emerald-100">{label}</p><p className="text-2xl font-black">{value}</p>{suffix && <p className="text-[9px] text-emerald-100">{suffix}</p>}</div>; }
function PipelineStep({ label, value }: { label: string; value: number }) { return <div className="min-w-0 flex-1"><p className="text-lg font-black text-gray-900">{value}</p><p className="truncate text-[10px] font-bold text-gray-500">{label}</p></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="min-w-0 text-[11px] font-bold text-gray-600">{label}<input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-200 px-2 text-base font-bold text-gray-900 outline-none focus:border-green-600" /></label>; }
