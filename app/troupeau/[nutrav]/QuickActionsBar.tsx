"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { ACTION_VISUALS } from "@/components/action-visuals";

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
}

interface Props {
  animalId: string;
  nutrav: string;
  isFemelle: boolean;
  isActif: boolean;
}

type Modal = "chaleur" | "saillie" | null;

const today = new Date().toISOString().slice(0, 10);
const ChaleurIcon = ACTION_VISUALS.chaleur.icon;
const SaillieIcon = ACTION_VISUALS.saillieIA.icon;
const EvenementIcon = ACTION_VISUALS.evenementSanitaire.icon;

export default function QuickActionsBar({ animalId, nutrav, isFemelle, isActif }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(false);
  const [taureaux, setTaureaux] = useState<Taureau[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Chaleur state
  const [chaleurDate, setChaleurDate] = useState(today);
  const [chaleurNotes, setChaleurNotes] = useState("");

  // Saillie state
  const [saillieDate, setSaillieDate] = useState(today);
  const [saillieType, setSaillieType] = useState<"IA" | "Naturelle">("IA");
  const [saillieTabId, setSaillieTabId] = useState("");

  const backdropRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal === "saillie" && taureaux.length === 0) {
      fetch("/api/taureaux")
        .then((r) => r.json())
        .then((d) => setTaureaux(d.taureaux ?? []));
    }
  }, [modal, taureaux.length]);

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
    setSaillieDate(today);
    setSaillieType("IA");
    setSaillieTabId("");
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

  async function submitSaillie() {
    setLoading(true);
    try {
      const res = await fetch("/api/saillies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId,
          date: saillieDate,
          type: saillieType,
          taureauId: saillieTabId || null,
        }),
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
        <div ref={menuRef} className="relative px-3 pt-2 pb-0.5">
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
                  onClick={() => { setMenuOpen(false); open("saillie"); }}
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
      {modal && (
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

            {/* ── Saillie ── */}
            {modal === "saillie" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <SaillieIcon size={18} className="text-fuchsia-600" />
                    Saillie / IA
                  </h3>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={saillieDate}
                      max={today}
                      onChange={(e) => setSaillieDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <div className="flex gap-2">
                      {(["IA", "Naturelle"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSaillieType(t)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            saillieType === t
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-green-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Taureau (optionnel)</label>
                    <select
                      value={saillieTabId}
                      onChange={(e) => setSaillieTabId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">— Non précisé —</option>
                      {taureaux.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nopere ?? t.nupere}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={submitSaillie}
                    disabled={!saillieDate || loading}
                    className="w-full py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 active:scale-98 transition-all"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer la saillie"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}

