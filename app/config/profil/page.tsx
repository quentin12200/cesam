"use client";

import Link from "next/link";
import { ArrowLeft, Home, LayoutDashboard, UserRound } from "lucide-react";
import {
  useUserPreferences,
  type CesamProfile,
} from "@/components/UserPreferencesProvider";

const PROFILES: CesamProfile[] = ["Céline", "Samuel"];

export default function ProfileConfigPage() {
  const { profile, setProfile, ready } = useUserPreferences();

  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-3 py-4 pb-24 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/config"
          aria-label="Retour aux paramètres"
          title="Retour aux paramètres"
          className="rounded-lg bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900">
            Profil et personnalisation
          </h1>
          <p className="text-sm text-slate-500">
            Adaptez CESAM à votre manière de travailler.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <UserRound size={19} className="text-green-700" />
            <h2 className="font-extrabold text-slate-900">
              Profil utilisé sur cet appareil
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Le profil choisi détermine la disposition des écrans et les actions
            rapides affichées.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {PROFILES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={!ready}
                aria-pressed={profile === item}
                onClick={() => setProfile(item)}
                className={`min-h-12 rounded-xl border px-3 text-sm font-extrabold transition disabled:opacity-50 ${
                  profile === item
                    ? "border-green-700 bg-green-50 text-green-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-green-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            Le choix du profil est enregistré sur cet appareil. Les
            personnalisations du profil Céline ou Samuel sont partagées avec les
            autres appareils utilisant le même profil.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={19} className="text-slate-600" />
            <h2 className="font-extrabold text-slate-900">
              Disposition des écrans
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            L’ordre et la visibilité des sections peuvent être personnalisés
            pour chaque profil.
          </p>
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold leading-5 text-slate-600">
            Utilisez « Modifier la mise en page » depuis les écrans concernés
            sur ordinateur.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Home size={19} className="text-slate-600" />
            <h2 className="font-extrabold text-slate-900">
              Actions rapides de l’accueil
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Choisissez les raccourcis affichés sur l’accueil pour le profil
            actif.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-green-700 px-4 text-sm font-bold text-green-800 hover:bg-green-50 sm:w-auto"
          >
            Gérer sur l’accueil
          </Link>
        </section>
      </div>
    </div>
  );
}
