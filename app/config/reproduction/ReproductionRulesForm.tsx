"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  CESAM_REPRODUCTION_RULES,
  EVENT_FIELD_CATALOG,
  REPRODUCTION_COLOR_PALETTE,
  describeActionWindow,
  describeEchoTiming,
  describeHeatReturnMonitoring,
  describePhaseRule,
  validateReproductionRules,
  type AnimalCategory,
  type ExistingReproductionAction,
  type ReproductionActionWindow,
  type ReproductionEventRule,
  type ReproductionEventField,
  type EventFieldKey,
  type PhaseEndType,
  type PhaseStartCondition,
  type ReproductionPosition,
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
  ["RECORD_MEDICATION", "Médicament"], ["RECORD_VACCINE", "Vaccin"], ["RECORD_TREATMENT", "Traitement"],
];
const REFERENCES: Array<[ReproductionReference, string]> = [
  ["CALVING", "Vêlage"], ["BREEDING", "Saillie / IA"], ["POSITIVE_ECHO", "Échographie positive"],
  ["NEGATIVE_ECHO", "Échographie négative"], ["ANY_ECHO", "Échographie positive ou négative"], ["EXPECTED_CALVING", "Vêlage prévu"], ["BIRTH", "Naissance"], ["CUSTOM_DATE", "Date personnalisée"],
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

function EchoTimingFields({ timing, onChange }: {
  timing: ReproductionRulesConfig["echoTiming"];
  onChange: (timing: ReproductionRulesConfig["echoTiming"]) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle label="Utiliser une phase préparatoire" checked={timing.usePreparationPhase} onChange={(usePreparationPhase) => onChange({ ...timing, usePreparationPhase })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {timing.usePreparationPhase && (
          <label className="text-xs font-semibold text-slate-600">
            Afficher les femelles dans la liste des échos à partir de
            <span className="mt-1 flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3">
              <input type="number" min={0} value={timing.listFromDays} onChange={(event) => onChange({ ...timing, listFromDays: Math.max(0, Number(event.target.value)) })} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
              <span className="text-xs text-slate-500">jours après saillie / IA</span>
            </span>
          </label>
        )}
        <label className="text-xs font-semibold text-slate-600">
          Considérer comme « À échographier » à partir de
          <span className="mt-1 flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3">
            <input type="number" min={0} value={timing.dueFromDays} onChange={(event) => onChange({ ...timing, dueFromDays: Math.max(0, Number(event.target.value)) })} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
            <span className="text-xs text-slate-500">jours après saillie / IA</span>
          </span>
        </label>
      </div>
      {timing.usePreparationPhase && (
        <p className="text-xs text-slate-500">Entre les deux seuils : « Bientôt prête pour l’échographie », avec un compte à rebours comme « Prête dans 5 jours ».</p>
      )}
      {timing.usePreparationPhase && timing.listFromDays > timing.dueFromDays && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">Le seuil d’apparition doit être inférieur ou égal au seuil « À échographier ».</p>
      )}
      <p className="rounded-lg bg-yellow-50 p-3 text-sm font-semibold leading-5 text-yellow-900">{describeEchoTiming(timing)}</p>
    </div>
  );
}

export default function ReproductionRulesForm({ initial }: { initial: ReproductionRulesConfig }) {
  const [config, setConfig] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const validation = useMemo(() => validateReproductionRules(config), [config]);

  function restoreSection(section: "phases" | "echoTiming" | "heatReturnMonitoring" | "alerts" | "actionWindows" | "events") {
    if (!window.confirm("Restaurer les valeurs CESAM de ce bloc ? Les personnalisations de ce bloc seront remplacées après enregistrement.")) return;
    const defaults = copyDefaults();
    setConfig((current) => ({ ...current, [section]: defaults[section] }));
    setMessage("Valeurs CESAM restaurées localement. Enregistrez pour confirmer.");
  }

  function updatePhase(id: string, patch: Partial<ReproductionPhaseRule>) {
    setConfig((current) => ({ ...current, phases: current.phases.map((phase) => phase.id === id ? { ...phase, ...patch } : phase) }));
  }

  function primaryValue(phase: ReproductionPhaseRule) {
    return phase.endRule.type === "AFTER_DURATION" ? phase.endRule.duration ?? 0 : phase.startRule.offset;
  }

  function updatePrimaryValue(phase: ReproductionPhaseRule, value: number) {
    if (phase.endRule.type === "AFTER_DURATION") updatePhase(phase.id, { endRule: { ...phase.endRule, duration: value } });
    else updatePhase(phase.id, { startRule: { ...phase.startRule, offset: value } });
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
    const event: ReproductionEventRule = { id: crypto.randomUUID(), fundamental: false, name: "Nouvel événement", icon: "calendar", color: "gray", fields: [], showOnCycle: false, createsReminder: false, action: "NONE" };
    setConfig((current) => ({ ...current, events: [...current.events, event] }));
  }

  function updateEvent(id: string, patch: Partial<ReproductionEventRule>) {
    setConfig((current) => ({ ...current, events: current.events.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function addEventField(eventId: string, key: EventFieldKey) {
    const definition = EVENT_FIELD_CATALOG.find((item) => item.key === key);
    if (!definition) return;
    const newField: ReproductionEventField = { id: crypto.randomUUID(), key, label: definition.label, dataType: definition.dataType, required: false, locked: false, order: 999 };
    setConfig((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? (key !== "CUSTOM" && event.fields.some((field) => field.key === key) ? event : { ...event, fields: [...event.fields, newField].map((field, order) => ({ ...field, order })) }) : event) }));
  }

  function updateEventField(eventId: string, fieldId: string, patch: Partial<ReproductionEventField>) {
    setConfig((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, fields: event.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) } : event) }));
  }

  function moveEventField(eventId: string, fieldId: string, direction: -1 | 1) {
    setConfig((current) => ({ ...current, events: current.events.map((event) => {
      if (event.id !== eventId) return event;
      const fields = [...event.fields].sort((left, right) => left.order - right.order);
      const index = fields.findIndex((field) => field.id === fieldId); const target = index + direction;
      if (index < 0 || target < 0 || target >= fields.length) return event;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...event, fields: fields.map((field, order) => ({ ...field, order })) };
    }) }));
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900">Ces réglages seront utilisés par le cycle reproductif, les alertes, les listes et l’accueil.</div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader title="Durées principales" summary={`${config.phases.length} phases fondamentales · aucune suppression possible`} onRestore={() => restoreSection("phases")} />
        <div className="mt-3 space-y-2">
          {config.phases.map((phase) => (
            <details key={phase.id} className="group rounded-xl border border-slate-200 bg-white open:bg-slate-50">
              <summary className="min-h-12 cursor-pointer list-none px-3 py-2.5">
                <span className="flex items-center gap-3"><span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: REPRODUCTION_COLOR_PALETTE[phase.color].value }} /><span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{phase.displayedName}</span><ChevronDown size={16} className="shrink-0 text-slate-400 group-open:rotate-180" /></span>
                <span className="mt-1 block pl-7 text-xs leading-relaxed text-slate-500">{phase.id === "echo_due" ? describeEchoTiming(config.echoTiming) : describePhaseRule(phase, config.phases)}</span>
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500">Nom affiché<input value={phase.displayedName} onChange={(event) => updatePhase(phase.id, { displayedName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900" /></label>
                <label className="text-xs font-semibold text-slate-500">Couleur<select value={phase.color} onChange={(event) => updatePhase(phase.id, { color: event.target.value as ReproductionPhaseRule["color"] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900">{Object.entries(REPRODUCTION_COLOR_PALETTE).map(([key, color]) => <option key={key} value={key}>{color.label}</option>)}</select></label>
                {phase.id === "echo_due" ? (
                  <div className="sm:col-span-2">
                    <EchoTimingFields timing={config.echoTiming} onChange={(echoTiming) => setConfig((current) => ({ ...current, echoTiming }))} />
                  </div>
                ) : <>
                  <label className="text-xs font-semibold text-slate-500">Durée ou seuil principal<input type="number" min={0} value={primaryValue(phase)} onChange={(event) => updatePrimaryValue(phase, Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Unité<select value={phase.endRule.type === "AFTER_DURATION" ? phase.endRule.unit ?? "DAYS" : phase.startRule.unit} onChange={(event) => phase.endRule.type === "AFTER_DURATION" ? updatePhase(phase.id, { endRule: { ...phase.endRule, unit: event.target.value as ReproductionUnit } }) : updatePhase(phase.id, { startRule: { ...phase.startRule, unit: event.target.value as ReproductionUnit } })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">{UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </>}
                {advanced && <>
                  {phase.id !== "echo_due" && <>
                    <label className="text-xs font-semibold text-slate-500">Référence de départ<select value={phase.startRule.reference} onChange={(event) => updatePhase(phase.id, { startRule: { ...phase.startRule, reference: event.target.value as ReproductionReference } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{REFERENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-500">Position<select value={phase.startRule.position} onChange={(event) => updatePhase(phase.id, { startRule: { ...phase.startRule, position: event.target.value as ReproductionPosition } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"><option value="AT">Au moment de</option><option value="AFTER">Après</option><option value="BEFORE">Avant</option></select></label>
                    <label className="text-xs font-semibold text-slate-500">Décalage<input type="number" min={0} value={phase.startRule.offset} onChange={(event) => updatePhase(phase.id, { startRule: { ...phase.startRule, offset: Number(event.target.value) } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>
                    <label className="text-xs font-semibold text-slate-500">Condition de départ<select value={phase.startRule.condition} onChange={(event) => updatePhase(phase.id, { startRule: { ...phase.startRule, condition: event.target.value as PhaseStartCondition } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"><option value="ALWAYS">Toujours</option><option value="IF_NO_BREEDING">Si aucune saillie / IA</option><option value="FERTILIZING_ATTEMPT">Tentative retenue comme fécondante</option></select></label>
                  </>}
                  <label className="text-xs font-semibold text-slate-500">Condition de fin<select value={phase.endRule.type} onChange={(event) => updatePhase(phase.id, { endRule: { type: event.target.value as PhaseEndType, unit: "DAYS", duration: 0 } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"><option value="AFTER_DURATION">Après une durée</option><option value="AT_EVENT">À un événement</option><option value="AT_PHASE_START">Au début d’une autre phase</option><option value="UNTIL_EVENT">Jusqu’à un événement</option><option value="OPEN">Sans fin définie</option></select></label>
                  {phase.endRule.type === "AFTER_DURATION" && <label className="text-xs font-semibold text-slate-500">Durée avant la fin<input type="number" min={0} value={phase.endRule.duration ?? 0} onChange={(event) => updatePhase(phase.id, { endRule: { ...phase.endRule, duration: Number(event.target.value) } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" /></label>}
                  {(phase.endRule.type === "AT_EVENT" || phase.endRule.type === "UNTIL_EVENT") && <label className="text-xs font-semibold text-slate-500">Événement de fin<select value={phase.endRule.event ?? "CALVING"} onChange={(event) => updatePhase(phase.id, { endRule: { ...phase.endRule, event: event.target.value as ReproductionReference } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{REFERENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                  {phase.endRule.type === "AT_PHASE_START" && <label className="text-xs font-semibold text-slate-500">Phase suivante<select value={phase.endRule.phaseId ?? ""} onChange={(event) => updatePhase(phase.id, { endRule: { ...phase.endRule, phaseId: event.target.value } })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{config.phases.filter((item) => item.id !== phase.id).map((item) => <option key={item.id} value={item.id}>{item.displayedName}</option>)}</select></label>}
                  <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Message principal<input value={phase.mainMessage} onChange={(event) => updatePhase(phase.id, { mainMessage: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-500">Priorité<select value={phase.priority} onChange={(event) => updatePhase(phase.id, { priority: event.target.value as ReproductionPriority })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-500">Action existante<select value={phase.action} onChange={(event) => updatePhase(phase.id, { action: event.target.value as ExistingReproductionAction })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm">{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <Toggle label="Visible sur l’accueil" checked={phase.showOnHome} onChange={(showOnHome) => updatePhase(phase.id, { showOnHome })} />
                </>}
                <div className="sm:col-span-2">
                  <Toggle label="Afficher dans les priorités et les listes" checked={phase.enabledAlert} onChange={(enabledAlert) => updatePhase(phase.id, { enabledAlert })} />
                  <p className="mt-1 px-1 text-xs text-slate-500">Si activé, les animaux concernés apparaissent dans les listes et priorités de CESAM. Cette option ne modifie pas leur phase calculée.</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader
          title="Surveillance du retour en chaleur"
          summary={describeHeatReturnMonitoring(config.heatReturnMonitoring)}
          onRestore={() => restoreSection("heatReturnMonitoring")}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Activer le rappel"
            checked={config.heatReturnMonitoring.enabled}
            onChange={(enabled) => setConfig((current) => ({
              ...current,
              heatReturnMonitoring: { ...current.heatReturnMonitoring, enabled },
            }))}
          />
          <Toggle
            label="Afficher dans les actualités et priorités"
            checked={config.heatReturnMonitoring.showOnHome}
            onChange={(showOnHome) => setConfig((current) => ({
              ...current,
              heatReturnMonitoring: { ...current.heatReturnMonitoring, showOnHome },
            }))}
          />
          <label className="text-xs font-semibold text-slate-500">
            Jour de début
            <input
              type="number"
              min={1}
              step={1}
              value={config.heatReturnMonitoring.startDay}
              onChange={(event) => setConfig((current) => ({
                ...current,
                heatReturnMonitoring: { ...current.heatReturnMonitoring, startDay: Number(event.target.value) },
              }))}
              className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Jour de fin inclus
            <input
              type="number"
              min={1}
              step={1}
              value={config.heatReturnMonitoring.endDay}
              onChange={(event) => setConfig((current) => ({
                ...current,
                heatReturnMonitoring: { ...current.heatReturnMonitoring, endDay: Number(event.target.value) },
              }))}
              className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
            />
          </label>
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
          <div className="mt-3 space-y-3">{config.actionWindows.map((item) => <details key={item.id} className="rounded-xl border border-slate-200" open={!item.fundamental}><summary className="min-h-12 cursor-pointer list-none px-3 py-2.5"><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><span className="flex-1">{item.name}</span>{item.fundamental && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Fondamentale</span>}<ChevronDown size={16} /></span><span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{describeActionWindow(item)}</span></summary><div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
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
            <label className="text-xs font-semibold text-slate-500">Formulaire existant<select value={item.action} onChange={(event) => updateEvent(item.id, { action: event.target.value as ExistingReproductionAction })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-500">Champs demandés</p><div className="mt-2 space-y-2">{[...item.fields].sort((left, right) => left.order - right.order).map((eventField, index) => <div key={eventField.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{eventField.label}</span><span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400">{eventField.dataType}</span><button type="button" onClick={() => moveEventField(item.id, eventField.id, -1)} disabled={index === 0} className="min-h-9 px-2 text-slate-500 disabled:opacity-20" aria-label="Monter le champ">↑</button><button type="button" onClick={() => moveEventField(item.id, eventField.id, 1)} disabled={index === item.fields.length - 1} className="min-h-9 px-2 text-slate-500 disabled:opacity-20" aria-label="Descendre le champ">↓</button>{!eventField.locked && <button type="button" onClick={() => updateEvent(item.id, { fields: item.fields.filter((field) => field.id !== eventField.id).map((field, order) => ({ ...field, order })) })} className="min-h-9 px-2 text-red-600" aria-label="Supprimer le champ"><Trash2 size={15} /></button>}</div><div className="mt-2 grid gap-2 sm:grid-cols-3"><label className="text-[10px] font-semibold text-slate-500">Libellé<input value={eventField.label} onChange={(event) => updateEventField(item.id, eventField.id, { label: event.target.value })} className="mt-1 min-h-10 w-full rounded border bg-white px-2 text-xs" /></label><label className="text-[10px] font-semibold text-slate-500">Type<select value={eventField.dataType} onChange={(event) => updateEventField(item.id, eventField.id, { dataType: event.target.value as ReproductionEventField["dataType"] })} className="mt-1 min-h-10 w-full rounded border bg-white px-2 text-xs"><option value="DATE">Date</option><option value="TIME">Heure</option><option value="TEXT">Texte</option><option value="NUMBER">Nombre</option><option value="SELECT">Choix</option><option value="FILE">Fichier</option><option value="REFERENCE">Référence</option></select></label><label className="text-[10px] font-semibold text-slate-500">Valeur par défaut<input value={eventField.defaultValue ?? ""} onChange={(event) => updateEventField(item.id, eventField.id, { defaultValue: event.target.value || undefined })} disabled={eventField.locked && Boolean(eventField.defaultValue)} className="mt-1 min-h-10 w-full rounded border bg-white px-2 text-xs disabled:bg-slate-100" /></label></div><label className="mt-2 flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={eventField.required} disabled={eventField.locked && eventField.required} onChange={(event) => updateEventField(item.id, eventField.id, { required: event.target.checked })} className="h-4 w-4 accent-green-700" /> Obligatoire{eventField.locked && <span className="text-[10px] text-slate-400">Champ métier protégé</span>}</label></div>)}</div><div className="mt-2 flex gap-2"><select id={`field-${item.id}`} defaultValue="OBSERVATION" className="min-h-11 min-w-0 flex-1 rounded-lg border px-2 text-xs">{EVENT_FIELD_CATALOG.map((definition) => <option key={definition.key} value={definition.key}>{definition.label}</option>)}</select><button type="button" onClick={() => { const select = document.getElementById(`field-${item.id}`) as HTMLSelectElement | null; if (select) addEventField(item.id, select.value as EventFieldKey); }} className="min-h-11 rounded-lg border border-green-300 px-3 text-xs font-bold text-green-700"><Plus size={15} className="inline" /> Ajouter</button></div></div>
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
