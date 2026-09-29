"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface CaseVaccin {
  faits: { date: string; rappel: boolean }[];
  aFaire: { dateMin: string; dateMax: string; injection: string; enRetard: boolean } | null;
  aValider: boolean;
}

interface Ligne {
  animalId: string;
  nutrav: string;
  nom: string | null;
  sexe: string;
  danaisIso: string;
  cases: Record<string, CaseVaccin>;
}

type Sexe = "tous" | "M" | "F";
type Statut = "tous" | "aFaire" | "enRetard" | "faits";
type Tri = "numero" | "age" | "sexe";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const afficherDate = (date: string) => dateCourte.format(new Date(date));
const ageJours = (danaisIso: string) => Math.floor((Date.now() - new Date(danaisIso).getTime()) / 86_400_000);

export default function TableauVaccinal({ vaccins, lignes }: {
  vaccins: { cle: string; nom: string; voie?: string | null }[];
  lignes: Ligne[];
}) {
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<Set<string>>(() => new Set(vaccins.map((v) => v.cle)));
  const [sexe, setSexe] = useState<Sexe>("tous");
  const [statut, setStatut] = useState<Statut>("tous");
  const [tri, setTri] = useState<Tri>("numero");
  const [triDesc, setTriDesc] = useState(false);

  const colonnes = vaccins.filter((v) => selection.has(v.cle));

  function basculerVaccin(cle: string) {
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(cle)) suivante.delete(cle); else suivante.add(cle);
      return suivante;
    });
  }

  function changerTri(valeur: Tri) {
    if (tri === valeur) setTriDesc((v) => !v);
    else { setTri(valeur); setTriDesc(false); }
  }

  const resultat = useMemo(() => {
    const filtres = lignes.filter((ligne) => {
      const texte = `${ligne.nutrav} ${ligne.nom ?? ""}`.toLocaleLowerCase("fr");
      if (!texte.includes(recherche.trim().toLocaleLowerCase("fr"))) return false;
      if (sexe !== "tous" && ligne.sexe !== sexe) return false;
      const cases = colonnes.map((v) => ligne.cases[v.cle]);
      if (statut === "aFaire") return cases.some((cellule) => cellule?.aFaire && !cellule.aFaire.enRetard);
      if (statut === "enRetard") return cases.some((cellule) => cellule?.aFaire?.enRetard);
      if (statut === "faits") return cases.some((cellule) => cellule?.faits.length);
      return true;
    });
    const signe = triDesc ? -1 : 1;
    return [...filtres].sort((a, b) => {
      if (tri === "age") return signe * (ageJours(a.danaisIso) - ageJours(b.danaisIso));
      if (tri === "sexe") return signe * a.sexe.localeCompare(b.sexe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      return signe * a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [lignes, recherche, sexe, statut, colonnes, tri, triDesc]);

  const boutonClasse = (actif: boolean) =>
    `min-h-9 rounded-lg border px-2.5 text-xs font-semibold ${actif ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`;

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <div className="space-y-3 p-4">
        <h2 className="text-xl font-bold text-gray-950">Vaccins par animal</h2>

        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro ou nom de l’animal" aria-label="Chercher un animal" className="min-h-11 w-full rounded-lg border px-3 text-sm sm:max-w-xs" />

        <div>
          <p className="mb-1 text-xs font-semibold text-gray-500">Vaccins affichés</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {vaccins.map((v) => (
              <label key={v.cle} className="flex min-h-8 cursor-pointer items-center gap-1.5 text-sm text-gray-800">
                <input type="checkbox" checked={selection.has(v.cle)} onChange={() => basculerVaccin(v.cle)} className="h-4 w-4 accent-green-700" />
                {v.nom}
              </label>
            ))}
            <button type="button" onClick={() => setSelection(new Set(vaccins.map((v) => v.cle)))} className="min-h-8 rounded-lg border px-2.5 text-xs font-semibold text-gray-600">Tous</button>
            <button type="button" onClick={() => setSelection(new Set())} className="min-h-8 rounded-lg border px-2.5 text-xs font-semibold text-gray-600">Effacer</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Trier les animaux">
            <span className="text-xs font-semibold text-gray-500">Trier</span>
            {([["numero", "N°"], ["age", "Âge"], ["sexe", "Sexe"]] as const).map(([valeur, label]) => (
              <button key={valeur} type="button" onClick={() => changerTri(valeur)} className={boutonClasse(tri === valeur)}>
                {label}{tri === valeur ? (triDesc ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtrer par sexe">
            {([["tous", "Tous"], ["F", "Femelles"], ["M", "Mâles"]] as const).map(([valeur, label]) => (
              <button key={valeur} type="button" onClick={() => setSexe(valeur)} className={boutonClasse(sexe === valeur)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Filtrer par statut">
          {([
            ["tous", "Tous"], ["aFaire", "À faire"], ["enRetard", "En retard"], ["faits", "Faits"],
          ] as const).map(([valeur, label]) => <button key={valeur} type="button" onClick={() => setStatut(valeur)} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${statut === valeur ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`}>{label}</button>)}
          <span className="self-center text-sm text-gray-500">{resultat.length} animal(aux)</span>
        </div>
      </div>
      {colonnes.length === 0 ? (
        <p className="border-t p-4 text-sm text-gray-600">{vaccins.length === 0 ? "Aucune vaccination ni étape de protocole à afficher." : "Aucun vaccin sélectionné."}</p>
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-gray-50"><tr>
              <th scope="col" className="sticky left-0 z-20 min-w-24 border-r bg-gray-50 p-2">Animal</th>
              {colonnes.map((v) => <th scope="col" key={v.cle} className="min-w-28 border-r p-2 text-xs">{v.nom}{v.voie && <span className="block font-normal text-gray-500">{v.voie}</span>}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {resultat.map((ligne) => <tr key={ligne.animalId}>
                <th scope="row" className="sticky left-0 z-10 min-w-24 border-r bg-white p-2 align-top">
                  <Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.nutrav}</Link>
                  {ligne.nom && <span className="block truncate text-xs font-normal text-gray-600">{ligne.nom}</span>}
                </th>
                {colonnes.map((v) => {
                  const cellule = ligne.cases[v.cle];
                  return <td key={v.cle} className="min-w-28 border-r p-1.5 align-top">
                    {!cellule && <span className="text-gray-300">—</span>}
                    {cellule?.faits.map((fait, index) => <p key={`${fait.date}-${index}`} className="mb-0.5 rounded bg-green-50 px-1.5 py-1 text-xs font-semibold text-green-900">☑ {afficherDate(fait.date)}</p>)}
                    {cellule?.aFaire && (cellule.aFaire.enRetard
                      ? <p className="rounded bg-red-50 px-1.5 py-1 text-xs font-semibold text-red-950">🔴 ☐ {cellule.aFaire.injection} {afficherDate(cellule.aFaire.dateMax)}</p>
                      : <p className="rounded bg-amber-50 px-1.5 py-1 text-xs font-semibold text-amber-950">☐ {cellule.aFaire.injection} {afficherDate(cellule.aFaire.dateMax)}</p>)}
                    {cellule?.aValider && !cellule.aFaire && <p className="mt-0.5 text-[11px] font-medium text-gray-400">⚠ À vérifier</p>}
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
