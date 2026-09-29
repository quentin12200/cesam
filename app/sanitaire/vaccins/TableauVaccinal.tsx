"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface CaseVaccin {
  faits: { date: string; rappel: boolean }[];
  aFaire: { dateMin: string; dateMax: string; injection: string } | null;
  aValider: boolean;
}

interface Ligne {
  animalId: string;
  nutrav: string;
  nom: string | null;
  cases: Record<string, CaseVaccin>;
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const afficherDate = (date: string) => dateCourte.format(new Date(date));

export default function TableauVaccinal({ vaccins, lignes }: {
  vaccins: { cle: string; nom: string }[];
  lignes: Ligne[];
}) {
  const [recherche, setRecherche] = useState("");
  const [vaccin, setVaccin] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "aFaire" | "faits">("tous");
  const colonnes = vaccin ? vaccins.filter((v) => v.cle === vaccin) : vaccins;
  const resultat = useMemo(() => lignes.filter((ligne) => {
    const texte = `${ligne.nutrav} ${ligne.nom ?? ""}`.toLocaleLowerCase("fr");
    if (!texte.includes(recherche.trim().toLocaleLowerCase("fr"))) return false;
    const cases = vaccin ? [ligne.cases[vaccin]] : Object.values(ligne.cases);
    if (filtre === "aFaire") return cases.some((cellule) => cellule?.aFaire);
    if (filtre === "faits") return cases.some((cellule) => cellule?.faits.length);
    return true;
  }), [lignes, recherche, vaccin, filtre]);

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <div className="space-y-3 p-4">
        <h2 className="text-xl font-bold text-gray-950">Vaccins par animal</h2>
        <p className="text-sm text-gray-600">Chaque case montre les injections enregistrées et la prochaine étape calculée.</p>
        <p className="text-xs text-gray-500">— signifie qu’aucune injection ni étape datée n’est enregistrée pour ce vaccin et cet animal.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro ou nom de l’animal" aria-label="Chercher un animal" className="min-h-11 rounded-lg border px-3 text-sm" />
          <select value={vaccin} onChange={(e) => setVaccin(e.target.value)} aria-label="Choisir un vaccin" className="min-h-11 rounded-lg border bg-white px-3 text-sm">
            <option value="">Tous les vaccins</option>
            {vaccins.map((v) => <option key={v.cle} value={v.cle}>{v.nom}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filtrer les animaux">
          {([
            ["tous", "Tous"], ["aFaire", "À faire"], ["faits", "Faits"],
          ] as const).map(([valeur, label]) => <button key={valeur} type="button" onClick={() => setFiltre(valeur)} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${filtre === valeur ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`}>{label}</button>)}
          <span className="self-center text-sm text-gray-500">{resultat.length} animal(aux)</span>
        </div>
      </div>
      {vaccins.length === 0 ? <p className="border-t p-4 text-sm text-gray-600">Aucune vaccination ni étape de protocole à afficher.</p> : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-gray-50"><tr>
              <th scope="col" className="sticky left-0 z-20 min-w-32 border-r bg-gray-50 p-3">Animal</th>
              {colonnes.map((v) => <th scope="col" key={v.cle} className="min-w-44 max-w-56 border-r p-3">{v.nom}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {resultat.map((ligne) => <tr key={ligne.animalId}>
                <th scope="row" className="sticky left-0 z-10 min-w-32 border-r bg-white p-3 align-top">
                  <Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.nutrav}</Link>
                  {ligne.nom && <span className="block text-xs font-normal text-gray-600">{ligne.nom}</span>}
                </th>
                {colonnes.map((v) => {
                  const cellule = ligne.cases[v.cle];
                  return <td key={v.cle} className="min-w-44 max-w-56 border-r p-2 align-top">
                    {!cellule && <span className="text-gray-300">—</span>}
                    {cellule?.faits.map((fait, index) => <p key={`${fait.date}-${index}`} className="mb-1 rounded bg-green-50 px-2 py-1 text-xs text-green-900"><b>{fait.rappel ? "Rappel fait" : "Fait"}</b> le {afficherDate(fait.date)}</p>)}
                    {cellule?.aFaire && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-950"><b>{cellule.aFaire.injection}</b> à faire {afficherDate(cellule.aFaire.dateMin)}{cellule.aFaire.dateMax !== cellule.aFaire.dateMin && `–${afficherDate(cellule.aFaire.dateMax)}`}</p>}
                    {cellule?.aValider && !cellule.aFaire && <p className="mt-1 text-xs font-semibold text-amber-800">Étape à valider</p>}
                  </td>;
                })}
              </tr>)}
            </tbody>
          </table>
          {resultat.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun animal avec ce filtre.</p>}
        </div>
      )}
    </section>
  );
}
