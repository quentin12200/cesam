"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";

interface ImportResult {
  totalLignes: number;
  traitementsCrees: number;
  vaccinationsCreees: number;
  ordonnanceCompletee: number;
  dejaPresent: number;
  animalIntrouvable: number;
  animalIntrouvableSample: string[];
}

export default function ImportHistoriqueButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const router = useRouter();

  async function runImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/carnet-sanitaire/import-historique", { method: "POST" });
      const data = await res.json();
      setResult(data);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={runImport}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        title="Importer l'historique complet depuis l'export officiel"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Importer l&apos;historique officiel
      </button>

      {result && (
        <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-900">
          <p className="font-medium">
            {result.traitementsCrees} traitement(s) et {result.vaccinationsCreees} vaccination(s) créés.
          </p>
          <p className="text-blue-700">
            {result.ordonnanceCompletee} n° d&apos;ordonnance complété(s) · {result.dejaPresent} déjà présent(s) · {result.animalIntrouvable} animal(aux) introuvable(s) sur {result.totalLignes} ligne(s) du fichier
          </p>
          {result.animalIntrouvableSample.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-blue-700">Voir les animaux introuvables</summary>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {result.animalIntrouvableSample.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
