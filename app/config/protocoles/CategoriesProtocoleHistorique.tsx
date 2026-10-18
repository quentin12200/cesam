"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  basculerCategorieVaccinale, categorieVaccinaleSelectionnee,
  FAMILLES_CATEGORIES, lireCategoriesHistoriques,
} from "@/lib/vaccine-category-selection";
import { comparerPopulationCible } from "@/lib/vaccine-category-impact";
import type { AnimalApercuAge } from "@/lib/vaccine-age-preview";

type ProtocoleHistorique = {
  id: string; label: string; categoriesJson: string | null;
  sexeCible: string | null; gestante: boolean | null;
  rangVelageMin: number | null; rangVelageMax: number | null; lotCible: string | null;
};

/**
 * Édition volontairement limitée aux catégories. Aucun retour vers le questionnaire
 * complet : ses étapes historiques ne doivent ni être converties ni être reconstruites.
 */
export default function CategoriesProtocoleHistorique({
  protocole, animaux,
}: { protocole: ProtocoleHistorique; animaux: AnimalApercuAge[] }) {
  const router = useRouter();
  const initial = lireCategoriesHistoriques(protocole.categoriesJson);
  const [ouvert, setOuvert] = useState(false);
  const [tous, setTous] = useState((initial?.length ?? 0) === 0);
  const [categories, setCategories] = useState<string[]>(initial ?? []);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const impact = useMemo(() => {
    if (!initial || (!tous && !categories.length)) return null;
    const criteres = {
      sexeCible: protocole.sexeCible, gestante: protocole.gestante,
      rangVelageMin: protocole.rangVelageMin, rangVelageMax: protocole.rangVelageMax,
      lotCible: protocole.lotCible,
    };
    return comparerPopulationCible(animaux,
      { ...criteres, categories: tous ? [] : categories },
      { ...criteres, categories: initial });
  }, [animaux, protocole, initial?.join(","), tous, categories]);
  const changement = Boolean(impact && (impact.nouvellementVises || impact.neSerontPlusVises));

  function ouvrir() {
    if (!initial) return;
    setTous(initial.length === 0);
    setCategories(initial);
    setConfirmation(false);
    setErreur("");
    setOuvert(true);
  }

  async function enregistrer() {
    if (!initial || (!tous && !categories.length) || (changement && !confirmation)) return;
    setEnCours(true); setErreur("");
    try {
      const reponse = await fetch(`/api/protocoles/${protocole.id}/categories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: tous ? [] : categories,
          expectedCategoriesJson: protocole.categoriesJson,
        }),
      });
      if (!reponse.ok) {
        const donnees = await reponse.json().catch(() => ({})) as { error?: string };
        throw new Error(donnees.error || "Enregistrement impossible.");
      }
      setOuvert(false);
      router.refresh();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (!initial) return <p className="mt-2 text-xs font-semibold text-red-800">
    Catégories historiques illisibles : modification bloquée pour protéger le protocole.
  </p>;
  return <div className="mt-2">
    {!ouvert && <button type="button" onClick={ouvrir}
      className="min-h-11 rounded-lg border border-green-700 px-3 text-sm font-semibold text-green-800">
      Modifier uniquement les catégories
    </button>}
    {ouvert && <div className="space-y-3 rounded-xl border border-green-300 bg-gray-50 p-3 text-sm">
      <p className="font-bold text-gray-900">Catégories du protocole {protocole.label}</p>
      <p className="text-xs text-gray-700">Les anciennes étapes, dates et vaccinations restent intactes. Les filtres existants (sexe, gestation, lot et rang de vêlage) sont conservés.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" aria-pressed={tous} onClick={() => { setTous(true); setCategories([]); setConfirmation(false); }}
          className={`min-h-11 rounded-lg border px-3 font-semibold ${tous ? "border-green-700 bg-green-50" : "bg-white"}`}>
          Tous les bovins
        </button>
        <button type="button" aria-pressed={!tous} onClick={() => { setTous(false); setConfirmation(false); }}
          className={`min-h-11 rounded-lg border px-3 font-semibold ${!tous ? "border-green-700 bg-green-50" : "bg-white"}`}>
          Certaines catégories
        </button>
      </div>
      {!tous && <div className="grid gap-2 sm:grid-cols-2">
        {FAMILLES_CATEGORIES.map((famille) => <div key={famille.code} className="rounded-lg border bg-white p-2">
          <button type="button" aria-pressed={categories.includes(famille.code)}
            onClick={() => { setCategories(basculerCategorieVaccinale(categories, famille.code)); setConfirmation(false); }}
            className={`min-h-11 w-full rounded-lg border px-2 text-left font-semibold ${categories.includes(famille.code) ? "border-green-700 bg-green-50" : "border-gray-300"}`}>
            {categories.includes(famille.code) ? "✓ " : "○ "}{famille.label}
          </button>
          {famille.enfants.length > 0 && <div className="mt-1 space-y-1">
            {famille.enfants.map((enfant) => <button type="button" key={enfant.code}
              aria-pressed={categorieVaccinaleSelectionnee(categories, enfant.code)}
              onClick={() => { setCategories(basculerCategorieVaccinale(categories, enfant.code)); setConfirmation(false); }}
              className={`min-h-10 w-full rounded-lg px-2 text-left text-xs ${categorieVaccinaleSelectionnee(categories, enfant.code) ? "bg-green-50 font-semibold text-green-900" : "bg-gray-50 text-gray-800"}`}>
              {categorieVaccinaleSelectionnee(categories, enfant.code) ? "✓ " : "○ "}{enfant.label}
            </button>)}
          </div>}
        </div>)}
      </div>}
      {impact && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-950">
        <p><b>{impact.animauxVises}</b> bovin(s) actuellement visés, sur {impact.populationActive} actifs.</p>
        <p>Avec cette modification : <b>{impact.nouvellementVises} entreraient</b> et <b>{impact.neSerontPlusVises} sortiraient</b> du ciblage.</p>
        {changement && <label className="mt-2 flex items-start gap-2">
          <input type="checkbox" checked={confirmation} onChange={(event) => setConfirmation(event.target.checked)} className="mt-1" />
          <span>J’ai vérifié les animaux qui entreraient ou sortiraient de ce protocole.</span>
        </label>}
        <p className="mt-1 text-xs">Estimation basée sur les animaux actifs au chargement de la page ; aucune dose n’est créée ou supprimée.</p>
      </div>}
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-900">{erreur}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setOuvert(false)} disabled={enCours}
          className="min-h-11 rounded-lg border bg-white px-4">Annuler</button>
        <button type="button" onClick={() => void enregistrer()}
          disabled={enCours || (!tous && !categories.length) || (changement && !confirmation)}
          className="min-h-11 rounded-lg bg-green-700 px-4 font-semibold text-white disabled:opacity-40">
          {enCours ? "Enregistrement…" : "Enregistrer les catégories"}
        </button>
      </div>
    </div>}
  </div>;
}
