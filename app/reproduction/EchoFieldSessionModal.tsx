"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Check, Search, X } from "lucide-react";

const DUREE_GESTATION = 285;

export interface EchoSessionCow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  saillieId: string | null;
  derniereSaillie: string | null;
  saillieType: string | null;
}

type EchoResult = "PLEINE" | "VIDE";
type FollowUp = "CYCLEE" | "METRITE" | "METRABOL" | "BOLUS";

interface EchoDraft {
  resultat?: EchoResult;
  joursGestation?: number;
  suivis: FollowUp[];
  remarque: string;
}

interface Props {
  vaches: EchoSessionCow[];
  onClose: () => void;
  onDone: (count: number, actionsCount: number) => void;
}

const FOLLOW_UPS: Array<{ id: FollowUp; label: string; createsAction?: boolean }> = [
  { id: "CYCLEE", label: "Cyclée" },
  { id: "METRITE", label: "Métrite", createsAction: true },
  { id: "METRABOL", label: "Metrabol à prévoir", createsAction: true },
  { id: "BOLUS", label: "Bolus à prévoir", createsAction: true },
];

function localDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function safeDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function defaultGestationDays(vache: EchoSessionCow, sessionDate: string) {
  if (!vache.derniereSaillie) return 45;
  return Math.max(1, Math.min(284, differenceInDays(safeDate(sessionDate), new Date(vache.derniereSaillie))));
}

function updateDraft(
  drafts: Record<string, EchoDraft>,
  animalId: string,
  updater: (current: EchoDraft) => EchoDraft,
) {
  const current = drafts[animalId] ?? { suivis: [], remarque: "" };
  return { ...drafts, [animalId]: updater(current) };
}

