"use client";

import { useState } from "react";
import { Settings, X, UserRound } from "lucide-react";
import { useUserPreferences, type CesamProfile } from "@/components/UserPreferencesProvider";

const PROFILES: CesamProfile[] = ["Céline", "Samuel"];

export default function GlobalSettingsButton() {
  const { profile, setProfile, ready } = useUserPreferences();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Paramètres"
        title="Paramètres"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-green-50 hover:bg-green-600 hover:text-white"
      >
        <Settings size={21} />
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

            <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Dans chaque module, utilisez « Modifier la mise en page » pour changer l’ordre, masquer des sections ou choisir la densité.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
