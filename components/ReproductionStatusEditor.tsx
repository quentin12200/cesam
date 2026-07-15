"use client";

import { useState } from "react";
import { Pencil, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EtatGestation } from "@/lib/utils";

const OPTIONS: { value: EtatGestation; label: string }[] = [
  { value: "VERT", label: "Pleine" },
  { value: "ROUGE", label: "Vide" },
  { value: "JAUNE", label: "À écho" },
  { value: "REPOS", label: "Repos post-vêlage" },
  { value: "ROSE", label: "Imminent" },
  { value: "GRIS", label: "Saillie récente" },
];

export const REPRODUCTION_STATUS_LABELS = Object.fromEntries(
  OPTIONS.map((option) => [option.value, option.label])
) as Record<EtatGestation, string>;

export default function ReproductionStatusEditor({
  animalIds,
  currentStatus,
  previousStatus,
  onChanged,
}: {
  animalIds: string[];
  currentStatus: EtatGestation;
  previousStatus?: EtatGestation | null;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EtatGestation>(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enregistrer(restaurer = false) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reproduction/statut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurer ? { animalIds, restaurer: true } : { animalIds, statut: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Modification impossible");
      setOpen(false);
      await onChanged?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modification impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setSelected(currentStatus); setError(null); setOpen(true); }}
        aria-label="Modifier le statut reproductif"
        title="Modifier le statut reproductif"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="repro-status-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="repro-status-title" className="font-bold text-gray-900">
                Modifier le statut reproductif
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              {OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-medium ${
                    selected === option.value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="reproduction-status"
                    value={option.value}
                    checked={selected === option.value}
                    onChange={() => setSelected(option.value)}
                    className="accent-green-700"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {previousStatus && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => enregistrer(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  Revenir à « {REPRODUCTION_STATUS_LABELS[previousStatus]} »
                </button>
              )}
              <button
                type="button"
                disabled={saving || selected === currentStatus}
                onClick={() => enregistrer(false)}
                className="ml-auto min-h-11 rounded-xl bg-green-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
