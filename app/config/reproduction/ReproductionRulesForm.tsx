"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  CESAM_REPRODUCTION_RULES,
  REPRODUCTION_COLOR_PALETTE,
  validateReproductionRules,
  type AnimalCategory,
  type ExistingReproductionAction,
  type ReproductionActionWindow,
  type ReproductionEventRule,
  type ReproductionPhaseRule,
  type ReproductionPriority,
  type ReproductionReference,
  type ReproductionRulesConfig,
  type ReproductionUnit,
} from "@/lib/reproduction-rules";

const PRIORITIES: Array<[ReproductionPriority, string]> = [["LOW", "Faible"], ["NORMAL", "Normale"], ["HIGH", "Haute"], ["URGENT", "Urgente"]];
const ACTIONS: Array<[ExistingReproductionAction, string]> = [
  ["NONE", "Aucune"], ["RECORD_BREEDING", "Enregistrer saillie / IA"], ["RECORD_ECHO", "Saisir l’écho"],
  ["VIEW_FOLLOW_UP", "Voir le suivi"], ["PREPARE_CALVING", "Préparer le vêlage"], ["RECORD_CALVING", "Enregistrer le vêlage"], ["RECORD_HEALTH_EVENT", "Événement sanitaire"],
];
const REFERENCES: Array<[ReproductionReference, string]> = [
  ["CALVING", "Vêlage"], ["BREEDING", "Saillie / IA"], ["POSITIVE_ECHO", "Échographie positive"],
  ["EXPECTED_CALVING", "Vêlage prévu"], ["BIRTH", "Naissance"], ["CUSTOM_DATE", "Date personnalisée"],
];
const UNITS: Array<[ReproductionUnit, string]> = [["DAYS", "jours"], ["WEEKS", "semaines"], ["MONTHS", "mois"]];
const CATEGORIES: Array<[AnimalCategory, string]> = [["ALL", "Toutes"], ["COW", "Vaches"], ["HEIFER", "Génisses"]];

function copyDefaults(): ReproductionRulesConfig {
  return JSON.parse(JSON.stringify(CESAM_REPRODUCTION_RULES)) as ReproductionRulesConfig;
}

