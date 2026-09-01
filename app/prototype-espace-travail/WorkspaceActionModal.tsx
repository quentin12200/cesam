import { AlertTriangle, Baby, ScanLine, Stethoscope, X } from "lucide-react";
import type { WorkspaceAction, WorkspaceAnimal } from "./types";
import { ACTION_LABELS } from "./workspace-utils";

type WorkspaceActionModalProps = {
  action: WorkspaceAction;
  selectedCount: number;
  compatibleAnimals: WorkspaceAnimal[];
  onClose: () => void;
  onConfirm: () => void;
};

const ACTION_COPY = {
  treatment: {
    icon: Stethoscope,
    prompt: "Quel soin venez-vous d’effectuer ?",
    submit: "Simuler le traitement",
    tone: "bg-rose-100 text-rose-950",
  },
  weaning: {
    icon: Baby,
    prompt: "Confirmer le sevrage aujourd’hui",
    submit: "Simuler le sevrage",
    tone: "bg-blue-100 text-blue-950",
  },
  echo: {
    icon: ScanLine,
    prompt: "Quel résultat souhaitez-vous simuler ?",
    submit: "Simuler l’échographie",
    tone: "bg-amber-100 text-amber-950",
  },
} as const;

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
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        className="w-full rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${copy.tone}`}>
            <Icon size={23} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-green-800">
              Prototype sans enregistrement
            </p>
            <h2 id="action-dialog-title" className="mt-0.5 text-xl font-black text-slate-950">
              {ACTION_LABELS[action]} · {compatibleAnimals.length} animal{compatibleAnimals.length > 1 ? "aux" : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X size={21} />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {excludedCount > 0 && (
            <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <p>
                <strong>{excludedCount} animal{excludedCount > 1 ? "aux" : ""}</strong> ne sont pas compatibles avec cette action. Seuls les {compatibleAnimals.length} compatibles seront concernés.
              </p>
            </div>
          )}

          <label className="block text-sm font-black text-slate-800" htmlFor="prototype-action-choice">
            {copy.prompt}
          </label>
          {action === "treatment" && (
            <select id="prototype-action-choice" defaultValue="vermifuge" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200">
              <option value="vermifuge">Vermifuge — dose du protocole</option>
              <option value="vaccination">Vaccination</option>
              <option value="other">Autre soin</option>
            </select>
          )}
          {action === "weaning" && (
            <select id="prototype-action-choice" defaultValue="today" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200">
              <option value="today">Aujourd’hui</option>
              <option value="yesterday">Hier</option>
            </select>
          )}
          {action === "echo" && (
            <select id="prototype-action-choice" defaultValue="pregnant" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200">
              <option value="pregnant">Gestante</option>
              <option value="empty">Vide</option>
              <option value="unknown">À recontrôler</option>
            </select>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Animaux concernés
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-800">
              {compatibleAnimals.map((animal) => animal.nutrav).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 flex-[1.5] rounded-xl bg-green-800 px-4 text-sm font-black text-white hover:bg-green-900"
          >
            {copy.submit}
          </button>
        </div>
      </section>
    </div>
  );
}
