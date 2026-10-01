"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface CelluleGrille {
  statut: "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "VIDE";
  date: string | null;
  aValider: boolean;
}

interface Ligne {
  animalId: string;
  nutrav: string;
  nom: string | null;
  sexe: string;
  danaisIso: string;
  cellules: Record<string, CelluleGrille>;
}

interface SousColonne { id: string; label: string }
interface Bloc { cle: string; nom: string; voie: string | null; sousColonnes: SousColonne[]; protocoleId: string | null; medicamentId: string | null }

type Sexe = "tous" | "M" | "F";
type Statut = "bientot" | "aFaire" | "enRetard" | "faits";
const STATUT_VERS_CELLULE: Record<Statut, CelluleGrille["statut"]> = { bientot: "BIENTOT", aFaire: "A_FAIRE", enRetard: "EN_RETARD", faits: "FAIT" };
type Tri = "numero" | "age" | "sexe";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const afficherDate = (date: string) => dateCourte.format(new Date(date));
const ageJours = (danaisIso: string) => Math.floor((Date.now() - new Date(danaisIso).getTime()) / 86_400_000);

/** Construit l'URL du flux d'enregistrement existant (/sanitaire/nouvel-evenement), déjà
 * utilisé par "Nouvelle séance" / "Préparer une séance" : on ne crée aucun nouveau flux, on
 * ne fait que préremplir celui-là (animal, protocole, médicament). */
function hrefValidation(nutrav: string, bloc: Bloc): string {
  const params = new URLSearchParams();
  if (bloc.protocoleId) {
    params.set("animaux", nutrav);
    params.set("protocole", bloc.protocoleId);
    params.set("vaccination", "1");
    if (bloc.medicamentId) params.set("medicament", bloc.medicamentId);
  } else {
    params.set("animal", nutrav);
    if (bloc.medicamentId) params.set("medicament", bloc.medicamentId);
  }
  return `/sanitaire/nouvel-evenement?${params.toString()}`;
}

function Cellule({ cellule, nutrav, bloc }: { cellule: CelluleGrille | undefined; nutrav: string; bloc: Bloc }) {
  if (!cellule || cellule.statut === "VIDE") {
    return <span className="text-gray-300">—</span>;
  }
  if (cellule.statut === "FAIT") {
    // Non cliquable : une vaccination déjà faite ne doit jamais pouvoir être effacée d'un clic.
    return <span className="block rounded bg-green-50 px-1 py-0.5 text-[11px] font-bold text-green-900 whitespace-nowrap">☑ {afficherDate(cellule.date!)}</span>;
  }
  const classeParStatut = cellule.statut === "EN_RETARD"
    ? "bg-red-50 text-red-950 hover:bg-red-100"
    : cellule.statut === "BIENTOT"
      ? "bg-amber-50 text-amber-950 hover:bg-amber-100"
      : "bg-sky-50 text-sky-900 hover:bg-sky-100";
  const prefixe = cellule.statut === "EN_RETARD" ? "🔴☐ " : "☐ ";
  return (
    <Link href={hrefValidation(nutrav, bloc)} className={`block rounded px-1 py-0.5 text-[11px] font-bold whitespace-nowrap underline-offset-2 hover:underline ${classeParStatut}`} title="Valider cette injection">
      {prefixe}{afficherDate(cellule.date!)}
    </Link>
  );
}

