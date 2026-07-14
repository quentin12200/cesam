"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2 } from "lucide-react";

interface ConfirmationEntry {
  id: string;
}

const UndoContext = createContext<{
  showUndo: (id: string, desc: string) => void;
}>({
  showUndo: () => {},
});

export function useUndo() {
  return useContext(UndoContext);
}

function ConfirmationToast() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 bg-green-700 text-white rounded-lg shadow-lg px-3 py-2"
    >
      <CheckCircle2 size={15} />
      <span className="text-sm font-medium">Enregistré</span>
    </div>
  );
}

export default function UndoProvider({ children }: { children: React.ReactNode }) {
  const [confirmation, setConfirmation] = useState<ConfirmationEntry | null>(null);
  const showUndoRef = useRef<(id: string, desc: string) => void>(() => {});

  const showUndo = useCallback((id: string) => {
    const confirmationId =
      id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setConfirmation({ id: confirmationId });
    setTimeout(() => {
      setConfirmation((current) =>
        current?.id === confirmationId ? null : current
      );
    }, 2000);
  }, []);

  useEffect(() => {
    showUndoRef.current = showUndo;
  }, [showUndo]);

  // Affiche une confirmation discrète après chaque modification réussie.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const response = await originalFetch(...args);

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
          response.ok
        ) {
          showUndoRef.current(
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            "Enregistré"
          );
        }
      } catch {}

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {confirmation && (
        <div className="fixed bottom-24 right-3 z-50 pointer-events-none">
          <ConfirmationToast />
        </div>
      )}
    </UndoContext.Provider>
  );
}
