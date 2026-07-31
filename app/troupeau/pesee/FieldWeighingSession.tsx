"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Scale, Sun, X } from "lucide-react";
import { selectedAverage } from "@/lib/field-weighing";

type SessionEntry = {
  id: string;
  nutrav: string;
  sexe: "M" | "F";
  poids: number;
  gmq: number | null;
  selected: boolean;
};

type StoredSession = {
  startedAt: string;
  entries: SessionEntry[];
  summaryOpen: boolean;
};

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const STORAGE_KEY = "cesam:field-weighing-session";

function createSession(): StoredSession {
  return { startedAt: new Date().toISOString(), entries: [], summaryOpen: false };
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function FieldWeighingSession() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [nutrav, setNutrav] = useState("");
  const [poids, setPoids] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      setSession(saved ? (JSON.parse(saved) as StoredSession) : createSession());
    } catch {
      setSession(createSession());
    }
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    let mounted = true;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const sentinel = await (
          navigator as Navigator & {
            wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
          }
        ).wakeLock.request("screen");
        if (!mounted) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener("release", () => setWakeLockActive(false));
      } catch {
        setWakeLockActive(false);
      }
    }

    void requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wakeLockRef.current?.released !== false) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void wakeLockRef.current?.release();
    };
  }, []);

  const summaryOpen = session?.summaryOpen;
  useEffect(() => {
    if (summaryOpen === false) numberRef.current?.focus();
  }, [summaryOpen]);

  const selected = useMemo(
    () => session?.entries.filter((entry) => entry.selected) ?? [],
    [session?.entries],
  );
  const average = selectedAverage(selected);

  if (!session) {
    return <div className="min-h-[70vh] bg-white" aria-label="Chargement de la séance" />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const activeSession = session;
    if (!activeSession) return;

    const cleanNumber = nutrav.trim();
    const numericWeight = Number(poids);

    if (!cleanNumber) {
      setError("Saisissez le numéro de l’animal.");
      numberRef.current?.focus();
      return;
    }
    if (!Number.isInteger(numericWeight) || numericWeight <= 0 || numericWeight > 2000) {
      setError("Saisissez un poids entier valide.");
      weightRef.current?.focus();
      return;
    }
    if (activeSession.entries.some((entry) => entry.nutrav === cleanNumber)) {
      setError(`L’animal ${cleanNumber} est déjà pesé dans cette séance.`);
      setNutrav("");
      setPoids("");
      numberRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pesees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrav: cleanNumber,
          poids: numericWeight,
          date: todayLocal(),
          sessionStartedAt: activeSession.startedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La pesée n’a pas pu être enregistrée.");

      setSession((current) =>
        current
          ? {
              ...current,
              entries: [
                {
                  id: result.pesee.id,
                  nutrav: result.animal.nutrav,
                  sexe: result.animal.sexe === "M" ? "M" : "F",
                  poids: result.pesee.poids,
                  gmq: result.gmq,
                  selected: true,
                },
                ...current.entries,
              ],
            }
          : current,
      );
      setNutrav("");
      setPoids("");
      requestAnimationFrame(() => numberRef.current?.focus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La pesée n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    setSession((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) =>
              entry.id === id ? { ...entry, selected: !entry.selected } : entry,
            ),
          }
        : current,
    );
  }

  function startNewSession() {
    setSession(createSession());
    setNutrav("");
    setPoids("");
    setError("");
  }

  const males = session.entries.filter((entry) => entry.sexe === "M");
  const females = session.entries.filter((entry) => entry.sexe === "F");

  return (
    <div className="min-h-full bg-white text-black">
      <header className="sticky top-0 z-20 border-b-4 border-black bg-white px-3 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href="/troupeau"
            className="flex min-h-12 min-w-12 items-center justify-center border-2 border-black bg-white"
            aria-label="Retour au troupeau"
          >
            <ArrowLeft size={30} strokeWidth={3} />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="text-2xl font-black leading-none">PESÉE RAPIDE</h1>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm font-extrabold">
              {wakeLockActive ? <Sun size={18} strokeWidth={3} /> : <Lock size={18} strokeWidth={3} />}
              {wakeLockActive ? "Écran maintenu allumé" : "Maintien d’écran indisponible"}
            </p>
          </div>
          <Scale size={42} strokeWidth={3} aria-hidden="true" />
        </div>
      </header>

      {!session.summaryOpen ? (
        <main className="mx-auto max-w-3xl px-3 py-5">
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xl font-black">NUMÉRO ANIMAL</span>
              <input
                ref={numberRef}
                value={nutrav}
                onChange={(event) => setNutrav(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && nutrav.trim()) {
                    event.preventDefault();
                    weightRef.current?.focus();
                  }
                }}
                inputMode="numeric"
                autoComplete="off"
                className="h-24 w-full border-4 border-black bg-white px-4 text-center text-5xl font-black text-black outline-none focus:ring-4 focus:ring-yellow-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xl font-black">POIDS (KG)</span>
              <input
                ref={weightRef}
                value={poids}
                onChange={(event) => setPoids(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                className="h-24 w-full border-4 border-black bg-white px-4 text-center text-5xl font-black text-black outline-none focus:ring-4 focus:ring-yellow-400"
              />
            </label>

            {error && (
              <div role="alert" className="border-4 border-red-700 bg-red-100 p-4 text-lg font-black text-red-900">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-20 w-full items-center justify-center gap-3 border-4 border-black bg-green-600 px-4 text-2xl font-black text-black active:bg-green-400 disabled:bg-yellow-300"
            >
              <Check size={36} strokeWidth={4} />
              {saving ? "ENREGISTREMENT…" : "VALIDER LA PESÉE"}
            </button>
          </form>

          {session.entries[0] && (
            <section className="mt-6 border-4 border-black bg-yellow-200 p-4">
              <p className="text-sm font-black">DERNIÈRE PESÉE VALIDÉE</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <strong className="text-4xl font-black">{session.entries[0].nutrav}</strong>
                <strong className="text-4xl font-black">{session.entries[0].poids} kg</strong>
              </div>
              <p className="mt-2 text-lg font-black">
                {session.entries[0].gmq === null
                  ? "GMQ non calculable"
                  : `GMQ : ${session.entries[0].gmq.toFixed(1).replace(".", ",")} kg/j`}
              </p>
            </section>
          )}

          <button
            type="button"
            disabled={session.entries.length === 0}
            onClick={() => setSession({ ...session, summaryOpen: true })}
            className="mt-6 min-h-16 w-full border-4 border-black bg-black px-4 text-xl font-black text-white disabled:border-neutral-500 disabled:bg-neutral-500"
          >
            FIN DE SÉANCE · {session.entries.length} PESÉ{session.entries.length > 1 ? "ES" : "E"}
          </button>
        </main>
      ) : (
        <main className="mx-auto max-w-3xl px-3 py-5">
          <section className="border-4 border-black bg-yellow-300 p-4 text-center">
            <p className="text-lg font-black">LOT SIMULÉ</p>
            <p className="mt-1 text-4xl font-black">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</p>
            <p className="mt-1 text-3xl font-black">
              Moyenne : {average === null ? "—" : `${average} kg`}
            </p>
          </section>

          <SummaryGroup title="MÂLES" entries={males} onToggle={toggle} />
          <SummaryGroup title="FEMELLES" entries={females} onToggle={toggle} />

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSession({ ...session, summaryOpen: false })}
              className="min-h-16 border-4 border-black bg-white px-4 text-xl font-black"
            >
              REPRENDRE LA SÉANCE
            </button>
            <button
              type="button"
              onClick={startNewSession}
              className="min-h-16 border-4 border-black bg-green-600 px-4 text-xl font-black"
            >
              NOUVELLE SÉANCE
            </button>
          </div>
          <p className="mt-4 text-center text-base font-extrabold">
            La sélection ne modifie et ne supprime aucun poids.
          </p>
        </main>
      )}
    </div>
  );
}

function SummaryGroup({
  title,
  entries,
  onToggle,
}: {
  title: string;
  entries: SessionEntry[];
  onToggle: (id: string) => void;
}) {
  const selectedEntries = entries.filter((entry) => entry.selected);
  const average = selectedAverage(selectedEntries);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between border-b-4 border-black pb-2">
        <h2 className="text-2xl font-black">{title}</h2>
        <strong className="text-lg font-black">
          {selectedEntries.length} · {average === null ? "—" : `${average} kg`}
        </strong>
      </div>
      {entries.length === 0 ? (
        <p className="border-x-4 border-b-4 border-black p-4 text-lg font-black">AUCUN</p>
      ) : (
        entries.map((entry) => (
          <label
            key={entry.id}
            className="flex min-h-20 cursor-pointer items-center gap-4 border-x-4 border-b-4 border-black px-4"
          >
            <input
              type="checkbox"
              checked={entry.selected}
              onChange={() => onToggle(entry.id)}
              className="h-9 w-9 shrink-0 accent-black"
            />
            <span className="min-w-0 flex-1 text-2xl font-black">{entry.nutrav}</span>
            <span className="text-2xl font-black">{entry.poids} kg</span>
            {entry.selected ? (
              <Check size={30} strokeWidth={4} aria-hidden="true" />
            ) : (
              <X size={30} strokeWidth={4} aria-hidden="true" />
            )}
          </label>
        ))
      )}
    </section>
  );
}
