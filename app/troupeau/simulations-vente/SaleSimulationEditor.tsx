"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Save, ShoppingCart } from "lucide-react";
import {
  saleLineEstimate,
  saleSimulationSummary,
  type SaleSimulationLineInput,
  type SaleWeightSource,
} from "@/lib/sale-simulation";
import type { SaleSimulationCandidate } from "@/lib/sale-simulation-data";

type Props = {
  simulationId?: string;
  weighingSessionId?: string | null;
  candidates: SaleSimulationCandidate[];
  initialSelectedIds: string[];
  initialRefaction?: number;
  initialPriceKg?: number | null;
};

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toLine(candidate: SaleSimulationCandidate): SaleSimulationLineInput {
  return {
    animalId: candidate.id,
    lastWeight: candidate.lastWeight,
    lastWeightDate: candidate.lastWeightDate,
    gmq: candidate.gmq,
    predictedWeight: candidate.predictedWeight,
    merchantWeight: candidate.merchantWeight,
    manualWeight: candidate.manualWeight,
    source: candidate.source,
    individualRefaction: candidate.individualRefaction,
    individualPriceKg: candidate.individualPriceKg,
  };
}

export default function SaleSimulationEditor({
  simulationId,
  weighingSessionId = null,
  candidates,
  initialSelectedIds,
  initialRefaction = 2,
  initialPriceKg = null,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [lines, setLines] = useState<Record<string, SaleSimulationLineInput>>(() => Object.fromEntries(candidates.map((item) => [item.id, toLine(item)])));
  const [refaction, setRefaction] = useState(String(initialRefaction).replace(".", ","));
  const [priceKg, setPriceKg] = useState(initialPriceKg === null ? "" : String(initialPriceKg).replace(".", ","));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedLines = selectedIds.flatMap((id) => lines[id] ? [lines[id]] : []);
  const globalRefaction = nullableNumber(refaction) ?? 0;
  const globalPrice = nullableNumber(priceKg) ?? 0;
  const summary = useMemo(() => saleSimulationSummary(selectedLines, globalRefaction, globalPrice), [selectedLines, globalRefaction, globalPrice]);
  const visibleCandidates = candidates.filter((animal) => `${animal.nutrav} ${animal.nobovi ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  function patchLine(id: string, patch: Partial<SaleSimulationLineInput>) {
    setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function toggleAnimal(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function save() {
    if (selectedLines.length === 0) { setMessage("Sélectionnez au moins un animal."); return; }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(simulationId ? `/api/sale-simulations/${simulationId}` : "/api/sale-simulations", {
        method: simulationId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weighingSessionId, refactionGlobale: globalRefaction, prixKgGlobal: globalPrice, lines: selectedLines }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "La simulation ne peut pas être enregistrée.");
      setMessage("Simulation enregistrée.");
      if (!simulationId) router.replace(`/troupeau/simulations-vente/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La simulation ne peut pas être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 pb-32 text-gray-950">
      <header className="flex items-start gap-3 border-b-2 border-gray-900 pb-3">
        <Link href="/troupeau/simulations-vente" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-300" aria-label="Retour"><ArrowLeft size={22} /></Link>
        <div><h1 className="text-2xl font-black">Simulation de vente</h1><p className="text-sm text-gray-600">Aucune sortie n’est créée avant confirmation.</p></div>
      </header>

      <section className="sticky top-0 z-20 mt-3 rounded-lg border-2 border-black bg-yellow-200 p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <strong>{summary.animalCount} animaux</strong><strong className="text-right">{euro.format(summary.totalAmount)}</strong>
          <span>{number.format(summary.totalUsedWeight)} kg utilisés</span><span className="text-right">{number.format(summary.totalRetainedWeight)} kg retenus</span>
          <span>{globalPrice ? `${number.format(globalPrice)} €/kg` : "Prix à saisir"}</span><span className="text-right">Moy. {euro.format(summary.averageAmount)}</span>
        </div>
      </section>

      <details className="mt-4 rounded-lg border border-gray-300 bg-white p-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold">Animaux sélectionnés : {selectedIds.length}<ChevronDown size={20} /></summary>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un animal" className="mt-2 min-h-11 w-full rounded-md border border-gray-300 px-3" />
        <div className="mt-2 max-h-72 overflow-y-auto">
          {visibleCandidates.map((animal) => <label key={animal.id} className="flex min-h-12 items-center gap-3 border-b border-gray-200 py-2"><input type="checkbox" checked={selectedIds.includes(animal.id)} onChange={() => toggleAnimal(animal.id)} className="h-5 w-5" /><span className="font-bold">{animal.nutrav}</span><span className="truncate text-sm text-gray-600">{animal.nobovi}</span></label>)}
        </div>
      </details>

      <section className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-300 bg-white p-3">
        <label className="text-sm font-semibold">Réfaction (%)<input inputMode="decimal" value={refaction} onChange={(event) => setRefaction(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-gray-300 px-3 text-lg font-bold" /></label>
        <label className="text-sm font-semibold">Prix (€/kg)<input inputMode="decimal" value={priceKg} onChange={(event) => setPriceKg(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-gray-300 px-3 text-lg font-bold" /></label>
      </section>

      <div className="mt-4 space-y-3">
        {selectedIds.map((id) => {
          const animal = candidates.find((item) => item.id === id);
          const line = lines[id];
          if (!animal || !line) return null;
          const estimate = saleLineEstimate(line, globalRefaction, globalPrice);
          return <article key={id} className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{animal.nutrav}</h2><p className="text-sm text-gray-600">{animal.nobovi ?? "Sans nom"}</p></div>{estimate && <strong className="text-lg text-green-800">{euro.format(estimate.amount)}</strong>}</div>
            <p className="mt-2 text-sm">Dernière pesée : <strong>{line.lastWeight === null ? "—" : `${number.format(line.lastWeight)} kg`}</strong>{line.lastWeightDate && ` · ${new Date(line.lastWeightDate).toLocaleDateString("fr-FR")}`}</p>
            {line.predictedWeight !== null && <p className="text-sm">Prévision CESAM : <strong>{number.format(line.predictedWeight)} kg</strong> · GMQ {number.format(line.gmq ?? 0)} kg/j · {animal.predictionDays} j</p>}
            <label className="mt-3 block text-sm font-semibold">Poids utilisé<select value={line.source} onChange={(event) => patchLine(id, { source: event.target.value as SaleWeightSource })} className="mt-1 min-h-11 w-full rounded-md border border-gray-300 px-3 font-bold"><option value="LAST_WEIGHT" disabled={line.lastWeight === null}>Dernière pesée</option><option value="PREDICTED" disabled={line.predictedWeight === null}>Prédiction GMQ</option><option value="MERCHANT" disabled={line.merchantWeight === null}>Poids marchand</option><option value="MANUAL" disabled={line.manualWeight === null}>Poids manuel</option></select></label>
            {estimate && <p className="mt-2 rounded-md bg-green-50 p-2 text-sm"><strong>{number.format(estimate.usedWeight)} kg</strong> → {number.format(estimate.retainedWeight)} kg après réfaction · {number.format(estimate.priceKg)} €/kg</p>}
            <details className="mt-2 border-t border-gray-200 pt-2"><summary className="cursor-pointer font-semibold text-green-800">Modifier les poids et options</summary><div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-sm">Poids marchand<input inputMode="decimal" value={line.merchantWeight ?? ""} onChange={(event) => patchLine(id, { merchantWeight: nullableNumber(event.target.value) })} className="mt-1 min-h-11 w-full rounded-md border px-2" /></label>
              <label className="text-sm">Poids manuel<input inputMode="decimal" value={line.manualWeight ?? ""} onChange={(event) => patchLine(id, { manualWeight: nullableNumber(event.target.value) })} className="mt-1 min-h-11 w-full rounded-md border px-2" /></label>
              <label className="text-sm">Réfaction propre<input inputMode="decimal" placeholder={`${globalRefaction} %`} value={line.individualRefaction ?? ""} onChange={(event) => patchLine(id, { individualRefaction: nullableNumber(event.target.value) })} className="mt-1 min-h-11 w-full rounded-md border px-2" /></label>
              <label className="text-sm">Prix propre €/kg<input inputMode="decimal" placeholder={String(globalPrice)} value={line.individualPriceKg ?? ""} onChange={(event) => patchLine(id, { individualPriceKg: nullableNumber(event.target.value) })} className="mt-1 min-h-11 w-full rounded-md border px-2" /></label>
            </div>{line.merchantWeight !== null && line.predictedWeight !== null && <p className="mt-2 text-sm">Prévision : {number.format(line.predictedWeight)} kg · Marchand : {number.format(line.merchantWeight)} kg · Écart : {number.format(line.merchantWeight - line.predictedWeight)} kg</p>}</details>
          </article>;
        })}
      </div>

      {message && <p role="status" className="mt-4 rounded-md bg-yellow-100 p-3 font-semibold">{message}</p>}
      <div className="fixed bottom-16 left-3 right-3 z-30 mx-auto grid max-w-3xl grid-cols-1 gap-2 rounded-lg border border-gray-300 bg-white p-2 shadow-xl sm:grid-cols-2">
        <button type="button" onClick={() => void save()} disabled={saving || selectedIds.length === 0} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-green-700 px-4 font-bold text-white disabled:bg-gray-400"><Save size={19} />{saving ? "Enregistrement…" : "Enregistrer la simulation"}</button>
        {simulationId ? <Link href={`/troupeau/simulations-vente/${simulationId}/vente`} className="flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-green-700 px-4 font-bold text-green-800"><ShoppingCart size={19} />Confirmer la vente</Link> : <span className="flex min-h-12 items-center justify-center text-center text-xs text-gray-500">Enregistrez avant de confirmer la vente</span>}
      </div>
    </main>
  );
}