export default function EchoFieldSessionModal({ vaches, onClose, onDone }: Props) {
  const today = localDateValue();
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, EchoDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedCows = useMemo(() => [...vaches].sort((left, right) =>
    left.nutrav.localeCompare(right.nutrav, "fr", { numeric: true })
  ), [vaches]);
  const displayedCows = sortedCows.filter((vache) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return !normalizedQuery
      || vache.nutrav.toLocaleLowerCase("fr").includes(normalizedQuery)
      || (vache.nobovi ?? "").toLocaleLowerCase("fr").includes(normalizedQuery);
  });
  const completedCows = sortedCows.filter((vache) => drafts[vache.id]?.resultat);
  const actionCount = completedCows.reduce((total, vache) =>
    total + (drafts[vache.id]?.suivis ?? []).filter((suivi) => suivi !== "CYCLEE").length, 0
  );

  function chooseResult(vache: EchoSessionCow, resultat: EchoResult) {
    setDrafts((current) => updateDraft(current, vache.id, (draft) => ({
      ...draft,
      resultat,
      joursGestation: resultat === "PLEINE"
        ? draft.joursGestation ?? defaultGestationDays(vache, date)
        : undefined,
      suivis: resultat === "VIDE" ? draft.suivis : [],
    })));
  }

  function toggleFollowUp(animalId: string, suivi: FollowUp) {
    setDrafts((current) => updateDraft(current, animalId, (draft) => ({
      ...draft,
      suivis: draft.suivis.includes(suivi)
        ? draft.suivis.filter((item) => item !== suivi)
        : [...draft.suivis, suivi],
    })));
  }

  async function saveSession() {
    if (completedCows.length === 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/echographies/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          resultats: completedCows.map((vache) => ({
            animalId: vache.id,
            saillieId: vache.saillieId,
            resultat: drafts[vache.id].resultat,
            joursGestation: drafts[vache.id].joursGestation,
            suivis: drafts[vache.id].suivis,
            remarque: drafts[vache.id].remarque.trim() || undefined,
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "L’enregistrement a échoué");
      onDone(data.count ?? completedCows.length, data.actionsCount ?? actionCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’enregistrement a échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Saisie d’une séance d’échographies">
      <div className="flex h-full w-full flex-col bg-gray-50 sm:h-[min(94vh,900px)] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl">
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:rounded-t-2xl sm:pt-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-gray-950">Séance d’échographies</h2>
              <p className="text-xs text-gray-500">{completedCows.length}/{vaches.length} résultat{completedCows.length > 1 ? "s" : ""} saisi{completedCows.length > 1 ? "s" : ""}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Fermer">
              <X size={22} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_9.5rem] gap-2">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
              <Search size={17} className="shrink-0 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numéro ou nom" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <label className="relative flex min-h-12 items-center rounded-xl border border-amber-300 bg-amber-50 px-3">
              <CalendarDays size={17} className="pointer-events-none absolute left-3 text-amber-700" />
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Date de la séance"
                className="w-full bg-transparent pl-6 text-sm font-bold text-amber-950 outline-none"
              />
            </label>
          </div>
        </header>

        <main className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
          {displayedCows.map((vache) => {
            const draft = drafts[vache.id] ?? { suivis: [], remarque: "" };
            const joursGestation = draft.joursGestation ?? defaultGestationDays(vache, date);
            const conception = addDays(safeDate(date), -joursGestation);
            const terme = addDays(safeDate(date), DUREE_GESTATION - joursGestation);
            return (
              <article key={vache.id} className={`rounded-2xl border bg-white p-3 shadow-sm ${draft.resultat === "PLEINE" ? "border-green-400" : draft.resultat === "VIDE" ? "border-red-400" : "border-gray-200"}`}>
                <div className="flex min-w-0 items-baseline gap-2">
                  <strong className="shrink-0 font-mono text-lg text-green-900">{vache.nutrav}</strong>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">{vache.nobovi ?? "Sans nom"}</span>
                  {draft.resultat && <Check size={18} className={draft.resultat === "PLEINE" ? "text-green-600" : "text-red-600"} />}
                </div>
                <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
                  {vache.derniereSaillie
                    ? `${vache.saillieType === "IA" ? "IA" : "Saillie"} du ${format(new Date(vache.derniereSaillie), "d MMM yyyy", { locale: fr })}`
                    : "Aucune saillie enregistrée"}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => chooseResult(vache, "PLEINE")} className={`min-h-12 rounded-xl border-2 text-sm font-black ${draft.resultat === "PLEINE" ? "border-green-600 bg-green-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                    Pleine
                  </button>
                  <button type="button" onClick={() => chooseResult(vache, "VIDE")} className={`min-h-12 rounded-xl border-2 text-sm font-black ${draft.resultat === "VIDE" ? "border-red-500 bg-red-500 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                    Vide
                  </button>
                </div>

                {draft.resultat === "PLEINE" && (
                  <div className="mt-3 rounded-xl bg-green-50 p-3">
                    <label className="flex items-center justify-between gap-3 text-sm text-green-950">
                      <span className="font-semibold">Stade de gestation</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={284}
                          value={joursGestation}
                          onChange={(event) => setDrafts((current) => updateDraft(current, vache.id, (item) => ({ ...item, joursGestation: Math.max(1, Math.min(284, Number(event.target.value) || 1)) })))}
                          className="h-11 w-20 rounded-lg border border-green-300 bg-white px-2 text-center text-base font-black"
                        />
                        jours
                      </span>
                    </label>
                    <p className="mt-2 text-xs text-green-800">Début estimé : <strong>{format(conception, "d MMM yyyy", { locale: fr })}</strong> · Terme : <strong>{format(terme, "d MMM yyyy", { locale: fr })}</strong></p>
                    {!vache.saillieId && <p className="mt-1 text-[11px] font-semibold text-violet-700">Cette date de début sera enregistrée comme saillie probable.</p>}
                  </div>
                )}

                {draft.resultat === "VIDE" && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-bold text-gray-600">Précision ou suite à donner</p>
                    <div className="flex flex-wrap gap-2">
                      {FOLLOW_UPS.map((item) => {
                        const selected = draft.suivis.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleFollowUp(vache.id, item.id)}
                            className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${selected ? item.createsAction ? "border-orange-500 bg-orange-100 text-orange-900" : "border-sky-500 bg-sky-100 text-sky-900" : "border-gray-200 bg-white text-gray-600"}`}
                          >
                            {selected ? "✓ " : ""}{item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {draft.resultat && (
                  <input
                    value={draft.remarque}
                    onChange={(event) => setDrafts((current) => updateDraft(current, vache.id, (item) => ({ ...item, remarque: event.target.value })))}
                    placeholder="Note facultative"
                    className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-green-500"
                  />
                )}
              </article>
            );
          })}
          {displayedCows.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Aucune vache trouvée</p>}
        </main>

        <footer className="shrink-0 border-t border-gray-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">
          {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          {actionCount > 0 && <p className="mb-2 text-center text-xs font-semibold text-orange-700">{actionCount} action{actionCount > 1 ? "s" : ""} à faire {actionCount > 1 ? "seront ajoutées" : "sera ajoutée"} aux actualités</p>}
          <button
            type="button"
            onClick={saveSession}
            disabled={saving || completedCows.length === 0 || !date}
            className="min-h-12 w-full rounded-xl bg-blue-600 px-4 text-base font-black text-white disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : completedCows.length === 0 ? "Saisissez au moins un résultat" : `Enregistrer ${completedCows.length} résultat${completedCows.length > 1 ? "s" : ""}`}
          </button>
          {completedCows.length < vaches.length && completedCows.length > 0 && <p className="mt-1.5 text-center text-[11px] text-gray-500">Les {vaches.length - completedCows.length} vache{vaches.length - completedCows.length > 1 ? "s" : ""} non renseignée{vaches.length - completedCows.length > 1 ? "s" : ""} resteront dans « À écho ».</p>}
        </footer>
      </div>
    </div>
  );
}
