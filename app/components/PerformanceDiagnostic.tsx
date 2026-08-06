"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavigationMeasure = {
  from: string;
  to: string;
  durationMs: number;
};

const STORAGE_KEY = "cesam:performance-diagnostic";

export default function PerformanceDiagnostic() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);
  const [measure, setMeasure] = useState<NavigationMeasure | null>(null);
  const pendingRef = useRef<{ from: string; to: string; startedAt: number } | null>(null);

  useEffect(() => {
    const debugRequested = searchParams.get("debugPerf") === "1";
    if (debugRequested) sessionStorage.setItem(STORAGE_KEY, "1");
    setEnabled(debugRequested || sessionStorage.getItem(STORAGE_KEY) === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!enabled) return;

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}`;
      const destination = `${url.pathname}${url.search}`;
      if (destination === current) return;

      pendingRef.current = {
        from: current,
        to: destination,
        startedAt: performance.now(),
      };
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pendingRef.current) return;
    const pending = pendingRef.current;
    const current = `${pathname}${window.location.search}`;
    if (!current.startsWith(pending.to.split("?")[0])) return;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMeasure({
          from: pending.from,
          to: current,
          durationMs: Math.round(performance.now() - pending.startedAt),
        });
        pendingRef.current = null;
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [enabled, pathname, searchParams]);

  if (!enabled) return null;

  return (
    <aside className="print:hidden fixed bottom-3 left-3 right-3 z-[100] rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shadow-lg sm:left-auto sm:w-80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">Diagnostic vitesse</p>
          {measure ? (
            <>
              <p className="mt-1 text-lg font-black">{measure.durationMs} ms</p>
              <p className="truncate text-[11px] opacity-75">{measure.from} → {measure.to}</p>
            </>
          ) : (
            <p className="mt-1">Clique sur Troupeau puis sur une fiche animale.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setEnabled(false);
          }}
          className="shrink-0 rounded-lg border border-amber-400 bg-white px-2 py-1 font-semibold"
        >
          Fermer
        </button>
      </div>
    </aside>
  );
}
