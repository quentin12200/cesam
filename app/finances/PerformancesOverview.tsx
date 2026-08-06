import Link from "next/link";
import { Baby, ClipboardList, HeartPulse, LayoutDashboard, Percent, Scale, TrendingUp } from "lucide-react";
import FinancesTabs from "./FinancesTabs";

export default function PerformancesOverview() {
  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto pb-24">
      <h2 className="text-xl font-bold text-gray-800 mt-2">Finances</h2>
      <FinancesTabs active="performances" />

      <section className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Performances techniques</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <Link href="/finances/performances/vue-ensemble" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-50 text-green-700 shrink-0">
              <LayoutDashboard size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Vue d’ensemble de l’élevage</p>
              <p className="text-xs text-gray-500">Composition du troupeau, gestation, vêlages et mortalité</p>
            </div>
          </Link>
          <Link href="/troupeau/gmq" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-50 text-green-700 shrink-0">
              <TrendingUp size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">GMQ et poids</p>
              <p className="text-xs text-gray-500">Croissance des veaux, poids moyens et résultats par père et par mère</p>
            </div>
          </Link>
          <Link href="/troupeau/performances" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <Scale size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Performances des vaches</p>
              <p className="text-xs text-gray-500">IVV, GMQ de la descendance et score global</p>
            </div>
          </Link>
          <Link href="/finances/performances/bilan-campagne" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-50 text-green-700 shrink-0">
              <ClipboardList size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Bilan de campagne</p>
              <p className="text-xs text-gray-500">De la mise à la reproduction jusqu&apos;au sevrage</p>
            </div>
          </Link>
          <Link href="/finances/performances/productivite-numerique" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
              <Percent size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Productivité numérique</p>
              <p className="text-xs text-gray-500">Veaux obtenus pour 100 femelles mises à la reproduction</p>
            </div>
          </Link>
          <Link href="/finances/performances/mortalite-veaux" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-red-50 text-red-700 shrink-0">
              <HeartPulse size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Mortalité des veaux</p>
              <p className="text-xs text-gray-500">Morts-nés et mortalité avant sevrage, analysés séparément</p>
            </div>
          </Link>
          <Link href="/finances/performances/gestation" className="min-h-16 flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-rose-50 text-rose-700 shrink-0">
              <Baby size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800">Gestation</p>
              <p className="text-xs text-gray-500">Durées, sexe des veaux, mode de saillie et âge des mères</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