export default function TableauVaccinal({ blocs, lignes }: { blocs: Bloc[]; lignes: Ligne[] }) {
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<Set<string>>(() => new Set(blocs.map((b) => b.cle)));
  const [sexe, setSexe] = useState<Sexe>("tous");
  // Multi-sélection : vide = "Tous" (aucun filtrage). Sinon, un animal reste visible s'il a au
  // moins une cellule (parmi les vaccins affichés) dans l'un des statuts cochés (logique OU).
  const [statuts, setStatuts] = useState<Set<Statut>>(new Set());
  const [tri, setTri] = useState<Tri>("numero");
  const [triDesc, setTriDesc] = useState(false);

  const blocsAffiches = blocs.filter((b) => selection.has(b.cle));

  function basculerBloc(cle: string) {
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
      const cellulesVisibles = blocsAffiches.flatMap((b) => b.sousColonnes.map((s) => ligne.cellules[s.id]));
      if (statuts.size === 0) return true;
      return cellulesVisibles.some((c) => c && [...statuts].some((s) => STATUT_VERS_CELLULE[s] === c.statut));
    });
    const signe = triDesc ? -1 : 1;
    return [...filtres].sort((a, b) => {
      if (tri === "age") return signe * (ageJours(a.danaisIso) - ageJours(b.danaisIso));
      if (tri === "sexe") return signe * a.sexe.localeCompare(b.sexe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      return signe * a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [lignes, recherche, sexe, statuts, blocsAffiches, tri, triDesc]);

  function basculerStatut(valeur: Statut) {
    setStatuts((actuels) => {
      const suivants = new Set(actuels);
      if (suivants.has(valeur)) suivants.delete(valeur); else suivants.add(valeur);
      return suivants;
    });
  }

  const boutonClasse = (actif: boolean) =>
    `min-h-8 rounded-lg border px-2.5 text-xs font-semibold ${actif ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`;

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <div className="space-y-2 p-3">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro ou nom" aria-label="Chercher un animal" className="min-h-10 w-full rounded-lg border px-3 text-sm sm:max-w-xs" />

        <div>
          <p className="mb-1 text-[11px] font-semibold text-gray-500">Vaccins affichés</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {blocs.map((b) => (
              <label key={b.cle} className="flex min-h-7 cursor-pointer items-center gap-1.5 text-sm text-gray-800">
                <input type="checkbox" checked={selection.has(b.cle)} onChange={() => basculerBloc(b.cle)} className="h-4 w-4 accent-green-700" />
                {b.nom}
              </label>
            ))}
            <button type="button" onClick={() => setSelection(new Set(blocs.map((b) => b.cle)))} className="min-h-7 rounded-lg border px-2 text-xs font-semibold text-gray-600">Tous</button>
            <button type="button" onClick={() => setSelection(new Set())} className="min-h-7 rounded-lg border px-2 text-xs font-semibold text-gray-600">Effacer</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1" aria-label="Trier les animaux">
            <span className="text-[11px] font-semibold text-gray-500">Trier</span>
            {([["numero", "N°"], ["age", "Âge"], ["sexe", "Sexe"]] as const).map(([valeur, label]) => (
              <button key={valeur} type="button" onClick={() => changerTri(valeur)} className={boutonClasse(tri === valeur)}>{label}{tri === valeur ? (triDesc ? " ↓" : " ↑") : ""}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1" aria-label="Filtrer par sexe">
            {([["tous", "Tous"], ["F", "Femelles"], ["M", "Mâles"]] as const).map(([valeur, label]) => (
              <button key={valeur} type="button" onClick={() => setSexe(valeur)} className={boutonClasse(sexe === valeur)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtrer par statut (plusieurs choix possibles)">
          <button type="button" onClick={() => setStatuts(new Set())} className={`min-h-8 rounded-lg border px-2.5 text-xs font-semibold ${statuts.size === 0 ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`}>Tous</button>
          {([["bientot", "Bientôt"], ["aFaire", "À faire"], ["enRetard", "En retard"], ["faits", "Faits"]] as const).map(([valeur, label]) => (
            <button key={valeur} type="button" aria-pressed={statuts.has(valeur)} onClick={() => basculerStatut(valeur)} className={`min-h-8 rounded-lg border px-2.5 text-xs font-semibold ${statuts.has(valeur) ? "border-green-700 bg-green-50 text-green-900" : "text-gray-600"}`}>{label}</button>
          ))}
          <span className="self-center text-xs text-gray-500">{resultat.length} animal(aux)</span>
        </div>
      </div>

      {blocsAffiches.length === 0 ? (
        <p className="border-t p-3 text-sm text-gray-600">{blocs.length === 0 ? "Aucune vaccination ni protocole à afficher." : "Aucun vaccin sélectionné."}</p>
      ) : (
        <>
          {/* Grille dense — bureau / tablette */}
          <div className="hidden overflow-x-auto border-t md:block">
            <table className="w-full min-w-max border-collapse text-left text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th rowSpan={2} scope="col" className="sticky left-0 z-20 min-w-14 border-r bg-gray-50 p-1.5">N°</th>
                  <th rowSpan={2} scope="col" className="sticky left-14 z-20 min-w-10 border-r bg-gray-50 p-1.5">Âge</th>
                  <th rowSpan={2} scope="col" className="sticky left-24 z-20 min-w-8 border-r bg-gray-50 p-1.5">Sexe</th>
                  {blocsAffiches.map((b) => (
                    <th key={b.cle} colSpan={b.sousColonnes.length} scope="colgroup" className="border-r border-b p-1 text-center font-bold text-gray-800">
                      {b.nom}{b.voie && <span className="ml-1 font-normal text-gray-500">{b.voie}</span>}
                    </th>
                  ))}
                </tr>
                <tr>
                  {blocsAffiches.flatMap((b) => b.sousColonnes.map((s) => (
                    <th key={s.id} scope="col" className="min-w-16 border-r p-1 text-center font-normal text-gray-500">{s.label}</th>
                  )))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {resultat.map((ligne) => (
                  <tr key={ligne.animalId}>
                    <th scope="row" className="sticky left-0 z-10 min-w-14 border-r bg-white p-1.5 align-top">
                      <Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.nutrav}</Link>
                      {ligne.nom && <span className="block truncate text-[10px] font-normal text-gray-500">{ligne.nom}</span>}
                    </th>
                    <td className="sticky left-14 z-10 border-r bg-white p-1.5 align-top text-gray-600">{ageJours(ligne.danaisIso)}j</td>
                    <td className="sticky left-24 z-10 border-r bg-white p-1.5 align-top text-gray-600">{ligne.sexe}</td>
                    {blocsAffiches.flatMap((b) => b.sousColonnes.map((s) => {
                      const cellule = ligne.cellules[s.id];
                      return (
                        <td key={s.id} className="border-r p-1 align-top">
                          <Cellule cellule={cellule} nutrav={ligne.nutrav} bloc={b} />
                          {cellule?.aValider && <span className="mt-0.5 block text-[10px] font-medium text-gray-400">⚠ À vérifier</span>}
                        </td>
                      );
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
            {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ce filtre.</p>}
          </div>

          {/* Cartes — mobile */}
          <div className="divide-y border-t md:hidden">
            {resultat.map((ligne) => (
              <div key={ligne.animalId} className="p-2.5">
                <div className="flex items-baseline gap-2">
                  <Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.nutrav}</Link>
                  {ligne.nom && <span className="text-xs text-gray-500">{ligne.nom}</span>}
                  <span className="ml-auto text-xs text-gray-500">{ageJours(ligne.danaisIso)}j · {ligne.sexe}</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {blocsAffiches.map((b) => (
                    <div key={b.cle} className="flex items-center gap-1.5 text-xs">
                      <span className="w-24 flex-shrink-0 truncate font-semibold text-gray-700">{b.nom}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {b.sousColonnes.map((s) => {
                          const cellule = ligne.cellules[s.id];
                          return (
                            <span key={s.id} className="inline-flex items-center gap-1">
                              {s.label && <span className="text-[10px] text-gray-400">{s.label}</span>}
                              <Cellule cellule={cellule} nutrav={ligne.nutrav} bloc={b} />
                              {cellule?.aValider && <span className="text-[10px] font-medium text-gray-400">⚠</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ce filtre.</p>}
          </div>
        </>
      )}
    </section>
  );
}
