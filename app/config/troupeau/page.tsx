import Link from "next/link";
import { AlertTriangle, ArrowLeft, Tags } from "lucide-react";
import IdentificationSettings from "@/components/IdentificationSettings";

export default function HerdConfigPage() {
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
            Troupeau et identification
          </h1>
          <p className="text-sm text-slate-500">
            Gérez les lots de boucles et la numérotation des animaux.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <Tags size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-extrabold text-slate-900">
                Lots de boucles et numérotation
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                Toute l’exploitation
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Ces réglages déterminent les numéros proposés lors de
              l’identification des prochains animaux.
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Une modification s’applique à toute l’exploitation. Vérifiez les
            numéros avant d’enregistrer.
          </span>
        </p>

        <IdentificationSettings />
      </section>
    </div>
  );
}
