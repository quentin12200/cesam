export const dynamic = "force-dynamic";

import BackButton from "@/app/components/BackButton";
import { getCampagnesReproduction, type CampagneAnimal } from "@/lib/reproduction-campaign";
import { CalendarDays, ChevronDown, Percent, Venus } from "lucide-react";

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR");
}

function formatTaux(taux: number | null) {
  if (taux == null) return "—";
  return `${Number.isInteger(taux) ? taux.toFixed(0) : taux.toFixed(1)} %`;
}

function ListeAnimaux({ titre, animaux }: { titre: string; animaux: CampagneAnimal[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">{titre} ({animaux.length})</p>
      {animaux.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun animal compté</p>
      ) : (
        <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border-y border-gray-100">
          {animaux.map((animal) => (
            <div key={animal.id} className="min-h-10 flex items-center gap-2 py-2 text-sm">
              <span className="font-semibold text-green-700">{animal.nutrav}</span>
              <span className="min-w-0 flex-1 truncate text-gray-700">{animal.nom || "Sans nom"}</span>
              <span className="text-xs text-gray-400">{formatDate(animal.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ProductiviteNumeriquePage() {
  const campagnes = await getCampagnesReproduction();
  const anneeCourante = new Date().getFullYear();
  const actuelle = campagnes.find((item) => item.annee === anneeCourante) ?? campagnes[campagnes.length - 1];
  const maximum = Math.max(...campagnes.map((item) => item.productiviteNumerique ?? 0), 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-5 max-w-2xl md:max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-3 mt-2">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50" iconSize={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-800">Productivité numérique</h2>
            <p className="text-xs text-gray-500">Veaux obtenus pour 100 femelles mises à la reproduction</p>
          </div>
        </div>

        {actuelle && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-green-700" />
              <div>
                <h3 className="font-semibold text-gray-800">Campagne {actuelle.annee}</h3>
                <p className="text-[11px] text-gray-400">Résultat provisoire tant que tous les veaux ne sont pas sevrés</p>
              </div>
              <span className="ml-auto text-2xl font-bold text-green-700">{formatTaux(actuelle.productiviteNumerique)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <Venus size={17} className="text-gray-500 mb-2" />
                <p className="text-xl font-bold text-gray-800">{actuelle.femelles.length}</p>
                <p className="text-xs text-gray-500">Femelles mises à la reproduction</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xl font-bold text-gray-800">{actuelle.veauxSevres.length}</p>
                <p className="text-xs text-gray-500">Veaux sevrés</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xl font-bold text-gray-800">{actuelle.veauxVendusAvantSevrage.length}</p>
                <p className="text-xs text-gray-500">Vendus vifs avant sevrage</p>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Percent size={18} className="text-green-700" />
            <h3 className="font-semibold text-gray-800">Évolution par campagne</h3>
          </div>
          {campagnes.slice().reverse().map((campagne) => (
            <details key={campagne.annee} className="group bg-white border border-gray-200 rounded-lg overflow-hidden">
              <summary className="min-h-14 cursor-pointer list-none flex items-center gap-3 px-3 py-2">
                <span className="w-12 font-bold text-gray-800">{campagne.annee}</span>
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{ width: `${campagne.productiviteNumerique == null ? 0 : Math.min((campagne.productiviteNumerique / maximum) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {campagne.veauxSevres.length} sevrés + {campagne.veauxVendusAvantSevrage.length} vendus vifs / {campagne.femelles.length} femelles
                  </p>
                </div>
                <span className="font-bold text-green-700">{formatTaux(campagne.productiviteNumerique)}</span>
                <ChevronDown size={17} className="text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-gray-100 p-3 space-y-4">
                <ListeAnimaux titre="Femelles mises à la reproduction" animaux={campagne.femelles} />
                <ListeAnimaux titre="Veaux sevrés sur l'exploitation" animaux={campagne.veauxSevres} />
                <ListeAnimaux titre="Veaux vendus vifs avant sevrage" animaux={campagne.veauxVendusAvantSevrage} />
              </div>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
