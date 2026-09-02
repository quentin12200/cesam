import {
  Check,
  CirclePause,
  History,
  Play,
  RotateCcw,
  Save,
} from "lucide-react";
import type { WorkspaceActivity, WorkspaceSessionStatus } from "./types";

type WorkspaceSessionBarProps = {
  status: WorkspaceSessionStatus;
  selectedCount: number;
  activity: WorkspaceActivity[];
  restored: boolean;
  onTogglePause: () => void;
  onNewSession: () => void;
  onPrepareDemo: () => void;
};

export default function WorkspaceSessionBar({
  status,
  selectedCount,
  activity,
  restored,
  onTogglePause,
  onNewSession,
  onPrepareDemo,
}: WorkspaceSessionBarProps) {
  const completedCount = activity.reduce((sum, item) => sum + item.animalIds.length, 0);

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm" aria-label="Séance de travail">
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          status === "active" ? "bg-green-700 text-white" : "bg-amber-100 text-amber-950"
        }`}>
          {status === "active" ? <Check size={20} /> : <CirclePause size={20} />}
        </span>
        <div className="min-w-44 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="font-black text-slate-950">Séance du jour</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
              status === "active" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"
            }`}>
              {status === "active" ? "Active" : "En pause"}
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-500">
            <span>{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</span>
            <span>· {activity.length} action{activity.length > 1 ? "s" : ""}</span>
            <span>· {completedCount} enregistrement{completedCount > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1"><Save size={12} /> sauvegarde automatique</span>
          </p>
        </div>

        <div className="flex flex-1 justify-end gap-1.5 sm:flex-none">
          {!selectedCount && !activity.length && (
            <button type="button" onClick={onPrepareDemo} className="min-h-10 rounded-lg bg-green-800 px-3 text-xs font-black text-white hover:bg-green-900">
              Préparer les 15 veaux
            </button>
          )}
          <button type="button" onClick={onTogglePause} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
            {status === "active" ? <CirclePause size={15} /> : <Play size={15} />}
            {status === "active" ? "Pause" : "Reprendre"}
          </button>
          <button type="button" onClick={onNewSession} className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50" aria-label="Commencer une nouvelle séance">
            <RotateCcw size={15} />
            <span className="hidden xl:inline">Nouvelle séance</span>
          </button>
        </div>
      </div>

      {(restored || activity.length > 0) && (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:px-4">
          <History size={14} className="shrink-0 text-green-700" />
          {activity[0] ? (
            <span className="truncate"><strong className="text-slate-900">Dernier travail :</strong> {activity[0].label} · {activity[0].time}</span>
          ) : (
            <span>Séance précédente retrouvée : vous reprenez exactement où vous étiez.</span>
          )}
        </div>
      )}
    </section>
  );
}
