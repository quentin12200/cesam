"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { regrouperActesVaccinaux } from "@/lib/vaccination-session";

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

type Sexe = "tous" | "M" | "F";
type Statut = "aFaire" | "enRetard" | "faits";
type Tri = "numero" | "age" | "sexe";

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

function libelleSexe(sexe: Sexe): string {
  if (sexe === "F") return "Femelles";
  if (sexe === "M") return "Mâles";
  return "Tous";
}

export default function TableauVaccinal({ blocs, lignes }: { blocs: Bloc[]; lignes: Ligne[] }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [vaccinsAffiches, setVaccinsAffiches] = useState<Set<string>>(() => new Set(blocs.map((bloc) => bloc.cle)));
  const [statuts, setStatuts] = useState<Set<Statut>>(new Set());
  const [sexe, setSexe] = useState<Sexe>("tous");
  const [tri, setTri] = useState<Tri>("numero");
  const [triDesc, setTriDesc] = useState(false);
  const [modeSession, setModeSession] = useState(false);
  const [dateSession, setDateSession] = useState(dateLocaleIso);
  const [executant, setExecutant] = useState("");
  const [actesSelectionnes, setActesSelectionnes] = useState<Set<string>>(new Set());
  const [verification, setVerification] = useState(false);
  const [ajustements, setAjustements] = useState<Record<string, AjustementGroupe>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");

  const blocsAffiches = useMemo(
    () => blocs.filter((bloc) => vaccinsAffiches.has(bloc.cle)),
    [blocs, vaccinsAffiches],
  );

  const resultat = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");
    const filtres = lignes.filter((ligne) => {
      if (!`${ligne.nutrav} ${ligne.nom ?? ""}`.toLocaleLowerCase("fr").includes(terme)) return false;
      if (sexe !== "tous" && ligne.sexe !== sexe) return false;
      if (statuts.size === 0) return true;
      return blocsAffiches.some((bloc) => bloc.sousColonnes.some((etape) => {
        const cellule = ligne.cellules[etape.id];
        return cellule && correspondStatut(cellule.statut, statuts);
      }));
    });
    const signe = triDesc ? -1 : 1;
    return [...filtres].sort((a, b) => {
      if (tri === "age") return signe * (ageJours(a.danaisIso) - ageJours(b.danaisIso));
      if (tri === "sexe") return signe * a.sexe.localeCompare(b.sexe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      return signe * a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [blocsAffiches, lignes, recherche, sexe, statuts, tri, triDesc]);

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

  function choisirTri(valeur: Tri, desc: boolean) {
    setTri(valeur);
    setTriDesc(desc);
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
    if (cellule.statut === "FAIT") return <span className="block rounded bg-green-50 px-1 py-1 text-[11px] font-bold text-green-900 whitespace-nowrap">☑ {afficherDate(cellule.date!)}</span>;
    const selectionne = actesSelectionnes.has(cleActe(ligne.animalId, etape.id));
    const classe = cellule.statut === "EN_RETARD"
      ? "border-red-300 bg-red-50 text-red-950"
      : cellule.statut === "BIENTOT"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-sky-300 bg-sky-50 text-sky-900";
    const contenu = `${cellule.statut === "EN_RETARD" ? "● " : ""}${afficherDate(cellule.date!)}`;
    if (!modeSession) return <span className={`block rounded border px-1 py-1 text-[11px] font-bold whitespace-nowrap ${classe}`}>{contenu}</span>;
    const disponible = estSelectionnable(cellule, etape);
    return <button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title={disponible ? "Ajouter ou retirer de la séance" : "Médicament ou protocole à renseigner"} className={`block w-full rounded border px-1 py-1 text-[11px] font-bold whitespace-nowrap ${classe} ${selectionne ? "ring-2 ring-green-700" : ""} disabled:cursor-not-allowed disabled:opacity-50`}>{selectionne ? "☑ " : "☐ "}{contenu}</button>;
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] sm:items-start">
        <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Recherche animal" aria-label="Rechercher un animal" className="min-h-10 rounded-lg border px-3 text-sm" />

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

        <button type="button" onClick={() => { setModeSession(true); setErreur(""); }} className="min-h-10 rounded-lg bg-green-700 px-4 text-sm font-bold text-white">Nouvelle séance</button>
      </div>

      {modeSession && <div className="mx-3 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(12rem,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold text-green-950">Date de séance<input type="date" value={dateSession} onChange={(event) => setDateSession(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal text-gray-900" /></label>
          <label className="text-xs font-semibold text-green-950">Exécutant<input value={executant} onChange={(event) => setExecutant(event.target.value)} placeholder="Nom de l’exécutant" className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-gray-900" /></label>
          <button type="button" onClick={() => { setModeSession(false); setActesSelectionnes(new Set()); setErreur(""); }} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-600">Annuler la séance</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><p className="mr-auto text-sm font-semibold text-green-950">Séance du {dateSession ? dateCourte.format(new Date(`${dateSession}T12:00:00`)) : "—"} — {executant.trim() || "exécutant à renseigner"} — {nombreAnimaux} animal(aux) — {actes.length} acte(s)</p>{actes.length > 0 && <button type="button" onClick={() => setActesSelectionnes(new Set())} className="min-h-9 rounded-lg border bg-white px-3 text-xs font-semibold">Vider la sélection</button>}<button type="button" onClick={ouvrirVerification} className="min-h-9 rounded-lg bg-green-800 px-3 text-sm font-bold text-white">Vérifier et valider la séance</button></div>
        {erreur && !verification && <p className="mt-2 text-sm font-semibold text-red-700">{erreur}</p>}
      </div>}

      {blocsAffiches.length === 0 ? <p className="border-t p-3 text-sm text-gray-600">{blocs.length === 0 ? "Aucune vaccination ni protocole à afficher." : "Aucun vaccin sélectionné."}</p> : <div className="overflow-x-auto border-t">
        <table className="w-full min-w-max border-collapse text-left text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th rowSpan={2} scope="col" className="sticky left-0 z-30 min-w-16 border-r bg-gray-50 p-1.5"><details className="relative"><summary className="cursor-pointer list-none font-bold">N° ▾</summary><div className="absolute left-0 z-50 mt-1 min-w-36 rounded-lg border bg-white p-1 shadow-xl"><button type="button" onClick={() => choisirTri("numero", false)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Croissant</button><button type="button" onClick={() => choisirTri("numero", true)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Décroissant</button></div></details></th>
              <th rowSpan={2} scope="col" className="sticky left-16 z-30 min-w-24 border-r bg-gray-50 p-1.5">Nom</th>
              <th rowSpan={2} scope="col" className="min-w-14 border-r bg-gray-50 p-1.5"><details className="relative"><summary className="cursor-pointer list-none font-bold">Âge ▾</summary><div className="absolute z-50 mt-1 min-w-36 rounded-lg border bg-white p-1 shadow-xl"><button type="button" onClick={() => choisirTri("age", false)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Croissant</button><button type="button" onClick={() => choisirTri("age", true)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Décroissant</button></div></details></th>
              <th rowSpan={2} scope="col" className="min-w-16 border-r bg-gray-50 p-1.5"><details className="relative"><summary className="cursor-pointer list-none font-bold">Sexe ▾</summary><div className="absolute z-50 mt-1 min-w-40 rounded-lg border bg-white p-1 shadow-xl">{([['tous', 'Tous'], ['F', 'Femelles'], ['M', 'Mâles']] as const).map(([valeur, label]) => <button key={valeur} type="button" onClick={() => setSexe(valeur)} className={`block min-h-8 w-full rounded px-2 text-left ${sexe === valeur ? "bg-green-50 font-bold" : "hover:bg-gray-50"}`}>{label}</button>)}<div className="mt-1 border-t pt-1"><button type="button" onClick={() => choisirTri("sexe", false)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Trier F → M</button><button type="button" onClick={() => choisirTri("sexe", true)} className="block min-h-8 w-full rounded px-2 text-left hover:bg-gray-50">Trier M → F</button></div></div></details><span className="block text-[9px] font-normal text-gray-400">{libelleSexe(sexe)}</span></th>
              {blocsAffiches.map((bloc) => <th key={bloc.cle} colSpan={bloc.sousColonnes.length} scope="colgroup" className="border-r border-b p-1 text-center font-bold text-gray-800">{bloc.nom}{bloc.voie && <span className="ml-1 font-normal text-gray-500">{bloc.voie}</span>}</th>)}
            </tr>
            <tr>{blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => <th key={etape.id} scope="col" className="min-w-20 border-r p-1 text-center font-normal text-gray-500"><span>{etape.label}</span>{modeSession && <button type="button" onClick={() => selectionnerVisibles(etape)} className="mt-0.5 block w-full text-[9px] font-semibold text-green-800 underline">Sélectionner visibles à faire</button>}</th>))}</tr>
          </thead>
          <tbody className="divide-y">{resultat.map((ligne) => <tr key={ligne.animalId}>
            <th scope="row" className="sticky left-0 z-20 border-r bg-white p-1.5"><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.nutrav}</Link></th>
            <td className="sticky left-16 z-20 max-w-28 border-r bg-white p-1.5 text-[10px] text-gray-500"><span className="block truncate">{ligne.nom || "—"}</span></td>
            <td className="border-r p-1.5 text-gray-600">{ageJours(ligne.danaisIso)}j</td><td className="border-r p-1.5 text-gray-600">{ligne.sexe}</td>
            {blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => { const cellule = ligne.cellules[etape.id]; return <td key={etape.id} className="border-r p-1 align-top">{renduCellule(cellule, ligne, etape)}{cellule?.aValider && <span className="mt-0.5 block text-[10px] font-medium text-gray-400">⚠ À vérifier</span>}</td>; }))}
          </tr>)}</tbody>
        </table>
        {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ces filtres.</p>}
      </div>}

      <p className="border-t px-3 py-2 text-xs text-gray-500">{resultat.length} animal(aux) · Orange = bientôt, inclus dans « À faire ».</p>

      {verification && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Vérifier la séance vaccinale"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-lg font-black text-gray-900">Vérifier la séance</h2><p className="mt-1 text-sm text-gray-600">{dateCourte.format(new Date(`${dateSession}T12:00:00`))} · {executant} · {nombreAnimaux} animal(aux) · {actes.length} acte(s)</p>
        <div className="mt-4 space-y-3">{groupesSession.map((groupe) => { const administration = ajustements[groupe.cle] ?? { voie: "", dose: "", uniteDosage: "ml" }; return <section key={groupe.cle} className="rounded-xl border p-3"><h3 className="font-bold text-gray-900">{groupe.etape.medicamentNom || groupe.bloc.nom} — {groupe.etape.label || "Injection"}</h3><p className="mt-1 text-sm text-gray-600">Animaux {groupe.actes.map((acte) => acte.ligne.nutrav).join(", ")}</p><div className="mt-3 grid grid-cols-[1fr_7rem_5rem] gap-2"><label className="text-xs text-gray-500">Voie<input value={administration.voie} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, voie: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label><label className="text-xs text-gray-500">Dose<input type="number" min="0" step="any" value={administration.dose} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, dose: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label><label className="text-xs text-gray-500">Unité<input value={administration.uniteDosage} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, uniteDosage: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm text-gray-900" /></label></div></section>; })}</div>
        {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={enregistrement} onClick={() => { setVerification(false); setErreur(""); }} className="min-h-11 rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Retour</button><button type="button" disabled={enregistrement} onClick={validerSession} className="min-h-11 rounded-lg bg-green-800 font-bold text-white disabled:opacity-50">{enregistrement ? "Enregistrement…" : "Valider la séance"}</button></div>
      </div></div>}
    </section>
  );
}