function SectionHeader({ title, summary, onRestore }: { title: string; summary: string; onRestore: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{summary}</p></div>
      <button type="button" onClick={onRestore} className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><RotateCcw size={14} /> Restaurer</button>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-green-700" /></label>;
}

export default function ReproductionRulesForm({ initial }: { initial: ReproductionRulesConfig }) {
  const [config, setConfig] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const validation = useMemo(() => validateReproductionRules(config), [config]);

  function restoreSection(section: "phases" | "alerts" | "actionWindows" | "events") {
    if (!window.confirm("Restaurer les valeurs CESAM de ce bloc ? Les personnalisations de ce bloc seront remplacées après enregistrement.")) return;
    const defaults = copyDefaults();
    setConfig((current) => ({ ...current, [section]: defaults[section] }));
    setMessage("Valeurs CESAM restaurées localement. Enregistrez pour confirmer.");
  }

  function updatePhase(id: string, patch: Partial<ReproductionPhaseRule>) {
    setConfig((current) => ({ ...current, phases: current.phases.map((phase) => phase.id === id ? { ...phase, ...patch } : phase) }));
  }

  async function save() {
    if (validation.errors.length > 0) { setMessage(validation.errors[0]); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/reproduction-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible");
      setConfig(result.config);
      setMessage(result.warnings?.length ? `Enregistré · ${result.warnings[0]}` : "Règles de reproduction enregistrées.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible"); }
    finally { setSaving(false); }
  }

  function addWindow() {
    const windowRule: ReproductionActionWindow = { id: crypto.randomUUID(), fundamental: false, name: "Nouvelle fenêtre", reference: "CALVING", direction: "AFTER", start: 0, end: null, unit: "DAYS", categories: ["ALL"], priority: "NORMAL", showOnHome: false, showOnCycle: false, action: "NONE" };
    setConfig((current) => ({ ...current, actionWindows: [...current.actionWindows, windowRule] }));
  }

  function updateWindow(id: string, patch: Partial<ReproductionActionWindow>) {
    setConfig((current) => ({ ...current, actionWindows: current.actionWindows.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function addEvent() {
    const event: ReproductionEventRule = { id: crypto.randomUUID(), fundamental: false, name: "Nouvel événement", icon: "calendar", color: "gray", fields: ["date", "observation"], showOnCycle: false, createsReminder: false };
    setConfig((current) => ({ ...current, events: [...current.events, event] }));
  }

  function updateEvent(id: string, patch: Partial<ReproductionEventRule>) {
    setConfig((current) => ({ ...current, events: current.events.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900">Ces réglages seront utilisés par le cycle reproductif, les alertes, les listes et l’accueil.</div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader title="Durées principales" summary={`${config.phases.length} phases fondamentales · aucune suppression possible`} onRestore={() => restoreSection("phases")} />
        <div className="mt-3 space-y-2">
          {config.phases.map((phase) => (
            <details key={phase.id} className="group rounded-xl border border-slate-200 bg-white open:bg-slate-50">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: REPRODUCTION_COLOR_PALETTE[phase.color].value }} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{phase.displayedName}</span>
                <span className="text-xs font-semibold text-slate-400">{phase.start}{phase.end === null ? "+" : `–${phase.end}`} j</span><ChevronDown size={16} className="text-slate-400 group-open:rotate-180" />
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
                {advanced && <label className="text-xs font-semibold text-slate-500">Nom affiché<input value={phase.displayedName} onChange={(event) => updatePhase(phase.id, { displayedName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900" /></label>}
                <label className="text-xs font-semibold text-slate-500">Couleur<select value={phase.color} onChange={(event) => updatePhase(phase.id, { color: event.target.value as ReproductionPhaseRule["color"] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900">{Object.entries(REPRODUCTION_COLOR_PALETTE).map(([key, color]) => <option key={key} value={key}>{color.label}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-500">Début<input type="number" min={0} value={phase.start} onChange={(event) => updatePhase(phase.id, { start: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-500">Fin éventuelle<input type="number" min={0} value={phase.end ?? ""} onChange={(event) => updatePhase(phase.id, { end: event.target.value === "" ? null : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Sans fin" /></label>
                {advanced && <>
                  <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Message principal<input value={phase.mainMessage} onChange={(event) => updatePhase(phase.id, { mainMessage: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Priorité<select value={phase.priority} onChange={(event) => updatePhase(phase.id, { priority: event.target.value as ReproductionPriority })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-500">Action existante<select value={phase.action} onChange={(event) => updatePhase(phase.id, { action: event.target.value as ExistingReproductionAction })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <Toggle label="Visible sur l’accueil" checked={phase.showOnHome} onChange={(showOnHome) => updatePhase(phase.id, { showOnHome })} />
                </>}
                <Toggle label="Alerte active" checked={phase.enabledAlert} onChange={(enabledAlert) => updatePhase(phase.id, { enabledAlert })} />
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader title="Alertes" summary={`${Object.values(config.alerts).filter(Boolean).length} alertes actives`} onRestore={() => restoreSection("alerts")} />
        <details className="mt-3" open><summary className="cursor-pointer text-sm font-bold text-slate-700">Activation des alertes</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Toggle label="Retard de reproduction" checked={config.alerts.reproductionDelay} onChange={(value) => setConfig((current) => ({ ...current, alerts: { ...current.alerts, reproductionDelay: value } }))} />
          <Toggle label="Échographie à réaliser" checked={config.alerts.echoDue} onChange={(value) => setConfig((current) => ({ ...current, alerts: { ...current.alerts, echoDue: value } }))} />
          <Toggle label="Vêlage imminent" checked={config.alerts.imminentCalving} onChange={(value) => setConfig((current) => ({ ...current, alerts: { ...current.alerts, imminentCalving: value } }))} />
          <Toggle label="Tarissement" checked={config.alerts.dryOff} onChange={(value) => setConfig((current) => ({ ...current, alerts: { ...current.alerts, dryOff: value } }))} />
        </div></details>
      </section>

      <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700"><SlidersHorizontal size={18} /> {advanced ? "Masquer les paramètres avancés" : "Paramètres avancés"}</button>

      {advanced && <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader title="Fenêtres d’action" summary={`${config.actionWindows.length} fenêtre${config.actionWindows.length > 1 ? "s" : ""}`} onRestore={() => restoreSection("actionWindows")} />
          <div className="mt-3 space-y-3">{config.actionWindows.map((item) => <details key={item.id} className="rounded-xl border border-slate-200" open={!item.fundamental}><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold text-slate-800"><span className="flex-1">{item.name}</span>{item.fundamental && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Fondamentale</span>}<ChevronDown size={16} /></summary><div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Nom<input value={item.name} onChange={(event) => updateWindow(item.id, { name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-500">Référence<select value={item.reference} onChange={(event) => updateWindow(item.id, { reference: event.target.value as ReproductionReference })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{REFERENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Position<select value={item.direction} onChange={(event) => updateWindow(item.id, { direction: event.target.value as "BEFORE" | "AFTER" })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"><option value="AFTER">Après</option><option value="BEFORE">Avant</option></select></label>
            <label className="text-xs font-semibold text-slate-500">Unité<select value={item.unit} onChange={(event) => updateWindow(item.id, { unit: event.target.value as ReproductionUnit })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Début<input type="number" min={0} value={item.start} onChange={(event) => updateWindow(item.id, { start: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-500">Fin<input type="number" min={0} value={item.end ?? ""} onChange={(event) => updateWindow(item.id, { end: event.target.value === "" ? null : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" placeholder="Sans fin" /></label>
            <label className="text-xs font-semibold text-slate-500">Catégorie<select value={item.categories[0] ?? "ALL"} onChange={(event) => updateWindow(item.id, { categories: [event.target.value as AnimalCategory] })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Action<select value={item.action} onChange={(event) => updateWindow(item.id, { action: event.target.value as ExistingReproductionAction })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <Toggle label="Afficher sur l’accueil" checked={item.showOnHome} onChange={(showOnHome) => updateWindow(item.id, { showOnHome })} /><Toggle label="Afficher sur le cercle" checked={item.showOnCycle} onChange={(showOnCycle) => updateWindow(item.id, { showOnCycle })} />
            {!item.fundamental && <button type="button" onClick={() => setConfig((current) => ({ ...current, actionWindows: current.actionWindows.filter((windowRule) => windowRule.id !== item.id) }))} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-bold text-red-700 sm:col-span-2"><Trash2 size={16} /> Supprimer cette fenêtre</button>}
          </div></details>)}</div>
          <button type="button" onClick={addWindow} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-green-400 text-sm font-bold text-green-700"><Plus size={17} /> Ajouter une fenêtre</button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader title="Événements personnalisés" summary={`${config.events.filter((event) => !event.fundamental).length} événement(s) secondaire(s)`} onRestore={() => restoreSection("events")} />
          <div className="mt-3 space-y-2">{config.events.map((item) => <details key={item.id} className="rounded-xl border border-slate-200"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold"><span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: REPRODUCTION_COLOR_PALETTE[item.color].value }} /><span className="flex-1">{item.name}</span>{item.fundamental && <span className="text-[10px] text-slate-400">Fondamental</span>}<ChevronDown size={16} /></summary><div className="grid gap-3 border-t p-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Nom<input value={item.name} onChange={(event) => updateEvent(item.id, { name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-500">Icône<select value={item.icon} onChange={(event) => updateEvent(item.id, { icon: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"><option value="calendar">Calendrier</option><option value="syringe">Seringue</option><option value="pill">Médicament</option><option value="scan">Échographie</option><option value="eye">Surveillance</option><option value="heart">Cœur</option></select></label>
            <label className="text-xs font-semibold text-slate-500">Couleur<select value={item.color} onChange={(event) => updateEvent(item.id, { color: event.target.value as ReproductionEventRule["color"] })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{Object.entries(REPRODUCTION_COLOR_PALETTE).map(([key, color]) => <option key={key} value={key}>{color.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Champs demandés<input value={item.fields.join(", ")} onChange={(event) => updateEvent(item.id, { fields: event.target.value.split(",").map((field) => field.trim()).filter(Boolean) })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>
            <Toggle label="Afficher sur le cercle" checked={item.showOnCycle} onChange={(showOnCycle) => updateEvent(item.id, { showOnCycle })} /><Toggle label="Créer un rappel" checked={item.createsReminder} onChange={(createsReminder) => updateEvent(item.id, { createsReminder })} />
            {!item.fundamental && <button type="button" onClick={() => setConfig((current) => ({ ...current, events: current.events.filter((event) => event.id !== item.id) }))} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-bold text-red-700 sm:col-span-2"><Trash2 size={16} /> Supprimer cet événement</button>}
          </div></details>)}</div>
          <button type="button" onClick={addEvent} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-green-400 text-sm font-bold text-green-700"><Plus size={17} /> Ajouter un événement secondaire</button>
          <details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">Règles par catégorie</summary><p className="mt-2 text-xs text-slate-500">La structure est prête pour les vaches et les génisses. Les exceptions individuelles ne sont pas activées.</p><button type="button" onClick={() => setConfig((current) => ({ ...current, categoryRules: [...current.categoryRules, { id: crypto.randomUUID(), category: "HEIFER", phaseId: "breeding_period" }] }))} className="mt-2 min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700">Ajouter une exception de catégorie</button>{config.categoryRules.map((rule) => <div key={rule.id} className="mt-2 flex items-center gap-2 rounded-lg border bg-white p-2"><select value={rule.category} onChange={(event) => setConfig((current) => ({ ...current, categoryRules: current.categoryRules.map((item) => item.id === rule.id ? { ...item, category: event.target.value as AnimalCategory } : item) }))} className="min-h-10 flex-1 rounded border px-2 text-xs">{CATEGORIES.filter(([value]) => value !== "ALL").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={rule.phaseId} onChange={(event) => setConfig((current) => ({ ...current, categoryRules: current.categoryRules.map((item) => item.id === rule.id ? { ...item, phaseId: event.target.value } : item) }))} className="min-h-10 flex-1 rounded border px-2 text-xs">{config.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.displayedName}</option>)}</select><button type="button" onClick={() => setConfig((current) => ({ ...current, categoryRules: current.categoryRules.filter((item) => item.id !== rule.id) }))} className="min-h-10 px-2 text-red-600"><Trash2 size={16} /></button></div>)}</details>
        </section>
      </>}

      {(validation.errors.length > 0 || validation.warnings.length > 0 || message) && <div className={`rounded-xl border p-3 text-sm ${validation.errors.length ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><div className="flex gap-2"><AlertTriangle size={18} className="shrink-0" /><div>{validation.errors.map((error) => <p key={error}>{error}</p>)}{validation.warnings.map((warning) => <p key={warning}>{warning}</p>)}{message && <p>{message}</p>}</div></div></div>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" onClick={save} disabled={saving || validation.errors.length > 0} className="mx-auto flex min-h-12 w-full max-w-4xl items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-50"><Save size={18} /> {saving ? "Enregistrement…" : "Enregistrer les règles"}</button>
      </div>
    </div>
  );
}
