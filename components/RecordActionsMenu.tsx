"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MoreHorizontal, Pencil } from "lucide-react";

export interface RecordAction {
  label: string;
  onSelect: () => void | Promise<void>;
  tone?: "default" | "danger";
  disabled?: boolean;
  confirmMessage?: string;
}

interface RecordActionsMenuProps {
  onEdit?: () => void;
  editLabel?: string;
  actions?: RecordAction[];
  className?: string;
}

export default function RecordActionsMenu({
  onEdit,
  editLabel = "Modifier",
  actions = [],
  className = "",
}: RecordActionsMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<RecordAction | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmAction(null);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function run(action: RecordAction) {
    setBusy(true);
    try {
      await action.onSelect();
      setOpen(false);
      setConfirmAction(null);
    } finally {
      setBusy(false);
    }
  }

  function choose(action: RecordAction) {
    if (action.confirmMessage) {
      setOpen(false);
      setConfirmAction(action);
      return;
    }
    void run(action);
  }

  const menuActions: RecordAction[] = [
    ...(onEdit ? [{ label: editLabel, onSelect: onEdit }] : []),
    ...actions,
  ];

  return (
    <div ref={containerRef} className={`relative flex shrink-0 items-center gap-0.5 ${className}`} onClick={(event) => event.stopPropagation()}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"
          title={editLabel}
          aria-label={editLabel}
        >
          <Pencil size={14} />
        </button>
      )}

      {menuActions.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Autres actions"
          title="Autres actions"
        >
          <MoreHorizontal size={18} />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {menuActions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              type="button"
              disabled={action.disabled || busy}
              onClick={() => choose(action)}
              className={`block min-h-10 w-full px-3 text-left text-sm disabled:opacity-40 ${
                action.tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Annuler" className="absolute inset-0 bg-black/45" onClick={() => setConfirmAction(null)} />
          <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl">
            <h2 className="font-bold text-gray-900">Confirmer l’action</h2>
            <p className="mt-2 text-sm text-gray-600">{confirmAction.confirmMessage}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmAction(null)} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700">
                Annuler
              </button>
              <button type="button" disabled={busy} onClick={() => void run(confirmAction)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {busy && <Loader2 size={15} className="animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
