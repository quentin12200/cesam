"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save } from "lucide-react";

interface DryOffSettings {
  tarissementVeauAgeMois: number | null;
}

export default function DryOffSettingsForm({
  initial,
}: {
  initial: DryOffSettings;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    tarissementVeauAgeMois: initial.tarissementVeauAgeMois ?? 6,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setNumber(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({
        ...current,
        [field]: Number(event.target.value),
      }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/exploitation-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (!response.ok) return;

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Tarissement
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              CESAM utilise cet âge pour afficher la proposition de tarissement.
            </p>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Proposer le tarissement lorsque le veau atteint
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={form.tarissementVeauAgeMois}
              onChange={setNumber("tarissementVeauAgeMois")}
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <span className="text-xs font-semibold text-slate-500">mois</span>
          </div>
        </section>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
      >
        {saved ? (
          <>
            <CheckCircle2 size={18} /> Enregistré
          </>
        ) : (
          <>
            <Save size={18} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </>
        )}
      </button>
    </form>
  );
}
