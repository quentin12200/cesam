"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BullIdentityEditor({ id, name, national }: { id: string; name: string | null; national: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(name ?? "");
  const [numero, setNumero] = useState(/^[A-Z]{2}\d/.test(national) ? national : national === (name ?? "") ? "" : national);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const work = /\d{4}$/.exec(numero.replace(/\s+/g, ""))?.[0] ?? "Non renseigné";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/taureaux", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nopere: nom, nupere: numero }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Correction impossible"); return; }
      setOpen(false); router.refresh();
    } catch { setError("Erreur réseau"); }
    finally { setSaving(false); }
  }
  return <div className="mt-2">
    <button type="button" onClick={() => setOpen(!open)} className="rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800">
      {open ? "Annuler" : "Corriger le nom / numéro"}
    </button>
    {open && <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border bg-white p-3">
      <label className="block text-sm">Nom du père
        <input className="mt-1 w-full rounded-lg border p-2" value={nom} onChange={e => setNom(e.target.value)} maxLength={120} />
      </label>
      <label className="block text-sm">Numéro national complet
        <input className="mt-1 w-full rounded-lg border p-2 font-mono" value={numero} onChange={e => setNumero(e.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder="FR1234567890" required />
      </label>
      <p className="text-sm text-gray-600">N° de travail calculé : <strong>{work}</strong></p>
      <p className="text-xs text-amber-700">La correction conserve les liens par identifiant. Les références historiques ambiguës nécessitent une vérification manuelle.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer la correction"}</button>
    </form>}
  </div>;
}
