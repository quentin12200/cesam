"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScanLine, X } from "lucide-react";
import { ACTION_VISUALS } from "@/components/action-visuals";
import EchoModal from "./EchoModal";

interface Props {
  animalId: string;
  nutrav: string;
  isFemelle: boolean;
  isActif: boolean;
  saillieId?: string | null;
  saillieDate?: string | null;
  className?: string;
}

type Modal = "chaleur" | "echo" | null;

const today = new Date().toISOString().slice(0, 10);
const ChaleurIcon = ACTION_VISUALS.chaleur.icon;
const SaillieIcon = ACTION_VISUALS.saillieIA.icon;
const EvenementIcon = ACTION_VISUALS.evenementSanitaire.icon;

export default function QuickActionsBar({ animalId, nutrav, isFemelle, isActif, saillieId, saillieDate, className }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Chaleur state
  const [chaleurDate, setChaleurDate] = useState(today);
  const [chaleurNotes, setChaleurNotes] = useState("");

  const backdropRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function open(m: Modal) {
    setChaleurDate(today);
    setChaleurNotes("");
    setModal(m);
  }

  function close() {
    setModal(null);
  }

  async function submitChaleur() {
    setLoading(true);
    try {
      const res = await fetch("/api/chaleurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId, date: chaleurDate, notes: chaleurNotes || null }),
      });
      if (!res.ok) throw new Error("Erreur");
      close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Accès compact aux actions de l'animal */}
      {isActif && (
        <div ref={menuRef} className={`relative ${className ?? "px-3 pt-2 pb-0.5"}`}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 active:scale-[0.97]"
          >
            <Plus size={19} />
            Ajouter
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-3 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
            >
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setModal("echo"); }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50"
                >
                  <ScanLine size={19} />
                  Échographie
                </button>
              )}
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); open("chaleur"); }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-pink-700 hover:bg-pink-50"
                >
                  <ChaleurIcon size={19} />
                  Chaleur
                </button>
              )}
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/reproduction?action=saillie&animaux=${encodeURIComponent(animalId)}`);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50"
                >
                  <SaillieIcon size={19} />
                  Saillie / IA
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => router.push(`/sanitaire/nouvel-evenement?animal=${encodeURIComponent(nutrav)}`)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                <EvenementIcon size={19} />
                Événement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal backdrop */}
      {modal === "chaleur" && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === backdropRef.current) close(); }}
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            {/* ── Chaleur ── */}
            {modal === "chaleur" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ChaleurIcon size={18} className="text-pink-600" />
                    Chaleur observée
                  </h3>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={chaleurDate}
                      max={today}
                      onChange={(e) => setChaleurDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optionnel)</label>
                    <input
                      type="text"
                      value={chaleurNotes}
                      onChange={(e) => setChaleurNotes(e.target.value)}
                      placeholder="Observation…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                  </div>
                  <button
                    onClick={submitChaleur}
                    disabled={!chaleurDate || loading}
                    className="w-full py-2.5 bg-pink-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 active:scale-98 transition-all"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer la chaleur"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      {modal === "echo" && (
        <EchoModal
          nutrav={nutrav}
          saillieId={saillieId}
          saillieDate={saillieDate}
          onClose={close}
          onDone={() => { close(); router.refresh(); }}
        />
      )}
    </>
  );
}

