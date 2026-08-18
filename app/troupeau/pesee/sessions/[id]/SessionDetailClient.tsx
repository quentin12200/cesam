"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LogOut, Scale } from "lucide-react";
import type { WeighingSessionHistoryDetail } from "@/lib/weighing-session-history";
import { statusLabel } from "@/lib/weighing-session-history";
import { isHistorySessionReadOnly } from "@/lib/weighing-session-history";
import { sortEntriesByWeight, type PriceGroup } from "@/lib/price-simulation";
import WeighingAnimalDetails from "../../WeighingAnimalDetails";
import PriceSimulation from "../../PriceSimulation";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default function SessionDetailClient({ initialSession }: { initialSession: WeighingSessionHistoryDetail }) {
  const [groups, setGroups] = useState(initialSession.priceGroups);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function saveGroups(nextGroups: PriceGroup[]) {
    const previous = groups;
    setGroups(nextGroups);
    setMessage("");
    try {
      const response = await fetch(`/api/weighing-sessions/${initialSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPeseeIds: initialSession.entries.filter((entry) => entry.selected).map((entry) => entry.id),
          summaryOpen: true,
          simulationOpen: true,
          priceGroups: nextGroups,
        }),
      });
      if (!response.ok) throw new Error("La simulation n’a pas pu être enregistrée.");
      setMessage("Simulation enregistrée pour cette séance.");
    } catch (error) {
      setGroups(previous);
      setMessage(error instanceof Error ? error.message : "La simulation n’a pas pu être enregistrée.");
    }
  }

  if (simulationOpen) {
    return (
      <div>
        <div className="mx-auto max-w-4xl border-b-2 border-black bg-yellow-100 px-3 py-2 text-center text-sm font-bold">
          Simulation liée à la séance du {dateTimeFormat.format(new Date(initialSession.startedAt))}
        </div>
        {message && <p role="status" className="mx-auto max-w-4xl bg-yellow-200 px-3 py-2 text-center font-semibold">{message}</p>}
        <PriceSimulation entries={initialSession.entries} groups={groups} onGroupsChange={(next) => void saveGroups(next)} onBack={() => setSimulationOpen(false)} />
      </div>
    );
  }

  const entries = sortEntriesByWeight(initialSession.entries);
  return (
    <main className="mx-auto max-w-4xl px-3 py-4 pb-24 text-gray-950">
      <div className="flex items-start gap-3 border-b-2 border-black pb-3">
        <Link href="/troupeau/pesee/sessions" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-300" aria-label="Retour aux séances"><ArrowLeft size={22} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Séance du {dateTimeFormat.format(new Date(initialSession.startedAt))}</h1>
          <p className="mt-1 font-semibold">{statusLabel(initialSession.status)} · {initialSession.count} animaux</p>
        </div>
      </div>

      {!isHistorySessionReadOnly(initialSession.status) && (
        <section className="mt-4 rounded-md border-2 border-green-700 bg-green-50 p-3">
          <p className="font-bold">Cette séance est toujours en cours.</p>
          <Link href="/troupeau/pesee" className="mt-3 flex min-h-12 items-center justify-center rounded-md bg-green-700 px-4 font-bold text-white">Reprendre la séance</Link>
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-gray-300 bg-gray-300 sm:grid-cols-4">
        <Indicator label="Animaux" value={String(initialSession.count)} />
        <Indicator label="Mâles / Femelles" value={`${initialSession.males} / ${initialSession.females}`} />
        <Indicator label="Poids moyen" value={initialSession.averageWeight === null ? "—" : `${initialSession.averageWeight} kg`} />
        <Indicator label="GMQ moyen" value={initialSession.averageGmq === null ? "Non disponible" : `${initialSession.averageGmq.toFixed(1).replace(".", ",")} kg/j`} />
      </section>

      <button type="button" onClick={() => setSimulationOpen(true)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-black bg-white px-4 font-bold">
        <Scale size={20} /> {groups.length > 0 ? "Ouvrir la simulation enregistrée" : "Créer une simulation à partir de cette séance"}
      </button>

      {entries.length > 0 && (
        <Link
          href={`/troupeau/pesee/sessions/${initialSession.id}/vente`}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 font-bold text-white"
        >
          <LogOut size={20} /> Vendre / sortir des animaux
        </Link>
      )}

      <section className="mt-6">
        <h2 className="border-b-2 border-black pb-2 text-xl font-bold">Animaux pesés</h2>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-gray-600">Aucune pesée enregistrée dans cette séance.</p>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-3 md:pt-3">
            {entries.map((entry) => (
              <article key={entry.id} className="flex gap-3 border-b border-gray-300 py-3 md:rounded-md md:border md:p-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 ${entry.selected ? "border-black bg-black text-white" : "border-gray-400 bg-white"}`} aria-label={entry.selected ? "Sélectionné dans le récapitulatif" : "Non sélectionné dans le récapitulatif"}>
                  {entry.selected && <Check size={20} strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-black">{entry.nutrav} — {entry.poids} kg</p>
                  <WeighingAnimalDetails entry={entry} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-3"><p className="text-xs font-semibold text-gray-600">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
