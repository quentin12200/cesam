"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";

interface UndoEntry {
  id: string;
  desc: string;
  expiresAt: number;
}

const UndoContext = createContext<{ showUndo: (id: string, desc: string) => void }>({
  showUndo: () => {},
});

export function useUndo() {
  return useContext(UndoContext);
}

function UndoToast({
  entry,
  onUndo,
  onDismiss,
}: {
  entry: UndoEntry;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const total = entry.expiresAt - start;
    const tick = setInterval(() => {
      const remaining = Math.max(0, ((entry.expiresAt - Date.now()) / total) * 100);
      setPct(remaining);
      if (remaining <= 0) clearInterval(tick);
    }, 100);
    return () => clearInterval(tick);
  }, [entry.expiresAt]);

  return (
    <div className="flex flex-col bg-gray-900 text-white rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm flex-1 min-w-0 truncate">{entry.desc}</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap py-1 px-2.5 rounded-lg border border-amber-400/40 hover:bg-amber-400/10 transition-colors shrink-0"
        >
          <RotateCcw size={12} />
          Annuler
        </button>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-white transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-0.5 bg-gray-700">
        <div
          className="h-full bg-amber-400 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function UndoProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<UndoEntry[]>([]);
  const showUndoRef = useRef<(id: string, desc: string) => void>(() => {});

  const showUndo = useCallback((id: string, desc: string) => {
    const entry: UndoEntry = { id, desc, expiresAt: Date.now() + 8000 };
    setQueue((q) => [...q.slice(-2), entry]);
    setTimeout(() => setQueue((q) => q.filter((e) => e.id !== id)), 8000);
  }, []);

  useEffect(() => {
    showUndoRef.current = showUndo;
  }, [showUndo]);

  // Intercepts all API mutations globally — no need to touch individual components
  useEffect(() => {
    const orig = window.fetch.bind(window);
    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const res = await orig(...args);
      try {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof URL
            ? args[0].href
            : args[0] instanceof Request
            ? args[0].url
            : "";
        const method = (
          typeof args[1]?.method === "string"
            ? args[1].method
            : args[0] instanceof Request
            ? args[0].method
            : "GET"
        ).toUpperCase();
        if (
          url.includes("/api/") &&
          ["POST", "PATCH", "DELETE"].includes(method) &&
          !url.includes("/api/undo") &&
          !url.includes("/api/push") &&
          !url.includes("/api/seed") &&
          res.ok
        ) {
          res
            .clone()
            .json()
            .then((data: Record<string, unknown>) => {
              if (typeof data?._undoId === "string" && typeof data?._undoDesc === "string") {
                showUndoRef.current(data._undoId as string, data._undoDesc as string);
              }
            })
            .catch(() => null);
        }
      } catch {}
      return res;
    };
    return () => {
      window.fetch = orig;
    };
  }, []);

  async function handleUndo(id: string) {
    setQueue((q) => q.filter((e) => e.id !== id));
    try {
      await fetch(`/api/undo/${id}`, { method: "POST" });
    } catch {}
  }

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      <div className="fixed bottom-24 inset-x-0 z-50 flex flex-col gap-2 px-3 pointer-events-none">
        {queue.map((entry) => (
          <div key={entry.id} className="pointer-events-auto">
            <UndoToast
              entry={entry}
              onUndo={() => handleUndo(entry.id)}
              onDismiss={() => setQueue((q) => q.filter((e) => e.id !== entry.id))}
            />
          </div>
        ))}
      </div>
    </UndoContext.Provider>
  );
}
