import {
  AlertTriangle,
  ArrowRightLeft,
  Baby,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import type { WorkspaceAction, WorkspaceAnimal } from "./types";
import { ACTION_LABELS } from "./workspace-utils";

type WorkspaceActionModalProps = {
  action: WorkspaceAction;
  selectedCount: number;
  compatibleAnimals: WorkspaceAnimal[];
  onClose: () => void;
  onConfirm: () => void;
};

const ACTION_COPY: Record<
  WorkspaceAction,
  {
    icon: typeof Baby;
    prompt: string;
    submit: string;
    tone: string;
    choices: Array<{ value: string; label: string }>;
  }
> = {
  treatment: {
    icon: Stethoscope,
    prompt: "Quel soin venez-vous d’effectuer ?",
    submit: "Simuler le traitement",
    tone: "bg-rose-100 text-rose-950",
    choices: [
      { value: "vermifuge", label: "Vermifuge — dose du protocole" },
      { value: "soin", label: "Autre soin" },
    ],
  },
  vaccination: {
    icon: Syringe,
    prompt: "Quel vaccin venez-vous d’administrer ?",
    submit: "Simuler la vaccination",
    tone: "bg-fuchsia-100 text-fuchsia-950",
    choices: [
      { value: "nasym", label: "Nasym — protocole du lot" },
      { value: "rispoval", label: "Rispoval — protocole du lot" },
    ],
  },
  echo: {
    icon: ScanLine,
    prompt: "Quel résultat souhaitez-vous simuler ?",
    submit: "Simuler l’échographie",
    tone: "bg-amber-100 text-amber-950",
    choices: [
      { value: "pregnant", label: "Gestante" },
      { value: "empty", label: "Vide" },
      { value: "unknown", label: "À recontrôler" },
    ],
  },
  weaning: {
    icon: Baby,
    prompt: "À quelle date enregistrer le sevrage ?",
    submit: "Simuler le sevrage",
    tone: "bg-blue-100 text-blue-950",
    choices: [
      { value: "today", label: "Aujourd’hui" },
      { value: "yesterday", label: "Hier" },
    ],
  },
  move: {
    icon: ArrowRightLeft,
    prompt: "Vers quel lot déplacer les animaux ?",
    submit: "Simuler le changement",
    tone: "bg-cyan-100 text-cyan-950",
    choices: [
      { value: "fattening", label: "Lot engraissement" },
      { value: "high-field", label: "Pâture du haut" },
      { value: "building", label: "Bâtiment" },
    ],
  },
  weight: {
    icon: Scale,
    prompt: "Comment relever les poids ?",
    submit: "Simuler la pesée",
    tone: "bg-slate-200 text-slate-950",
    choices: [
      { value: "session", label: "Ouvrir la saisie des poids en série" },
      { value: "average", label: "Appliquer un poids moyen au lot" },
    ],
  },
  sale: {
    icon: Truck,
    prompt: "Quelle sortie préparer ?",
    submit: "Simuler la sortie",
    tone: "bg-violet-100 text-violet-950",
    choices: [
      { value: "sale", label: "Vente" },
      { value: "transfer", label: "Transfert" },
    ],
  },
};

export default function WorkspaceActionModal({
  action,
  selectedCount,
  compatibleAnimals,
  onClose,
  onConfirm,
}: WorkspaceActionModalProps) {
  const copy = ACTION_COPY[action];
  const Icon = copy.icon;
  const excludedCount = selectedCount - compatibleAnimals.length;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" className="w-full rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${copy.tone}`}>
            <Icon size={23} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-green-800">Prototype sans enregistrement</p>
            <h2 id="action-dialog-title" className="mt-0.5 text-xl font-black text-slate-950">
              {ACTION_LABELS[action]} · {compatibleAnimals.length} animal{compatibleAnimals.length > 1 ? "aux" : ""}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X size={21} />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {excludedCount > 0 && (
            <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <p>
                <strong>{excludedCount} animal{excludedCount > 1 ? "aux" : ""}</strong> non compatible{excludedCount > 1 ? "s" : ""}. Seuls les animaux compatibles seront concernés.
              </p>
            </div>
          )}

          <label className="block text-sm font-black text-slate-800" htmlFor="prototype-action-choice">{copy.prompt}</label>
          <select
            id="prototype-action-choice"
            defaultValue={copy.choices[0]?.value}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
          >
            {copy.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Animaux concernés</p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-800">
              {compatibleAnimals.map((animal) => animal.nutrav).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 sm:px-5">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
          <button type="button" onClick={onConfirm} className="min-h-12 flex-[1.5] rounded-xl bg-green-800 px-4 text-sm font-black text-white hover:bg-green-900">{copy.submit}</button>
        </div>
      </section>
    </div>
  );
}
