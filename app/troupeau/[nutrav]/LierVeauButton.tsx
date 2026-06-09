"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

export default function LierVeauButton({ velageId }: { velageId: string }) {
  const [open, setOpen] = useState(false);
  const [nutrav, setNutrav] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("F");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/velages/${velageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veauNutrav: nutrav.toUpperCase(), veauSexe: sexe, veauNom: nom || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(String(err).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
      >
        <Link2 size={12} /> Lier le veau à ce vêlage
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-800">Lier / créer le veau</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={nutrav}
          onChange={(e) => setNutrav(e.target.value)}
          placeholder="NUTRAV veau (ex: 0166)"
          required
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono"
        />
      </div>

      <div className="flex gap-2">
        {(["M", "F"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSexe(s)}
            className={`flex-1 py-1.5 rounded text-xs font-semibold border-2 transition-colors
              ${sexe === s
                ? s === "M" ? "bg-sky-500 text-white border-sky-500" : "bg-pink-500 text-white border-pink-500"
                : "border-gray-200 text-gray-600 bg-white"}`}
          >
            {s === "M" ? "♂ Mâle" : "♀ Femelle"}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom / surnom (optionnel)"
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-amber-500 text-white text-xs font-semibold py-1.5 rounded hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "En cours…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 text-xs text-gray-500 hover:text-gray-700"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
