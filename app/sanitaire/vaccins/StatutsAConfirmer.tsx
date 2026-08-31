"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface AnimalAConfirmer {
  animalId: string;
  nutrav: string;
  nom: string | null;
  groupe: string;
  categorie: string;
  ageJours: number;
}

type Situation = "JAMAIS" | "DEJA" | null;
type FiltreAge = "" | "MOINS_6_MOIS" | "6_A_24_MOIS" | "PLUS_24_MOIS";
const LIMITE_AFFICHEE = 40;

export default function StatutsAConfirmer({ protocoleId, animaux }: { protocoleId: string; animaux: AnimalAConfirmer[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [situation, setSituation] = useState<Situation>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [recherche, setRecherche] = useState("");
  const [groupe, setGroupe] = useState("");
  const [categorie, setCategorie] = useState("");
  const [age, setAge] = useState<FiltreAge>("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groupes = useMemo(() => [...new Set(animaux.map((animal) => animal.groupe))].sort(), [animaux]);
  const categories = useMemo(() => [...new Set(animaux.map((animal) => animal.categorie))].sort(), [animaux]);
  const filtrageActif = Boolean(recherche.trim() || groupe || categorie || age);
  const resultats = useMemo(() => {
    if (!filtrageActif) return [];
    const terme = recherche.trim().toLocaleLowerCase("fr");
    return animaux.filter((animal) => {
      if (terme && !`${animal.nutrav} ${animal.nom || ""}`.toLocaleLowerCase("fr").includes(terme)) return false;
      if (groupe && animal.groupe !== groupe) return false;
      if (categorie && animal.categorie !== categorie) return false;
      if (age === "MOINS_6_MOIS" && animal.ageJours >= 183) return false;
      if (age === "6_A_24_MOIS" && (animal.ageJours < 183 || animal.ageJours >= 730)) return false;
      if (age === "PLUS_24_MOIS" && animal.ageJours < 730) return false;
      return true;
    });
  }, [age, animaux, categorie, filtrageActif, groupe, recherche]);
  const tousLesResultatsSelectionnes = resultats.length > 0 && resultats.every((animal) => selection.has(animal.animalId));

  function fermer() {
    setOuvert(false);
    setSituation(null);
    setSelection(new Set());
    setErreur(null);
  }

  function basculer(id: string) {
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(id)) suivante.delete(id);
      else suivante.add(id);
      return suivante;
    });
  }

  function enregistrer(statut: "PROTOCOLE_ACQUIS" | "PRIMO_A_FAIRE", animalIds: string[]) {
    if (animalIds.length === 0) return;
    setErreur(null);
    startTransition(async () => {
      const reponse = await fetch(`/api/protocoles/${protocoleId}/statuts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds, statut, source: "VACCINS_A_PREPARER" }),
      });
      if (!reponse.ok) {
        setErreur("Le statut n’a pas pu être enregistré.");
        return;
      }
      fermer();
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm">
        <span className="min-w-0 flex-1 text-amber-950">⚠️ <b>{animaux.length} animaux</b> ont un historique vaccinal à préciser</span>
        <button type="button" onClick={() => setOuvert(true)} className="min-h-10 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950">Initialiser le protocole</button>
      </div>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) fermer(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`initialisation-${protocoleId}`} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><h3 id={`initialisation-${protocoleId}`} className="text-lg font-black text-gray-950">Quelle est la situation pour ce vaccin ?</h3><p className="text-sm text-gray-500">Aucune recommandation automatique ne sera créée sans votre choix.</p></div>
              <button type="button" onClick={fermer} aria-label="Fermer" className="rounded-lg p-2 text-gray-500"><X size={20} /></button>
            </div>

            {situation === null && <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => setSituation("JAMAIS")} className="rounded-xl border p-3 text-left"><b className="block text-sm text-gray-950">A. Jamais utilisé sur ces animaux</b><span className="text-xs text-gray-500">La primo-vaccination sera proposée pour les {animaux.length} animaux.</span></button>
              <button type="button" onClick={() => setSituation("DEJA")} className="rounded-xl border p-3 text-left"><b className="block text-sm text-gray-950">B. Déjà utilisé auparavant</b><span className="text-xs text-gray-500">Retrouver seulement les animaux concernés avec les filtres.</span></button>
              <button type="button" onClick={fermer} className="rounded-xl border p-3 text-left"><b className="block text-sm text-gray-950">C. Je ne sais pas</b><span className="text-xs text-gray-500">Conserver « Statut à confirmer » et ne rien recommander.</span></button>
            </div>}

            {situation === "JAMAIS" && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-950">Confirmer que ce vaccin n’a jamais été utilisé sur ces <b>{animaux.length} animaux</b> ?</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setSituation(null)} className="min-h-11 flex-1 rounded-lg border bg-white px-3 text-sm font-semibold">Retour</button><button type="button" disabled={pending} onClick={() => enregistrer("PRIMO_A_FAIRE", animaux.map((animal) => animal.animalId))} className="min-h-11 flex-1 rounded-lg bg-amber-800 px-3 text-sm font-semibold text-white disabled:opacity-40">Confirmer · Primo à faire</button></div></div>}

            {situation === "DEJA" && <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label="Rechercher par numéro ou nom" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher n° ou nom" className="min-h-11 rounded-lg border px-3 text-sm" />
                <select aria-label="Filtrer par groupe" value={groupe} onChange={(event) => setGroupe(event.target.value)} className="min-h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Tous les groupes</option>{groupes.map((item) => <option key={item}>{item}</option>)}</select>
                <select aria-label="Filtrer par catégorie" value={categorie} onChange={(event) => setCategorie(event.target.value)} className="min-h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Toutes les catégories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
                <select aria-label="Filtrer par âge" value={age} onChange={(event) => setAge(event.target.value as FiltreAge)} className="min-h-11 rounded-lg border bg-white px-3 text-sm"><option value="">Tous les âges</option><option value="MOINS_6_MOIS">Moins de 6 mois</option><option value="6_A_24_MOIS">6 à 24 mois</option><option value="PLUS_24_MOIS">Plus de 24 mois</option></select>
              </div>

              {!filtrageActif ? <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">Choisissez un filtre ou recherchez un animal pour afficher les correspondances.</p> : <>
                <div className="flex items-center gap-2"><button type="button" disabled={resultats.length === 0} onClick={() => setSelection((actuelle) => { const suivante = new Set(actuelle); resultats.forEach((animal) => tousLesResultatsSelectionnes ? suivante.delete(animal.animalId) : suivante.add(animal.animalId)); return suivante; })} className="min-h-10 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40">{tousLesResultatsSelectionnes ? "Désélectionner le résultat" : `Tout sélectionner dans le résultat (${resultats.length})`}</button><span className="text-xs text-gray-500">{selection.size} sélectionné(s)</span></div>
                <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">{resultats.slice(0, LIMITE_AFFICHEE).map((animal) => <label key={animal.animalId} className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm"><input type="checkbox" checked={selection.has(animal.animalId)} onChange={() => basculer(animal.animalId)} /><b className="font-mono">{animal.nutrav}</b><span className="min-w-0 flex-1 truncate text-gray-600">{animal.nom || "Sans nom"}</span><span className="hidden text-xs text-gray-400 sm:block">{animal.groupe} · {animal.categorie}</span></label>)}</div>
                {resultats.length > LIMITE_AFFICHEE && <p className="text-xs text-gray-500">{LIMITE_AFFICHEE} animaux affichés sur {resultats.length}. « Tout sélectionner » concerne bien tout le résultat filtré.</p>}
              </>}
              <div className="flex gap-2"><button type="button" onClick={() => setSituation(null)} className="min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold">Retour</button><button type="button" disabled={pending || selection.size === 0} onClick={() => enregistrer("PROTOCOLE_ACQUIS", [...selection])} className="min-h-11 flex-1 rounded-lg bg-green-700 px-3 text-sm font-semibold text-white disabled:opacity-40">Déjà primovaccinés ({selection.size})</button></div>
            </div>}
            {erreur && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
          </section>
        </div>
      )}
    </>
  );
}
