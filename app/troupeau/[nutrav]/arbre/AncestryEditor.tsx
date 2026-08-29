"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AncestryParent, AncestrySearchMatch } from "@/lib/animal-genealogy";

export default function AncestryEditor({
  animalNutrav,
  parent,
}: {
  animalNutrav: string;
  parent: AncestryParent;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workNumber, setWorkNumber] = useState("");
  const [nationalNumber, setNationalNumber] = useState("");
  const [name, setName] = useState("");
  const [matches, setMatches] = useState<AncestrySearchMatch[]>([]);
  const [selected, setSelected] = useState<AncestrySearchMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || workNumber.trim().length < 1 || selected) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(
        `/api/animaux/${encodeURIComponent(animalNutrav)}/ascendance?q=${encodeURIComponent(workNumber.trim())}&parent=${parent}`,
        { signal: controller.signal },
      );
      const result = await response.json().catch(() => ({ matches: [] }));
      if (response.ok) setMatches(result.matches ?? []);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [animalNutrav, open, parent, selected, workNumber]);

  function choose(match: AncestrySearchMatch) {
    setSelected(match);
    setWorkNumber(match.workNumber ?? "");
    setNationalNumber(match.nationalNumber ?? "");
    setName(match.name ?? "");
    setMatches([]);
  }

  async function save() {
    if (!selected && !workNumber.trim()) {
      setError("Le N° de travail est requis.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch(`/api/animaux/${encodeURIComponent(animalNutrav)}/ascendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent,
        source: selected?.source ?? "MANUEL",
        sourceId: selected?.sourceId ?? null,
        workNumber,
        nationalNumber,
        name,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "Enregistrement impossible.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] font-semibold text-green-700 underline underline-offset-2"
      >
        Renseigner
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-xl">
        <h3 className="text-base font-bold text-gray-900">
          Renseigner {parent === "MERE" ? "la mère" : "le père"}
        </h3>
        <label className="mt-3 block text-xs font-semibold text-gray-700" htmlFor={`ancestry-work-${parent}`}>
          N° de travail
        </label>
        <input
          id={`ancestry-work-${parent}`}
          value={workNumber}
          onChange={(event) => { setWorkNumber(event.target.value); setSelected(null); }}
          placeholder="N° travail, complet ou nom"
          autoFocus
          className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base text-gray-900"
        />

        {matches.length > 0 && (
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-1">
            {matches.map((match) => (
              <button
                key={match.key}
                type="button"
                onClick={() => choose(match)}
                className="block min-h-11 w-full rounded-md px-2 py-1.5 text-left hover:bg-green-50"
              >
                <span className="block font-mono text-sm font-bold text-gray-900">{match.workNumber ?? "—"}</span>
                <span className="block text-xs text-gray-600">
                  {[match.nationalNumber, match.name, match.status === "ACTIF" ? null : match.status].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700">
            N° complet (facultatif)
            <input
              value={nationalNumber}
              onChange={(event) => setNationalNumber(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Nom (facultatif)
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-2 text-sm font-normal"
            />
          </label>
        </div>

        {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-gray-600">
            Annuler
          </button>
          <button type="button" disabled={saving} onClick={save} className="min-h-11 rounded-lg bg-green-700 px-4 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
