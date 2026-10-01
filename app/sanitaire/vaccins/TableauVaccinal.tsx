"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ExecutantSelect, { type Intervenant } from "@/app/sanitaire/nouvel-evenement/ExecutantSelect";
import { formatAgeTerrain } from "@/lib/animal-age";
import { regrouperActesVaccinaux } from "@/lib/vaccination-session";
import { comparerUrgenceVaccinale, formatTempsAvantVelage } from "@/lib/vaccine-table-presentation";

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
  gestationId: string | null;
  dateVelagePrevueIso: string | null;
  cellules: Record<string, CelluleGrille>;
}

interface SousColonne {
  id: string;
  label: string;
  protocoleId: string | null;
  medicamentId: string | null;
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
}

interface Bloc {
  cle: string;
  nom: string;
  voie: string | null;
  sousColonnes: SousColonne[];
  protocoleId: string | null;
  medicamentId: string | null;
}

type Statut = "aFaire" | "enRetard" | "faits";
type Tri = "numero" | "age" | "sexe" | "gestation" | "velage" | `vaccin:${string}`;
type DirectionTri = "asc" | "desc";
type ColonneAnimal = "numero" | "nom" | "age" | "sexe" | "gestation" | "velage";
type FiltreGestation = "toutes" | "gestantes" | "vides";

interface ActeSelectionne {
  cle: string;
  ligne: Ligne;
  bloc: Bloc;
  etape: SousColonne;
}

interface GroupeSession {
  cle: string;
  bloc: Bloc;
  etape: SousColonne;
  actes: ActeSelectionne[];
}

interface AjustementGroupe {
  voie: string;
  dose: string;
  uniteDosage: string;
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const afficherDate = (date: string) => dateCourte.format(new Date(date));
const ageJours = (danaisIso: string) => Math.floor((Date.now() - new Date(danaisIso).getTime()) / 86_400_000);
const colonnesAnimal: { id: ColonneAnimal; label: string }[] = [
  { id: "numero", label: "N°" },
  { id: "nom", label: "Nom" },
  { id: "age", label: "Âge" },
  { id: "sexe", label: "Sexe" },
  { id: "gestation", label: "Gestation" },
  { id: "velage", label: "Avant vêlage" },
];
const dateLocaleIso = () => {
  const date = new Date();
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10);
};
const cleActe = (animalId: string, etapeId: string) => `${animalId}|${etapeId}`;
const estAFaire = (statut: CelluleGrille["statut"]) => statut === "A_FAIRE" || statut === "BIENTOT";
const estSelectionnable = (cellule: CelluleGrille | undefined, etape: SousColonne) =>
  Boolean(cellule && (estAFaire(cellule.statut) || cellule.statut === "EN_RETARD") && etape.protocoleId && etape.medicamentId);

function correspondStatut(statut: CelluleGrille["statut"], filtres: ReadonlySet<Statut>): boolean {
  if (filtres.size === 0) return true;
  return (filtres.has("faits") && statut === "FAIT")
    || (filtres.has("aFaire") && estAFaire(statut))
    || (filtres.has("enRetard") && statut === "EN_RETARD");
}

