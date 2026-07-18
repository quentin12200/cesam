"use client";

import { useState } from "react";
import { Settings, X, UserRound, Mic, Loader2 } from "lucide-react";
import { useUserPreferences, type CesamProfile } from "@/components/UserPreferencesProvider";

const PROFILES: CesamProfile[] = ["Céline", "Samuel"];

interface NoteHisto {
  id: string;
  texte: string;
  traitee: boolean;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function GlobalSettingsButton() {
  const { profile, setProfile, ready } = useUserPreferences();
  const [open, setOpen] = useState(false);
  const [histoOpen, setHistoOpen] = useState(false);
  const [notes, setNotes] = useState<NoteHisto[] | null>(null);
  const [loadingHisto, setLoadingHisto] = useState(false);
  const [histoError, setHistoError] = useState("");

  async function ouvrirHistorique() {
    const prochainEtat = !histoOpen;
    setHistoOpen(prochainEtat);
    if (prochainEtat && notes === null && !loadingHisto) {
      setLoadingHisto(true);
      setHistoError("");
      try {
        const res = await fetch("/api/notes-terrain?historique=1");
        if (!res.ok) throw new Error();
        setNotes(await res.json());
      } catch {
        setHistoError("Impossible de charger l'historique");
      } finally {
        setLoadingHisto(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Paramètres"
        title="Paramètres"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-green-100 hover:bg-green-600 hover:text-white"
      >
        <Settings size={17} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-4 text-gray-900 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="settings-title" className="text-lg font-bold">Paramètres CESAM</h2>
                <p className="text-xs text-gray-500">Réglages généraux et personnalisation</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <X size={19} />
              </button>
            </div>

            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <UserRound size={17} />
                Profil utilisé sur cet appareil
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Chaque profil conserve ses propres mises en page.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PROFILES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={!ready}
                    onClick={() => setProfile(item)}
                    className={`min-h-12 rounded-xl border px-3 text-sm font-bold ${
                      profile === item
                        ? "border-green-700 bg-green-50 text-green-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={ouvrirHistorique}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <Mic size={17} />
                  Historique des notes vocales
                </span>
                <span className="text-sm font-bold text-gray-400 transition-transform" style={{ transform: histoOpen ? "rotate(180deg)" : "none" }}>⌄</span>
              </button>
              {histoOpen && (
                <div className="mt-3">
                  {loadingHisto && (
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Chargement…
                    </p>
                  )}
                  {histoError && <p className="text-xs text-red-600">{histoError}</p>}
                  {!loadingHisto && !histoError && notes && notes.length === 0 && (
                    <p className="text-xs text-gray-500">Aucune note vocale enregistrée.</p>
                  )}
                  {!loadingHisto && notes && notes.length > 0 && (
                    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {notes.map((n) => (
                        <li key={n.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                          <p className="text-sm text-gray-800 leading-snug">« {n.texte} »</p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-gray-400">{formatDate(n.createdAt)}</span>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${n.traitee ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {n.traitee ? "Traitée" : "À traiter"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Sur ordinateur, utilisez « Modifier la mise en page » pour changer l’ordre ou masquer des sections. La disposition enregistrée est ensuite appliquée automatiquement sur le téléphone du même profil.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
