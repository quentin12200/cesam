import {
  ArrowRightLeft,
  Baby,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import { useState } from "react";
import type { WorkspaceAction, WorkspaceAnimal } from "./types";
import { ACTION_LABELS } from "./workspace-utils";

type WorkspaceActionModalProps = {
  action: WorkspaceAction;
  selectedCount: number;
  compatibleAnimals: WorkspaceAnimal[];
  onClose: () => void;
  onConfirm: () => void;
};

const ACTION_COPY: Record<WorkspaceAction, {
  icon: typeof Baby;
  prompt: string;
  submit: string;
  tone: string;
  choices: Array<{ value: string; label: string }>;
}> = {
  treatment: {
    icon: Stethoscope,
    prompt: "Quel soin venez-vous d’effectuer ?",
    submit: "Simuler le traitement",
    tone: "bg-rose-100 text-rose-950",
    choices: [{ value: "vermifuge", label: "Vermifuge — dose du protocole" }, { value: "soin", label: "Autre soin" }],
  },
  vaccination: {
    icon: Syringe,
    prompt: "Quel vaccin venez-vous d’administrer ?",
    submit: "Simuler la vaccination",
    tone: "bg-fuchsia-100 text-fuchsia-950",
    choices: [{ value: "nasym", label: "Nasym — protocole du lot" }, { value: "rispoval", label: "Rispoval — protocole du lot" }],
  },
  echo: {
    icon: ScanLine,
    prompt: "Résultat pour chaque femelle",
    submit: "Simuler les échographies",
    tone: "bg-amber-100 text-amber-950",
    choices: [],
  },
  weaning: {
    icon: Baby,
    prompt: "À quelle date enregistrer le sevrage ?",
    submit: "Simuler le sevrage",
    tone: "bg-blue-100 text-blue-950",
    choices: [{ value: "today", label: "Aujourd’hui" }, { value: "yesterday", label: "Hier" }],
  },
  move: {
    icon: ArrowRightLeft,
    prompt: "Vers quel lot déplacer les animaux ?",
    submit: "Simuler le changement",
    tone: "bg-cyan-100 text-cyan-950",
    choices: [{ value: "fattening", label: "Lot engraissement" }, { value: "high-field", label: "Pâture du haut" }, { value: "building", label: "Bâtiment" }],
  },
  weight: {
    icon: Scale,
    prompt: "Comment relever les poids ?",
    submit: "Simuler la pesée",
    tone: "bg-slate-200 text-slate-950",
    choices: [{ value: "individual", label: "Saisir les poids animal par animal" }, { value: "average", label: "Appliquer un poids moyen au groupe" }],
  },
  sale: {
    icon: Truck,
    prompt: "Quelle sortie préparer ?",
    submit: "Simuler la sortie",
    tone: "bg-violet-100 text-violet-950",
    choices: [{ value: "sale", label: "Vente" }, { value: "transfer", label: "Transfert" }],
  },
};

type EchoResult = "PLEINE" | "VIDE" | "A_RECONTROLER";
type EchoRow = { result: EchoResult; days: number };

export default function WorkspaceActionModal({ action, selectedCount, compatibleAnimals, onClose, onConfirm }: WorkspaceActionModalProps) {
  const copy = ACTION_COPY[action];
  const Icon = copy.icon;
  const excludedCount = selectedCount - compatibleAnimals.length;
  const [echoRows, setEchoRows] = useState<Record<string, EchoRow>>(() => Object.fromEntries(
    compatibleAnimals.map((animal) => [
      animal.id,
      {
        result: animal.reproductionStatus === "EMPTY" ? "VIDE" : "PLEINE",
        days: Math.min(284, Math.max(1, (animal.pregnantMonths ?? 2) * 30)),
      },
    ]),
  ));

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${action === "echo" ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${copy.tone}`}><Icon size={23} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-green-800">Aperçu du formulaire CESAM</p>
            <h2 id="action-dialog-title" className="mt-0.5 text-xl font-black text-slate-950">
              {ACTION_LABELS[action]} · {compatibleAnimals.length} animal{compatibleAnimals.length > 1 ? "aux" : ""}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X size={21} /></button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {excludedCount > 0 && (
            <div className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
              <strong>{getConcernedLabel(action, compatibleAnimals.length)}</strong> seront concernés. Les {excludedCount} autres animaux restent sélectionnés et ne seront pas modifiés.
            </div>
          )}

          {action === "echo" ? (
            <EchoIndividualForm animals={compatibleAnimals} rows={echoRows} onChange={(animalId, value) => setEchoRows((current) => ({ ...current, [animalId]: { ...current[animalId], ...value } }))} />
          ) : (
            <>
              <label className="block text-sm font-black text-slate-800" htmlFor="prototype-action-choice">{copy.prompt}</label>
              <select id="prototype-action-choice" defaultValue={copy.choices[0]?.value} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200">
                {copy.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
              <AnimalSummary animals={compatibleAnimals} />
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4 sm:px-5">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
          <button type="button" onClick={onConfirm} className="min-h-12 flex-[1.5] rounded-xl bg-green-800 px-4 text-sm font-black text-white hover:bg-green-900">{copy.submit}</button>
        </div>
      </section>
    </div>
  );
}

function EchoIndividualForm({ animals, rows, onChange }: {
  animals: WorkspaceAnimal[];
  rows: Record<string, EchoRow>;
  onChange: (animalId: string, value: Partial<EchoRow>) => void;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-black text-slate-900">Saisie individuelle</h3>
        <p className="text-xs font-semibold text-slate-500">Chaque vache peut avoir un résultat et un stade différents.</p>
      </div>
      <div className="space-y-2">
        {animals.map((animal) => {
          const row = rows[animal.id];
          return (
            <div key={animal.id} className="grid items-center gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(110px,1fr)_170px_170px]">
              <div className="min-w-0">
                <strong className="block text-base font-black text-slate-950">{animal.nutrav}</strong>
                <span className="block truncate text-xs font-semibold text-slate-500">{animal.name ?? "Vache"}</span>
              </div>
              <label className="text-xs font-black text-slate-600">
                Résultat
                <select value={row.result} onChange={(event) => onChange(animal.id, { result: event.target.value as EchoResult })} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold">
                  <option value="PLEINE">Pleine</option>
                  <option value="VIDE">Vide</option>
                  <option value="A_RECONTROLER">À recontrôler</option>
                </select>
              </label>
              <label className={`text-xs font-black text-slate-600 ${row.result !== "PLEINE" ? "opacity-35" : ""}`}>
                Stade de gestation
                <span className="mt-1 flex items-center gap-2">
                  <input type="number" min={1} max={284} value={row.days} disabled={row.result !== "PLEINE"} onChange={(event) => onChange(animal.id, { days: Math.min(284, Math.max(1, Number(event.target.value) || 1)) })} className="min-h-10 w-20 rounded-lg border border-slate-300 px-2 text-center text-sm font-black" />
                  <span className="text-xs font-semibold">jours</span>
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnimalSummary({ animals }: { animals: WorkspaceAnimal[] }) {
  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Animaux concernés</p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-800">{animals.map((animal) => animal.nutrav).join(" · ")}</p>
    </div>
  );
}

function getConcernedLabel(action: WorkspaceAction, count: number) {
  if (action === "weaning") return `${count} veau${count > 1 ? "x" : ""}`;
  if (action === "echo") return `${count} femelle${count > 1 ? "s" : ""}`;
  return `${count} animal${count > 1 ? "aux" : ""}`;
}