export default function TableauVaccinal({ blocs, lignes }: { blocs: Bloc[]; lignes: Ligne[] }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [vaccinsAffiches, setVaccinsAffiches] = useState<Set<string>>(() => new Set(blocs.map((bloc) => bloc.cle)));
  const [statuts, setStatuts] = useState<Set<Statut>>(new Set());
  const [filtreGestation, setFiltreGestation] = useState<FiltreGestation>("toutes");
  const [tri, setTri] = useState<Tri | null>(null);
  const [directionTri, setDirectionTri] = useState<DirectionTri | null>(null);
  const [colonnesMasquees, setColonnesMasquees] = useState<Set<ColonneAnimal>>(new Set());
  const [menuColonne, setMenuColonne] = useState<{ colonne: ColonneAnimal; x: number; y: number } | null>(null);
  const menuColonneRef = useRef<HTMLDivElement>(null);
  const [modeSession, setModeSession] = useState(false);
  const [dateSession, setDateSession] = useState(dateLocaleIso);
  const [executant, setExecutant] = useState("");
  const [intervenants, setIntervenants] = useState<Intervenant[]>([]);
  const [animauxSelectionnes, setAnimauxSelectionnes] = useState<Set<string>>(new Set());
  const [uniquementSelection, setUniquementSelection] = useState(false);
  const [actesSelectionnes, setActesSelectionnes] = useState<Set<string>>(new Set());
  const [verification, setVerification] = useState(false);
  const [ajustements, setAjustements] = useState<Record<string, AjustementGroupe>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch("/api/intervenants").then((reponse) => reponse.json()).then(setIntervenants).catch(() => {});
  }, []);

  useEffect(() => {
    function fermerMenu(event: PointerEvent) {
      if (!menuColonneRef.current?.contains(event.target as Node)) setMenuColonne(null);
    }
    function fermerSurEchap(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuColonne(null);
    }
    document.addEventListener("pointerdown", fermerMenu);
    window.addEventListener("keydown", fermerSurEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerMenu);
      window.removeEventListener("keydown", fermerSurEchap);
    };
  }, []);

  const blocsAffiches = useMemo(
    () => blocs.filter((bloc) => vaccinsAffiches.has(bloc.cle)),
    [blocs, vaccinsAffiches],
  );

  const resultat = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");
    const filtres = lignes.filter((ligne) => {
      if (!`${ligne.nutrav} ${ligne.nom ?? ""}`.toLocaleLowerCase("fr").includes(terme)) return false;
      if (filtreGestation === "gestantes" && !ligne.gestationId) return false;
      if (filtreGestation === "vides" && ligne.gestationId) return false;
      if (statuts.size === 0) return true;
      return blocsAffiches.some((bloc) => bloc.sousColonnes.some((etape) => {
        const cellule = ligne.cellules[etape.id];
        return cellule && correspondStatut(cellule.statut, statuts);
      }));
    });
    const lignesFiltrees = uniquementSelection ? filtres.filter((ligne) => animauxSelectionnes.has(ligne.animalId)) : filtres;
    if (!tri || !directionTri) return lignesFiltrees;
    const signe = directionTri === "desc" ? -1 : 1;
    return [...lignesFiltrees].sort((a, b) => {
      if (tri === "age") return signe * (ageJours(a.danaisIso) - ageJours(b.danaisIso));
      if (tri === "sexe") return signe * a.sexe.localeCompare(b.sexe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      if (tri === "gestation") return signe * (Number(Boolean(b.gestationId)) - Number(Boolean(a.gestationId)));
      if (tri === "velage") {
        const dateA = a.dateVelagePrevueIso ? new Date(a.dateVelagePrevueIso).getTime() : Number.POSITIVE_INFINITY;
        const dateB = b.dateVelagePrevueIso ? new Date(b.dateVelagePrevueIso).getTime() : Number.POSITIVE_INFINITY;
        return signe * (dateA - dateB);
      }
      if (tri.startsWith("vaccin:")) {
        const etapeId = tri.slice("vaccin:".length);
        return signe * comparerUrgenceVaccinale(a.cellules[etapeId], b.cellules[etapeId]);
      }
      return signe * a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [animauxSelectionnes, blocsAffiches, directionTri, filtreGestation, lignes, recherche, statuts, tri, uniquementSelection]);

  const actes = useMemo(() => {
    const index = new Map<string, ActeSelectionne>();
    for (const ligne of lignes) {
      for (const bloc of blocs) {
        for (const etape of bloc.sousColonnes) {
          const cle = cleActe(ligne.animalId, etape.id);
          if (actesSelectionnes.has(cle)) index.set(cle, { cle, ligne, bloc, etape });
        }
      }
    }
    return [...index.values()];
  }, [actesSelectionnes, blocs, lignes]);

  const groupesSession = useMemo(() => {
    return regrouperActesVaccinaux(actes, (acte) => acte.etape.medicamentId, (acte) => acte.etape.id)
      .map(({ cle, actes: actesGroupe }): GroupeSession => ({
        cle,
        bloc: actesGroupe[0].bloc,
        etape: actesGroupe[0].etape,
        actes: actesGroupe,
      }));
  }, [actes]);

  const nombreAnimaux = new Set(actes.map((acte) => acte.ligne.animalId)).size;

  function basculerTri(valeur: Tri) {
    if (tri !== valeur || !directionTri) {
      setTri(valeur);
      setDirectionTri("asc");
      return;
    }
    if (directionTri === "asc") {
      setDirectionTri("desc");
      return;
    }
    setTri(null);
    setDirectionTri(null);
  }

  function indicateurTri(valeur: Tri) {
    if (tri !== valeur) return null;
    return <span aria-hidden="true" className="ml-1 text-[10px] text-gray-500">{directionTri === "asc" ? "↑" : "↓"}</span>;
  }

  function ouvrirMenuColonne(event: React.MouseEvent, colonne: ColonneAnimal) {
    event.preventDefault();
    setMenuColonne({
      colonne,
      x: Math.min(event.clientX, window.innerWidth - 240),
      y: Math.min(event.clientY, window.innerHeight - 220),
    });
  }

  function masquerColonne(colonne: ColonneAnimal) {
    if (colonnesMasquees.size >= colonnesAnimal.length - 1) return;
    setColonnesMasquees((actuelles) => new Set(actuelles).add(colonne));
    if (tri === colonne) {
      setTri(null);
      setDirectionTri(null);
    }
    setMenuColonne(null);
  }

  function reafficherColonne(colonne: ColonneAnimal) {
    setColonnesMasquees((actuelles) => {
      const suivantes = new Set(actuelles);
      suivantes.delete(colonne);
      return suivantes;
    });
    setMenuColonne(null);
  }

  function enteteTriable(label: string, valeur: Tri, colonne: ColonneAnimal, classe: string) {
    if (colonnesMasquees.has(colonne)) return null;
    return <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, colonne)} className={classe}><button type="button" onClick={() => basculerTri(valeur)} className="w-full py-0.5 text-left font-bold" aria-label={`Trier par ${label}`}>{label}{indicateurTri(valeur)}</button></th>;
  }

  function basculerDansSet<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, valeur: T) {
    setter((actuels) => {
      const suivants = new Set(actuels);
      if (suivants.has(valeur)) suivants.delete(valeur); else suivants.add(valeur);
      return suivants;
    });
  }

  function basculerActe(ligne: Ligne, etape: SousColonne) {
    const cellule = ligne.cellules[etape.id];
    if (!estSelectionnable(cellule, etape)) return;
    basculerDansSet(setActesSelectionnes, cleActe(ligne.animalId, etape.id));
  }

  function selectionnerAnimauxVisibles() {
    setAnimauxSelectionnes((actuels) => {
      const suivants = new Set(actuels);
      resultat.forEach((ligne) => suivants.add(ligne.animalId));
      return suivants;
    });
  }

  function selectionnerVisibles(etape: SousColonne) {
    setActesSelectionnes((actuels) => {
      const suivants = new Set(actuels);
      for (const ligne of resultat) {
        const cellule = ligne.cellules[etape.id];
        if (cellule && estAFaire(cellule.statut) && estSelectionnable(cellule, etape)) suivants.add(cleActe(ligne.animalId, etape.id));
      }
      return suivants;
    });
  }

  function ouvrirVerification() {
    if (!dateSession || !executant.trim() || groupesSession.length === 0) {
      setErreur("Indique la date, l’exécutant et sélectionne au moins un acte.");
      return;
    }
    setAjustements(Object.fromEntries(groupesSession.map((groupe) => [groupe.cle, {
      voie: groupe.etape.voie === "À renseigner" ? "" : groupe.etape.voie ?? "",
      dose: groupe.etape.dose == null ? "" : String(groupe.etape.dose),
      uniteDosage: groupe.etape.uniteDosage ?? "ml",
    }])));
    setErreur("");
    setVerification(true);
  }

  async function validerSession() {
    setErreur("");
    const voieManquante = groupesSession.find((groupe) => !ajustements[groupe.cle]?.voie.trim());
    if (voieManquante) {
      setErreur(`Indique la voie pour ${voieManquante.bloc.nom} — ${voieManquante.etape.label}.`);
      return;
    }
    setEnregistrement(true);
    const enregistres = new Set<string>();
    try {
      for (const groupe of groupesSession) {
        const administration = ajustements[groupe.cle];
        const animalIds = groupe.actes.map((acte) => acte.ligne.animalId);
        const medicamentId = groupe.etape.medicamentId!;
        const medicamentNom = groupe.etape.medicamentNom || groupe.bloc.nom;
        const dose = administration.dose === "" ? null : Number(administration.dose);
        const reponse = await fetch("/api/evenements/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            animalIds,
            date: dateSession,
            type: "Vaccination",
            symptomes: [{ libelle: "Vaccination", typeEvenementId: null }],
            constatePar: executant.trim(),
            description: groupe.etape.label || null,
            traitements: [{
              medicamentId,
              medicamentNom,
              voie: administration.voie.trim(),
              executant: executant.trim(),
              dose,
              uniteDosage: administration.uniteDosage || null,
              doseUnique: true,
            }],
            vaccinationSession: {
              protocoleId: groupe.etape.protocoleId,
              vaccin: medicamentNom,
              medicamentId,
              voie: administration.voie.trim(),
              dose,
              animaux: groupe.actes.map((acte) => ({
                animalId: acte.ligne.animalId,
                etapeProtocoleId: groupe.etape.id,
                gestationId: acte.ligne.gestationId,
                typeInjection: null,
              })),
            },
          }),
        });
        if (!reponse.ok) {
          const detail = await reponse.json().catch(() => ({}));
          throw new Error(detail.error || `Échec pour ${groupe.bloc.nom} — ${groupe.etape.label}`);
        }
        groupe.actes.forEach((acte) => enregistres.add(acte.cle));
      }
      setActesSelectionnes(new Set());
      setVerification(false);
      setModeSession(false);
      router.refresh();
    } catch (cause) {
      if (enregistres.size > 0) setActesSelectionnes((actuels) => new Set([...actuels].filter((cle) => !enregistres.has(cle))));
      setErreur(cause instanceof Error ? cause.message : "La séance n’a pas pu être enregistrée.");
    } finally {
      setEnregistrement(false);
    }
  }

  function renduCellule(cellule: CelluleGrille | undefined, ligne: Ligne, etape: SousColonne) {
    if (!cellule || cellule.statut === "VIDE") return <span className="text-gray-300">—</span>;
    if (cellule.statut === "FAIT") return <span className="flex items-center justify-center gap-1 rounded border border-green-600 bg-green-100 px-1.5 py-1 font-bold text-green-950 whitespace-nowrap"><span className="text-base leading-none">☑</span><span className="text-[11px]">{afficherDate(cellule.date!)}</span></span>;
    const selectionne = actesSelectionnes.has(cleActe(ligne.animalId, etape.id));
    const classe = cellule.statut === "EN_RETARD"
      ? "border-red-800 bg-red-300 text-red-950"
      : cellule.statut === "BIENTOT"
        ? "border-orange-700 bg-orange-300 text-orange-950"
        : "border-yellow-700 bg-yellow-300 text-yellow-950";
    const contenu = <><span className="text-xl font-black leading-none">☐</span><span className="text-[10px] font-semibold opacity-80">{afficherDate(cellule.date!)}</span></>;
    if (!modeSession) return <span className={`flex items-center justify-center gap-1 rounded border px-1.5 py-1 whitespace-nowrap ${classe}`}>{contenu}</span>;
    const disponible = estSelectionnable(cellule, etape);
    return <button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title={disponible ? "Ajouter ou retirer de la séance" : "Médicament ou protocole à renseigner"} className={`flex w-full items-center justify-center gap-1 rounded border px-1.5 py-1 whitespace-nowrap ${classe} ${selectionne ? "ring-2 ring-green-700" : ""} disabled:cursor-not-allowed disabled:opacity-50`}><span className="text-xl font-black leading-none">{selectionne ? "☑" : "☐"}</span><span className="text-[10px] font-semibold opacity-80">{afficherDate(cellule.date!)}</span></button>;
  }

  return (
    <section id="tableau-vaccinal-impression" className="rounded-2xl bg-white shadow-sm">
      <h1 className="hidden text-lg font-black print:block">Tableau vaccinal</h1>
      <div className="vaccin-print-hidden flex flex-wrap items-start gap-2 p-3">
        <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Recherche animal" aria-label="Rechercher un animal" className="min-h-10 min-w-48 flex-1 rounded-lg border px-3 text-sm" />

        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Vaccins affichés ▾</summary>
          <div className="absolute right-0 z-40 mt-1 max-h-72 min-w-64 overflow-y-auto rounded-xl border bg-white p-2 shadow-xl">
            <div className="mb-2 flex gap-2 border-b pb-2 text-xs font-semibold"><button type="button" onClick={() => setVaccinsAffiches(new Set(blocs.map((bloc) => bloc.cle)))} className="underline">Tout sélectionner</button><button type="button" onClick={() => setVaccinsAffiches(new Set())} className="underline">Tout désélectionner</button></div>
            {blocs.map((bloc) => <label key={bloc.cle} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={vaccinsAffiches.has(bloc.cle)} onChange={() => basculerDansSet(setVaccinsAffiches, bloc.cle)} className="h-4 w-4 accent-green-700" />{bloc.nom}</label>)}
          </div>
        </details>

        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Statuts ▾</summary>
          <div className="absolute right-0 z-40 mt-1 min-w-44 rounded-xl border bg-white p-2 shadow-xl">
            {([['faits', 'Faits'], ['aFaire', 'À faire'], ['enRetard', 'En retard']] as const).map(([valeur, label]) => <label key={valeur} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={statuts.has(valeur)} onChange={() => basculerDansSet(setStatuts, valeur)} className="h-4 w-4 accent-green-700" />{label}</label>)}
            <button type="button" onClick={() => setStatuts(new Set())} className="mt-1 text-xs font-semibold underline">Afficher tous les statuts</button>
          </div>
        </details>

        <select value={filtreGestation} onChange={(event) => setFiltreGestation(event.target.value as FiltreGestation)} aria-label="Filtrer par gestation" className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-700"><option value="toutes">Toutes gestations</option><option value="gestantes">Gestantes</option><option value="vides">Vides</option></select>
        <Link href="/config/protocoles?returnTo=%2Fsanitaire%2Fvaccins" className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">⚙️ Configurer les protocoles</Link>
        <button type="button" onClick={() => window.print()} className="min-h-10 rounded-lg border px-3 text-sm font-semibold text-gray-700">Imprimer</button>
        <button type="button" onClick={() => { setModeSession(true); setErreur(""); }} className="min-h-10 rounded-lg bg-green-700 px-4 text-sm font-bold text-white">Nouvelle séance</button>
      </div>

      <div className="vaccin-print-hidden mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs"><b className="mr-auto">{animauxSelectionnes.size} animal(aux) sélectionné(s)</b><button type="button" onClick={selectionnerAnimauxVisibles} className="min-h-8 rounded border bg-white px-2 font-semibold">Tout sélectionner les animaux visibles</button><button type="button" onClick={() => { setAnimauxSelectionnes(new Set()); setUniquementSelection(false); }} className="min-h-8 rounded border bg-white px-2 font-semibold">Tout désélectionner</button><button type="button" disabled={animauxSelectionnes.size === 0} onClick={() => setUniquementSelection((actuel) => !actuel)} className="min-h-8 rounded border border-green-700 bg-white px-2 font-semibold text-green-800 disabled:opacity-40">{uniquementSelection ? "Afficher tous" : "Afficher uniquement la sélection"}</button></div>

      {modeSession && <div className="vaccin-print-hidden mx-3 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(12rem,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold text-green-950">Date de séance<input type="date" value={dateSession} onChange={(event) => setDateSession(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal text-gray-900" /></label>
          <label className="text-xs font-semibold text-green-950">Exécutant<div className="mt-1 font-normal text-gray-900"><ExecutantSelect intervenants={intervenants} value={executant} onChange={setExecutant} onAdded={(intervenant) => setIntervenants((actuels) => [...actuels, intervenant])} /></div></label>
          <button type="button" onClick={() => { setModeSession(false); setActesSelectionnes(new Set()); setErreur(""); }} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-600">Annuler la séance</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><p className="mr-auto text-sm font-semibold text-green-950">Séance du {dateSession ? dateCourte.format(new Date(`${dateSession}T12:00:00`)) : "—"} — {executant.trim() || "exécutant à renseigner"} — {nombreAnimaux} animal(aux) — {actes.length} acte(s)</p>{actes.length > 0 && <button type="button" onClick={() => setActesSelectionnes(new Set())} className="min-h-9 rounded-lg border bg-white px-3 text-xs font-semibold">Vider la sélection</button>}<button type="button" onClick={ouvrirVerification} className="min-h-9 rounded-lg bg-green-800 px-3 text-sm font-bold text-white">Vérifier et valider la séance</button></div>
        {erreur && !verification && <p className="mt-2 text-sm font-semibold text-red-700">{erreur}</p>}
      </div>}

      {blocsAffiches.length === 0 ? <p className="border-t p-3 text-sm text-gray-600">{blocs.length === 0 ? "Aucune vaccination ni protocole à afficher." : "Aucun vaccin sélectionné."}</p> : <div className="overflow-x-auto border-t">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-[13px]">
            <tr>
              <th rowSpan={2} scope="col" className="animal-selection-column w-10 border-r bg-gray-50 p-1 text-center"><span className="sr-only">Sélection animal</span></th>
              {enteteTriable("N°", "numero", "numero", "sticky left-0 z-30 min-w-16 border-r bg-gray-50 p-1.5")}
              {!colonnesMasquees.has("nom") && <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, "nom")} className={`sticky ${colonnesMasquees.has("numero") ? "left-0" : "left-16"} z-30 min-w-24 border-r bg-gray-50 p-1.5 font-bold`}>Nom</th>}
              {enteteTriable("Âge", "age", "age", "min-w-20 border-r bg-gray-50 p-1.5")}
              {enteteTriable("Sexe", "sexe", "sexe", "min-w-16 border-r bg-gray-50 p-1.5")}
              {enteteTriable("Gestation", "gestation", "gestation", "min-w-20 border-r bg-gray-50 p-1.5")}
              {enteteTriable("Avant vêlage", "velage", "velage", "min-w-24 border-r bg-gray-50 p-1.5")}
              {blocsAffiches.map((bloc) => <th key={bloc.cle} colSpan={bloc.sousColonnes.length} scope="colgroup" className="border-r border-b p-1.5 text-center font-bold text-gray-800">{bloc.nom}{bloc.voie && <span className="ml-1 font-normal text-gray-500">{bloc.voie}</span>}</th>)}
            </tr>
            <tr>{blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => { const cleTri = `vaccin:${etape.id}` as const; return <th key={etape.id} scope="col" className="min-w-24 border-r p-1.5 text-center font-medium text-gray-600"><button type="button" onClick={() => basculerTri(cleTri)} className="w-full font-semibold">{etape.label || "Injection"}{indicateurTri(cleTri)}</button>{modeSession && <button type="button" onClick={() => selectionnerVisibles(etape)} className="vaccin-print-hidden mt-0.5 block w-full text-[10px] font-semibold text-green-800 underline">Sélectionner visibles à faire</button>}</th>; }))}</tr>
          </thead>
          <tbody className="divide-y">{resultat.map((ligne) => <tr key={ligne.animalId}>
            <td className="animal-selection-column border-r p-1 text-center"><input type="checkbox" checked={animauxSelectionnes.has(ligne.animalId)} onChange={() => basculerDansSet(setAnimauxSelectionnes, ligne.animalId)} aria-label={`Sélectionner l’animal ${ligne.nutrav}`} className="h-5 w-5 accent-green-700" /></td>
            {!colonnesMasquees.has("numero") && <th scope="row" className="sticky left-0 z-20 border-r bg-white p-1.5"><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono text-sm font-black text-green-800 underline">{ligne.nutrav}</Link></th>}
            {!colonnesMasquees.has("nom") && <td className={`sticky ${colonnesMasquees.has("numero") ? "left-0" : "left-16"} z-20 max-w-32 border-r bg-white p-1.5 text-xs text-gray-600`}><span className="block truncate">{ligne.nom || "—"}</span></td>}
            {!colonnesMasquees.has("age") && <td className="border-r p-1.5 font-medium whitespace-nowrap text-gray-700">{formatAgeTerrain(ligne.danaisIso)}</td>}
            {!colonnesMasquees.has("sexe") && <td className="border-r p-1.5 font-medium text-gray-700">{ligne.sexe}</td>}
            {!colonnesMasquees.has("gestation") && <td className="border-r p-1.5 font-semibold text-gray-700">{ligne.gestationId ? "Gestante" : "Vide"}</td>}
            {!colonnesMasquees.has("velage") && <td className="border-r p-1.5 font-medium whitespace-nowrap text-gray-700">{ligne.dateVelagePrevueIso ? formatTempsAvantVelage(ligne.dateVelagePrevueIso) : "—"}</td>}
            {blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => { const cellule = ligne.cellules[etape.id]; return <td key={etape.id} className="border-r p-1 align-top">{renduCellule(cellule, ligne, etape)}{cellule?.aValider && <span className="mt-0.5 block text-[10px] font-medium text-gray-500">⚠ À vérifier</span>}</td>; }))}
          </tr>)}</tbody>
        </table>
        {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ces filtres.</p>}
      </div>}

      {menuColonne && <div ref={menuColonneRef} role="menu" aria-label="Options de colonne" className="fixed z-[70] w-56 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-xl" style={{ left: menuColonne.x, top: menuColonne.y }}>
        <button type="button" role="menuitem" disabled={colonnesMasquees.size >= colonnesAnimal.length - 1} onClick={() => masquerColonne(menuColonne.colonne)} className="block min-h-9 w-full rounded px-2 text-left font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Masquer cette colonne</button>
        {colonnesMasquees.size > 0 && <div className="mt-1 border-t pt-1"><p className="px-2 py-1 text-xs font-semibold text-gray-500">Réafficher une colonne</p>{colonnesAnimal.filter((colonne) => colonnesMasquees.has(colonne.id)).map((colonne) => <button key={colonne.id} type="button" role="menuitem" onClick={() => reafficherColonne(colonne.id)} className="block min-h-9 w-full rounded px-2 text-left text-gray-700 hover:bg-gray-50">{colonne.label}</button>)}<button type="button" role="menuitem" onClick={() => { setColonnesMasquees(new Set()); setMenuColonne(null); }} className="mt-1 block min-h-9 w-full rounded border-t px-2 text-left font-semibold text-gray-700 hover:bg-gray-50">Réafficher toutes les colonnes</button></div>}
      </div>}

      <p className="vaccin-print-hidden border-t px-3 py-2 text-xs text-gray-500">{resultat.length} animal(aux) · Jaune = à faire · Orange = bientôt, inclus dans « À faire » · Rouge = en retard.</p>

      {verification && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Vérifier la séance vaccinale"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-lg font-black text-gray-900">Vérifier la séance</h2><p className="mt-1 text-sm text-gray-600">{dateCourte.format(new Date(`${dateSession}T12:00:00`))} · {executant} · {nombreAnimaux} animal(aux) · {actes.length} acte(s)</p>
        <div className="mt-4 space-y-3">{groupesSession.map((groupe) => { const administration = ajustements[groupe.cle] ?? { voie: "", dose: "", uniteDosage: "ml" }; return <section key={groupe.cle} className="rounded-xl border p-3"><h3 className="font-bold text-gray-900">{groupe.etape.medicamentNom || groupe.bloc.nom} — {groupe.etape.label || "Injection"}</h3><p className="mt-1 text-sm text-gray-600">Animaux {groupe.actes.map((acte) => acte.ligne.nutrav).join(", ")}</p><div className="mt-3 grid grid-cols-[1fr_7rem_5rem] gap-2"><label className="text-xs text-gray-500">Voie<input value={administration.voie} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, voie: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label><label className="text-xs text-gray-500">Dose<input type="number" min="0" step="any" value={administration.dose} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, dose: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label><label className="text-xs text-gray-500">Unité<input value={administration.uniteDosage} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, uniteDosage: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label></div></section>; })}</div>
        {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={enregistrement} onClick={() => { setVerification(false); setErreur(""); }} className="min-h-11 rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Retour</button><button type="button" disabled={enregistrement} onClick={validerSession} className="min-h-11 rounded-lg bg-green-800 font-bold text-white disabled:opacity-50">{enregistrement ? "Enregistrement…" : "Valider la séance"}</button></div>
      </div></div>}
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #tableau-vaccinal-impression, #tableau-vaccinal-impression * { visibility: visible !important; }
          #tableau-vaccinal-impression { position: absolute; inset: 0; width: 100%; box-shadow: none; }
          #tableau-vaccinal-impression .vaccin-print-hidden,
          #tableau-vaccinal-impression .animal-selection-column { display: none !important; }
          #tableau-vaccinal-impression table { width: 100%; font-size: 9pt; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          #tableau-vaccinal-impression thead { display: table-header-group; }
          #tableau-vaccinal-impression tr { break-inside: avoid; page-break-inside: avoid; }
          #tableau-vaccinal-impression .overflow-x-auto { overflow: visible !important; }
          #tableau-vaccinal-impression table { min-width: 100% !important; }
          #tableau-vaccinal-impression .sticky { position: static !important; }
        }
      `}</style>
    </section>
  );
}
