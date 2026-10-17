"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import BouclageIndicator from "./BouclageIndicator";
import type { BouclageInfo } from "@/lib/bouclage";

const Lookup = createContext<{
  records: Record<string, BouclageInfo>;
  markDone: (nutrav: string) => void;
} | null>(null);

/** Métadonnées éphémères pour les séances client : aucun statut en localStorage. */
export function BouclageLookupProvider({ nutravs, children }: { nutravs: string[]; children: ReactNode }) {
  const key = [...new Set(nutravs)].sort().join(",");
  const [records, setRecords] = useState<Record<string, BouclageInfo>>({});
  const [revision, setRevision] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    async function load() {
      const requestVersion = ++version.current;
      try {
        const numbers = key.split(",");
        const batches: string[][] = [];
        for (let i = 0; i < numbers.length; i += 200) batches.push(numbers.slice(i, i + 200));
        const results = await Promise.all(batches.map(async (batch) => {
          const response = await fetch(`/api/animaux?nutravs=${encodeURIComponent(batch.join(","))}`, { signal: controller.signal });
          if (!response.ok) throw new Error("Lookup unavailable");
          return await response.json() as { animaux: Array<BouclageInfo & { nutrav: string }> };
        }));
        if (!controller.signal.aborted && requestVersion === version.current) setRecords(Object.fromEntries(results.flatMap((result) => result.animaux.map((animal) => [animal.nutrav, animal]))));
      } catch {
        // Hors ligne : aucun état supposé ou persistant, les pesées restent utilisables.
      }
    }
    void load();
    window.addEventListener("online", load);
    return () => { controller.abort(); window.removeEventListener("online", load); };
  }, [key, revision]);

  function markDone(nutrav: string) {
    version.current += 1;
    setRecords((current) => ({ ...current, [nutrav]: { ...current[nutrav], boucleFaite: true } }));
    setRevision((current) => current + 1);
  }

  return <Lookup.Provider value={{ records, markDone }}>{children}</Lookup.Provider>;
}

export function BouclageLookupIndicator({ nutrav }: { nutrav: string }) {
  const lookup = useContext(Lookup);
  const info = lookup?.records[nutrav];
  return info ? <BouclageIndicator nutrav={nutrav} {...info} onMarkedDone={() => lookup?.markDone(nutrav)} /> : null;
}
