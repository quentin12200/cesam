"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import type { VelageDeletionPreview } from "@/lib/velage-edit";

interface Props {
  velageId: string;
  editHref: string;
}

export default function VelageActions({ velageId, editHref }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<VelageDeletionPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadDeletionPreview() {
    setOpen(true);
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch(`/api/velages/${velageId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de contrôler ce vêlage");
      setPreview(data.deletion);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de contrôler ce vêlage");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeletion() {
    if (!preview?.allowed) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/velages/${velageId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setPreview(data.deletion ?? preview);
        throw new Error(data.error ?? "Suppression impossible");
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <RecordActionsMenu
        onEdit={() => router.push(editHref)}
        actions={[{
          label: "Supprimer",
          tone: "danger",
          onSelect: loadDeletionPreview,
        }]}
      />

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/45" onClick={() => !deleting && setOpen(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby={`delete-velage-${velageId}`} className="relative w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`delete-velage-${velageId}`} className="font-bold text-gray-900">Supprimer ce vêlage ?</h2>
                <p className="mt-1 text-xs text-gray-500">Le contrôle est refait au moment de la suppression.</p>
              </div>
              <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600" aria-label="Fermer"><X size={19} /></button>
            </div>

            {loading && <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-gray-600"><Loader2 size={18} className="animate-spin" /> Contrôle des données liées…</div>}
            {!loading && preview && (
              <div className={`mt-3 rounded-lg border p-3 text-sm ${preview.allowed ? "border-amber-200 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50 text-red-900"}`}>
                <p className="font-medium leading-5">{preview.message}</p>
                {preview.blockers.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {preview.blockers.map((blocker) => <li key={blocker.animalId}>{blocker.message}</li>)}
                  </ul>
                )}
                {preview.allowed && (
                  <p className="mt-2 text-xs leading-5">
                    {preview.removableBirthDeclarations} déclaration(s) de naissance encore à déclarer seront supprimées. Les numéros de boucles consommés ne seront pas remis dans le lot.
                  </p>
                )}
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700">Fermer</button>
              {preview?.allowed && (
                <button type="button" disabled={deleting || loading} onClick={() => void confirmDeletion()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Supprimer définitivement
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
