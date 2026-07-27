"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { ACTION_VISUALS } from "@/components/action-visuals";

type Chaleur = {
  id: string;
  date: string;
  notes: string | null;
};

interface Props {
  initialChaleurs: Chaleur[];
  testReproEnabled: boolean;
}

const ChaleurIcon = ACTION_VISUALS.chaleur.icon;

function dateForInput(date: string) {
  return date.slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export default function ChaleursHistory({ initialChaleurs, testReproEnabled }: Props) {
  const router = useRouter();
  const [chaleurs, setChaleurs] = useState(initialChaleurs);
  const [selected, setSelected] = useState<Chaleur | null>(null);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setChaleurs(initialChaleurs);
  }, [initialChaleurs]);

  if (chaleurs.length === 0) return null;

  function isSimulationActive() {
    if (!testReproEnabled) return false;
    return document.querySelector<HTMLSelectElement>("[data-reproduction-preview-scenario]")?.value !== "real";
  }

  function open(chaleur: Chaleur) {
    setSelected(chaleur);
    setDate(dateForInput(chaleur.date));
    setNotes(chaleur.notes ?? "");
    setError("");
  }

  function close() {
    if (saving) return;
    setSelected(null);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !date || saving) return;
    if (isSimulationActive()) {
      setError("Revenez sur Données réelles pour modifier une chaleur.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/chaleurs/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, notes }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Modification impossible");
      const updated: Chaleur = {
        id: result.id,
        date: result.date,
        notes: result.notes,
      };
      setChaleurs((items) =>
        items
          .map((item) => item.id === updated.id ? updated : item)
          .sort((a, b) => b.date.localeCompare(a.date))
      );
      setSelected(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification impossible");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || saving) return;
    if (isSimulationActive()) {
      setError("Revenez sur Données réelles pour supprimer une chaleur.");
      return;
    }
    if (!window.confirm(`Supprimer la chaleur du ${formatDate(selected.date)} ?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/chaleurs/${selected.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Suppression impossible");
      setChaleurs((items) => items.filter((item) => item.id !== selected.id));
      setSelected(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-xl bg-white p-4 shadow">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
          <ChaleurIcon size={17} className="text-pink-600" />
          Historique reproductif — chaleurs ({chaleurs.length})
        </h3>
        <div className="space-y-2">
          {chaleurs.map((chaleur) => (
            <button
              key={chaleur.id}
              type="button"
              onClick={() => open(chaleur)}
              className="w-full rounded-lg border border-pink-100 bg-pink-50/40 p-3 text-left transition hover:border-pink-300 hover:bg-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
              aria-label={`Modifier la chaleur du ${formatDate(chaleur.date)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-pink-800">Chaleur observée</span>
                <span className="flex shrink-0 items-center gap-2">
                  <time className="text-xs font-medium text-gray-600">{formatDate(chaleur.date)}</time>
                  <Pencil size={14} className="text-pink-600" aria-hidden="true" />
                </span>
              </div>
              {chaleur.notes && <p className="mt-1 text-sm text-gray-600">{chaleur.notes}</p>}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-chaleur-title" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="edit-chaleur-title" className="flex items-center gap-2 font-semibold text-gray-900">
                <ChaleurIcon size={18} className="text-pink-600" />
                Modifier la chaleur
              </h3>
              <button type="button" onClick={close} disabled={saving} className="text-gray-400 hover:text-gray-600" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <form className="space-y-3" onSubmit={save}>
              <div>
                <label htmlFor="edit-chaleur-date" className="mb-1 block text-xs font-medium text-gray-500">Date</label>
                <input
                  id="edit-chaleur-date"
                  type="date"
                  value={date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
              <div>
                <label htmlFor="edit-chaleur-notes" className="mb-1 block text-xs font-medium text-gray-500">Notes (optionnel)</label>
                <input
                  id="edit-chaleur-notes"
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={remove} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 size={16} />
                  Supprimer
                </button>
                <button type="submit" disabled={saving || !date} className="min-h-11 flex-1 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
