"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import ExecutantSelect, { type Intervenant } from "@/app/sanitaire/nouvel-evenement/ExecutantSelect";
import { formatAgeTerrain } from "@/lib/animal-age";
import { regrouperActesVaccinaux } from "@/lib/vaccination-session";
import { medicamentCompatibleAvecEtape } from "@/lib/vaccine-attachment";
import { actesDuVaccin, anneesDisponibles, datesCompactes, type ActeHistorique } from "@/lib/vaccine-history-view";
import { comparerDateVelage, comparerUrgenceVaccinale, formatTempsAvantVelage, libelleVoieDose, voieCourte } from "@/lib/vaccine-table-presentation";

interface CelluleGrille {
  statut: "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU" | "VIDE";
  date: string | null;
  aValider: boolean;
  rattachementProtocoleAutorise: boolean;
  historiquesAValider: HistoriqueAValider[];
  actes: ActeHistorique[];
  prochaine: { statut: "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU"; date: string } | null;
}

interface HistoriqueAValider {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  date: string;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string;
  protocoleNom: string;
  gestationId: string | null;
  raison: string;
  protocoleLieAuVelage: boolean;
  etapesCompatibles: { id: string; label: string }[];
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
  actes: ActeHistorique[];
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
  protocoleNom: string | null;
  protocoleLieAuVelage: boolean;
  medicamentIds: string[];
  etapes: { id: string; reference: string; medicamentIds: string[] }[];
}

type Statut = "aFaire" | "enRetard" | "faits";
type Tri = "numero" | "age" | "sexe" | "velage" | `vaccin:${string}`;
type DirectionTri = "asc" | "desc";
type ColonneAnimal = "numero" | "nom" | "age" | "sexe" | "velage";

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
  { id: "velage", label: "Avant vêlage" },
];
const largeurColonne: Record<ColonneAnimal, number> = { numero: 64, nom: 92, age: 66, sexe: 42, velage: 76 };
const largeurSelection = 38;
const dateLocaleIso = () => {
  const date = new Date();
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10);
};
const cleActe = (animalId: string, etapeId: string) => `${animalId}|${etapeId}`;
const estAFaire = (statut: CelluleGrille["statut"]) => statut === "A_FAIRE" || statut === "BIENTOT";
// Une case déjà faite reste utilisable quand une prochaine échéance existe (rappel récurrent).
const estSelectionnable = (cellule: CelluleGrille | undefined, etape: SousColonne) =>
  Boolean(cellule && (cellule.statut !== "FAIT" || cellule.prochaine) && !cellule.aValider && etape.medicamentId);
const statutEffectif = (cellule: CelluleGrille): CelluleGrille["statut"] => cellule.statut === "FAIT" && cellule.prochaine ? cellule.prochaine.statut : cellule.statut;
const echeanceDeTri = (cellule: CelluleGrille | undefined) =>
  cellule?.prochaine ? { statut: cellule.prochaine.statut, date: cellule.prochaine.date } : cellule;

function correspondStatut(cellule: CelluleGrille, filtres: ReadonlySet<Statut>): boolean {
  if (filtres.size === 0) return true;
  const statut = statutEffectif(cellule);
  return (filtres.has("faits") && cellule.statut === "FAIT")
    || (filtres.has("aFaire") && estAFaire(statut))
    || (filtres.has("enRetard") && statut === "EN_RETARD");
}

export default function TableauVaccinal({ blocs, lignes }: { blocs: Bloc[]; lignes: Ligne[] }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [vaccinsAffiches, setVaccinsAffiches] = useState<Set<string>>(() => new Set(blocs.map((bloc) => bloc.cle)));
  const [statuts, setStatuts] = useState<Set<Statut>>(new Set());
  const [tri, setTri] = useState<Tri | null>(null);
  const [directionTri, setDirectionTri] = useState<DirectionTri | null>(null);
  const [colonnesMasquees, setColonnesMasquees] = useState<Set<ColonneAnimal>>(new Set());
  const [menuColonne, setMenuColonne] = useState<{ colonne: ColonneAnimal; x: number; y: number } | null>(null);
  const menuColonneRef = useRef<HTMLDivElement>(null);
  const [dateSession, setDateSession] = useState(dateLocaleIso);
  const [executant, setExecutant] = useState("");
  const [intervenants, setIntervenants] = useState<Intervenant[]>([]);
  const [animauxSelectionnes, setAnimauxSelectionnes] = useState<Set<string>>(new Set());
  const [uniquementSelection, setUniquementSelection] = useState(false);
  const [actesSelectionnes, setActesSelectionnes] = useState<Set<string>>(new Set());
  const [donneesManquantes, setDonneesManquantes] = useState(false);
  const [ajustements, setAjustements] = useState<Record<string, AjustementGroupe>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [rattachementEnCours, setRattachementEnCours] = useState(false);
  const [etapeChoisie, setEtapeChoisie] = useState("");
  const [anneesAffichees, setAnneesAffichees] = useState<Set<number>>(() => new Set([new Date().getFullYear()]));
  const [toutHistorique, setToutHistorique] = useState(false);
  const [panneauHistorique, setPanneauHistorique] = useState<{ animalId: string; blocCle: string } | null>(null);
  const [acteEnEdition, setActeEnEdition] = useState<string | null>(null);

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
      if (statuts.size === 0) return true;
      return blocsAffiches.some((bloc) => bloc.sousColonnes.some((etape) => {
        const cellule = ligne.cellules[etape.id];
        return cellule && correspondStatut(cellule, statuts);
      }));
    });
    const lignesFiltrees = uniquementSelection ? filtres.filter((ligne) => animauxSelectionnes.has(ligne.animalId)) : filtres;
    if (!tri || !directionTri) return lignesFiltrees;
    const signe = directionTri === "desc" ? -1 : 1;
    return [...lignesFiltrees].sort((a, b) => {
      if (tri === "age") return signe * (ageJours(a.danaisIso) - ageJours(b.danaisIso));
      if (tri === "sexe") return signe * a.sexe.localeCompare(b.sexe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      if (tri === "velage") {
        return comparerDateVelage(a.dateVelagePrevueIso, b.dateVelagePrevueIso, signe) || a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
      }
      if (tri.startsWith("vaccin:")) {
        const etapeId = tri.slice("vaccin:".length);
        return signe * comparerUrgenceVaccinale(echeanceDeTri(a.cellules[etapeId]), echeanceDeTri(b.cellules[etapeId]));
      }
      return signe * a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [animauxSelectionnes, blocsAffiches, directionTri, lignes, recherche, statuts, tri, uniquementSelection]);

  const anneeCourante = new Date().getFullYear();
  const anneesListe = useMemo(() => anneesDisponibles(lignes.flatMap((ligne) => ligne.actes.map((acte) => acte.date)), anneeCourante), [anneeCourante, lignes]);
  // Filtre d'affichage uniquement : la grille (planner) est toujours calculée sur tout l'historique.
  const anneesFiltre = toutHistorique ? null : anneesAffichees;

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
    return regrouperActesVaccinaux(
      actes,
      (acte) => acte.etape.medicamentId,
      (acte) => `${acte.etape.id}:${acte.ligne.cellules[acte.etape.id]?.rattachementProtocoleAutorise ? "structure" : "libre"}`,
    )
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
    return <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, colonne)} className={`animal-fixed animal-fixed-${colonne} ${classe}`} style={{ left: decalageColonne(colonne), width: largeurColonne[colonne], minWidth: largeurColonne[colonne] }}><button type="button" onClick={() => basculerTri(valeur)} className="w-full py-0.5 text-left font-bold" aria-label={`Trier par ${label}`}>{label}{indicateurTri(valeur)}</button></th>;
  }

  function decalageColonne(colonne: ColonneAnimal) {
    let decalage = largeurSelection;
    for (const candidate of colonnesAnimal) {
      if (candidate.id === colonne) break;
      if (!colonnesMasquees.has(candidate.id)) decalage += largeurColonne[candidate.id];
    }
    return decalage;
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

  function administrationsParDefaut() {
    return Object.fromEntries(groupesSession.map((groupe) => [groupe.cle, {
      voie: groupe.etape.voie === "À renseigner" ? "" : groupe.etape.voie ?? "",
      dose: groupe.etape.dose == null ? "" : String(groupe.etape.dose),
      uniteDosage: groupe.etape.uniteDosage ?? "ml",
    }]));
  }

  function enregistrerSelection() {
    if (!dateSession || !executant.trim() || groupesSession.length === 0) {
      setErreur("Indique la date, l’exécutant et sélectionne au moins un acte.");
      return;
    }
    const administrations = administrationsParDefaut();
    setAjustements(administrations);
    setErreur("");
    if (groupesSession.some((groupe) => !administrations[groupe.cle]?.voie.trim())) {
      setDonneesManquantes(true);
      return;
    }
    void validerSession(administrations);
  }

  async function validerSession(administrations = ajustements) {
    setErreur("");
    const voieManquante = groupesSession.find((groupe) => !administrations[groupe.cle]?.voie.trim());
    if (voieManquante) {
      setErreur(`Indique la voie pour ${voieManquante.bloc.nom} — ${voieManquante.etape.label}.`);
      return;
    }
    setEnregistrement(true);
    const enregistres = new Set<string>();
    try {
      for (const groupe of groupesSession) {
        const administration = administrations[groupe.cle];
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
            ...(groupe.actes.every((acte) => acte.ligne.cellules[groupe.etape.id]?.rattachementProtocoleAutorise)
              && groupe.etape.protocoleId
              ? { vaccinationSession: {
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
                } }
              : {}),
          }),
        });
        if (!reponse.ok) {
          const detail = await reponse.json().catch(() => ({}));
          throw new Error(detail.error || `Échec pour ${groupe.bloc.nom} — ${groupe.etape.label}`);
        }
        groupe.actes.forEach((acte) => enregistres.add(acte.cle));
      }
      setActesSelectionnes(new Set());
      setDonneesManquantes(false);
      router.refresh();
    } catch (cause) {
      if (enregistres.size > 0) setActesSelectionnes((actuels) => new Set([...actuels].filter((cle) => !enregistres.has(cle))));
      setErreur(cause instanceof Error ? cause.message : "La séance n’a pas pu être enregistrée.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function enregistrerRattachement(cible: {
    sourceType: "VACCINATION" | "TRAITEMENT";
    sourceId: string | null;
    protocoleId: string;
    protocoleLieAuVelage: boolean;
    gestationId: string | null;
  }, etapeProtocoleId: string, fermer: () => void) {
    if (!cible.sourceId || !etapeProtocoleId) return;
    setRattachementEnCours(true);
    setErreur("");
    try {
      const reponse = await fetch(cible.sourceType === "TRAITEMENT"
        ? `/api/traitements/${cible.sourceId}/rattachement-vaccinal`
        : `/api/vaccinations/${cible.sourceId}/rattachement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocoleId: cible.protocoleId,
          etapeProtocoleId,
          gestationId: cible.protocoleLieAuVelage ? cible.gestationId : null,
        }),
      });
      const detail = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(detail.error || "Le rattachement n’a pas pu être enregistré.");
      fermer();
      setEtapeChoisie("");
      router.refresh();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Le rattachement n’a pas pu être enregistré.");
    } finally {
      setRattachementEnCours(false);
    }
  }

  function ouvrirHistorique(ligne: Ligne, bloc: Bloc) {
    setEtapeChoisie("");
    setActeEnEdition(null);
    setErreur("");
    setPanneauHistorique({ animalId: ligne.animalId, blocCle: bloc.cle });
  }

  const classeStatut = (statut: CelluleGrille["statut"]) => statut === "EN_RETARD"
    ? "border-red-800 bg-red-300 text-red-950"
    : statut === "BIENTOT"
      ? "border-orange-700 bg-orange-300 text-orange-950"
      : statut === "A_FAIRE"
        ? "border-yellow-700 bg-yellow-300 text-yellow-950"
        : statut === "PREVU"
          ? "border-slate-300 bg-slate-50 text-slate-500"
          : "border-gray-300 bg-gray-50 text-gray-600";

  function renduCellule(cellule: CelluleGrille | undefined, ligne: Ligne, etape: SousColonne) {
    if (!cellule) return <span className="text-gray-300">—</span>;
    const bloc = blocs.find((item) => item.sousColonnes.some((sousColonne) => sousColonne.id === etape.id));
    const selectionne = actesSelectionnes.has(cleActe(ligne.animalId, etape.id));
    const disponible = estSelectionnable(cellule, etape);
    if (cellule.statut === "FAIT") {
      // Historique FAIT (badge vert, toutes les dates réelles des années affichées) ET prochaine
      // échéance (ligne à sa couleur de planning) coexistent dans la même case.
      const { libelles, reste, total } = datesCompactes(cellule.actes, anneesFiltre);
      const anneeDerniere = cellule.date ? new Date(cellule.date).getFullYear() : null;
      const contenu = total > 0
        ? <><span className="text-base leading-none">☑</span>{libelles.map((libelle, index) => <span key={`${libelle}-${index}`} className="text-[11px]">{libelle}</span>)}{reste > 0 && <span className="text-[10px] font-black">+{reste}</span>}</>
        : <><span className="text-base leading-none">☑</span><span className="text-[10px] opacity-70">{anneeDerniere}</span></>;
      const tousLesActes = cellule.actes.map((acte) => afficherDate(acte.date)).join(", ");
      const badgeClasse = total > 0 ? "border-green-600 bg-green-100 text-green-950 hover:bg-green-200" : "border-green-300 bg-green-50 text-green-800 hover:bg-green-100";
      return <div className="space-y-0.5">
        {bloc
          ? <button type="button" title={`Historique : ${tousLesActes} — voir ou corriger l’étape`} onClick={() => ouvrirHistorique(ligne, bloc)} className={`flex w-full flex-wrap items-center justify-center gap-x-1 rounded border px-1 py-0.5 font-bold ${badgeClasse}`}>{contenu}</button>
          : <span className={`flex w-full flex-wrap items-center justify-center gap-x-1 rounded border px-1 py-0.5 font-bold ${badgeClasse}`}>{contenu}</span>}
        {cellule.prochaine && <button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title="Prochaine échéance : ajouter ou retirer des vaccinations à enregistrer" className={`flex w-full items-center justify-center gap-1 rounded border px-1 py-0.5 whitespace-nowrap ${classeStatut(cellule.prochaine.statut)} ${selectionne ? "ring-2 ring-green-700" : ""} disabled:cursor-not-allowed disabled:opacity-50`}><span className="text-[11px] font-black">{selectionne ? "☑" : "→"}</span><span className="text-[10px] font-semibold">{afficherDate(cellule.prochaine.date)}</span></button>}
      </div>;
    }
    const classe = classeStatut(cellule.statut);
    return <button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title={disponible ? "Ajouter ou retirer des vaccinations à enregistrer" : cellule.aValider ? "Résoudre d’abord l’historique à rattacher" : "Médicament à renseigner"} className={`flex w-full items-center justify-center gap-1 rounded border px-1.5 py-1 whitespace-nowrap ${classe} ${selectionne ? "ring-2 ring-green-700" : ""} disabled:cursor-not-allowed disabled:opacity-50`}><span className="text-xl font-black leading-none">{selectionne ? "☑" : "☐"}</span>{cellule.date && <span className="text-[10px] font-semibold opacity-80">{afficherDate(cellule.date)}</span>}</button>;
  }

  function renduPanneauHistorique() {
    if (!panneauHistorique) return null;
    const ligne = lignes.find((item) => item.animalId === panneauHistorique.animalId);
    const bloc = blocs.find((item) => item.cle === panneauHistorique.blocCle);
    if (!ligne || !bloc) return null;
    // Source unique : les actes réels unifiés (Vaccination + Traitement VACCIN) de lib/vaccine-acts.ts.
    const actesVaccin = actesDuVaccin(ligne.actes, bloc);
    const configEtapes = { etapes: bloc.etapes.map((item) => ({ id: item.id, reference: item.reference, medicaments: item.medicamentIds.map((medicamentId) => ({ medicamentId })) })) };
    const etapeDe = (acte: ActeHistorique) => bloc.protocoleId && acte.protocoleId === bloc.protocoleId && acte.etapeProtocoleId
      ? bloc.sousColonnes.find((sousColonne) => sousColonne.id === acte.etapeProtocoleId) ?? null
      : null;
    const nonRattaches = actesVaccin.filter((acte) => !etapeDe(acte)).length;
    const cleEdition = (acte: ActeHistorique) => `${acte.sourceType}:${acte.sourceId}`;
    const fermer = () => { setPanneauHistorique(null); setActeEnEdition(null); setEtapeChoisie(""); setErreur(""); };
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label={`Historique — ${bloc.nom}`}><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
      <h2 className="text-lg font-black text-gray-900">Historique — {bloc.nom}</h2>
      <p className="text-sm font-bold text-gray-700">{ligne.nutrav} {ligne.nom}</p>
      {bloc.protocoleNom && <p className="text-xs text-gray-500">Protocole : {bloc.protocoleNom}</p>}
      {nonRattaches > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">Regarde toutes les dates avant de décider ce que chacune représente : {nonRattaches} acte(s) à rattacher.</p>}
      <ul className="mt-3 divide-y rounded-xl border">
        {actesVaccin.length === 0 && <li className="p-3 text-sm text-gray-500">Aucun acte enregistré pour ce vaccin.</li>}
        {actesVaccin.map((acte) => {
          const sousColonne = etapeDe(acte);
          const details = [voieCourte(acte.voie), acte.dose == null ? null : `${String(acte.dose).replace(".", ",")}${acte.uniteDosage ? ` ${acte.uniteDosage}` : ""}`].filter(Boolean).join(" · ");
          const cle = cleEdition(acte);
          const enEdition = acteEnEdition === cle;
          const compatibles = bloc.sousColonnes.filter((candidate) => !acte.medicamentId || medicamentCompatibleAvecEtape(configEtapes, candidate.id, acte.medicamentId));
          return <li key={`${cle}-${acte.date}`} className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="tabular-nums">{afficherDate(acte.date)}</b>
              {sousColonne
                ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">{sousColonne.label || "Injection"}</span>
                : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">À rattacher</span>}
              {details && <span className="text-xs text-gray-600">{details}</span>}
              <span className="text-[10px] text-gray-400">{acte.sourceType === "TRAITEMENT" ? "Traitement" : "Vaccination"}</span>
              {bloc.protocoleId && acte.sourceId && !enEdition && <button type="button" disabled={rattachementEnCours} onClick={() => { setActeEnEdition(cle); setEtapeChoisie(""); setErreur(""); }} className="ml-auto min-h-8 rounded-lg border px-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">{sousColonne ? "Modifier l’étape" : "Choisir l’étape"}</button>}
            </div>
            {enEdition && <div className="mt-2 rounded-lg bg-gray-50 p-2">
              {compatibles.length === 0
                ? <p className="text-sm text-amber-950">Aucune étape compatible avec ce médicament dans ce protocole</p>
                : <div className="grid gap-1">{compatibles.map((candidate) => <button key={candidate.id} type="button" disabled={rattachementEnCours} aria-pressed={etapeChoisie === candidate.id} onClick={() => setEtapeChoisie(candidate.id)} className={`min-h-9 rounded-lg border bg-white px-3 text-left text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 ${etapeChoisie === candidate.id ? "border-green-700 bg-green-50" : ""}`}>{candidate.label || "Injection"}{sousColonne?.id === candidate.id ? " (actuelle)" : ""}</button>)}</div>}
              <div className="mt-2 flex gap-2"><button type="button" disabled={rattachementEnCours || !etapeChoisie || etapeChoisie === sousColonne?.id} onClick={() => void enregistrerRattachement({ sourceType: acte.sourceType, sourceId: acte.sourceId, protocoleId: bloc.protocoleId!, protocoleLieAuVelage: bloc.protocoleLieAuVelage, gestationId: acte.gestationId ?? ligne.gestationId }, etapeChoisie, () => setActeEnEdition(null))} className="min-h-9 flex-1 rounded-lg bg-green-800 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button><button type="button" disabled={rattachementEnCours} onClick={() => { setActeEnEdition(null); setEtapeChoisie(""); }} className="min-h-9 rounded-lg border bg-white px-3 text-sm font-semibold">Annuler</button></div>
            </div>}
          </li>;
        })}
      </ul>
      {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
      <button type="button" disabled={rattachementEnCours} onClick={fermer} className="mt-4 min-h-11 w-full rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Fermer</button>
    </div></div>;
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

        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Années affichées ▾</summary>
          <div className="absolute right-0 z-40 mt-1 max-h-72 min-w-44 overflow-y-auto rounded-xl border bg-white p-2 shadow-xl">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 border-b text-sm font-semibold"><input type="checkbox" checked={toutHistorique} onChange={() => setToutHistorique((actuel) => !actuel)} className="h-4 w-4 accent-green-700" />Tout l’historique</label>
            {anneesListe.map((annee) => <label key={annee} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" disabled={toutHistorique} checked={toutHistorique || anneesAffichees.has(annee)} onChange={() => basculerDansSet(setAnneesAffichees, annee)} className="h-4 w-4 accent-green-700" />{annee}</label>)}
            <p className="mt-1 text-[11px] text-gray-500">Affichage seulement : les rappels sont toujours calculés sur tout l’historique.</p>
          </div>
        </details>

        <details className="relative ml-auto">
          <summary className="flex min-h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border text-gray-700" aria-label="Options du tableau"><Settings size={18} /></summary>
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border bg-white p-1 text-sm shadow-xl">
            <Link href="/config/protocoles?returnTo=%2Fsanitaire%2Fvaccins" className="block min-h-10 rounded-lg px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50">Configurer les protocoles</Link>
            <Link href="/pharmacie" className="block min-h-10 rounded-lg px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50">Pharmacie</Link>
            <button type="button" onClick={() => window.print()} className="block min-h-10 w-full rounded-lg px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50">Imprimer cette vue</button>
          </div>
        </details>
      </div>

      <div className="vaccin-print-hidden mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs"><b className="mr-auto">{animauxSelectionnes.size} animal(aux) sélectionné(s)</b><button type="button" onClick={selectionnerAnimauxVisibles} className="min-h-8 rounded border bg-white px-2 font-semibold">Tout sélectionner les animaux visibles</button><button type="button" onClick={() => { setAnimauxSelectionnes(new Set()); setUniquementSelection(false); }} className="min-h-8 rounded border bg-white px-2 font-semibold">Tout désélectionner</button><button type="button" disabled={animauxSelectionnes.size === 0} onClick={() => setUniquementSelection((actuel) => !actuel)} className="min-h-8 rounded border border-green-700 bg-white px-2 font-semibold text-green-800 disabled:opacity-40">{uniquementSelection ? "Afficher tous" : "Afficher uniquement la sélection"}</button></div>

      <div className="vaccin-print-hidden mx-3 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <p className="mb-2 text-sm font-black text-green-950">Saisie des vaccinations</p>
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(12rem,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold text-green-950">Date<input type="date" value={dateSession} onChange={(event) => setDateSession(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal text-gray-900" /></label>
          <label className="text-xs font-semibold text-green-950">Exécutant<div className="mt-1 font-normal text-gray-900"><ExecutantSelect intervenants={intervenants} value={executant} onChange={setExecutant} onAdded={(intervenant) => setIntervenants((actuels) => [...actuels, intervenant])} /></div></label>
          <button type="button" disabled={actes.length === 0 || enregistrement} onClick={enregistrerSelection} className="min-h-10 rounded-lg bg-green-800 px-3 text-sm font-bold text-white disabled:opacity-40">{enregistrement ? "Enregistrement…" : `Enregistrer ${actes.length} vaccination(s)`}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><p className="mr-auto text-xs font-semibold text-green-950">{nombreAnimaux} animal(aux) · {actes.length} vaccination(s) sélectionnée(s)</p>{actes.length > 0 && <button type="button" onClick={() => setActesSelectionnes(new Set())} className="min-h-8 rounded-lg border bg-white px-2 text-xs font-semibold">Vider la sélection</button>}</div>
        {erreur && !donneesManquantes && <p className="mt-2 text-sm font-semibold text-red-700">{erreur}</p>}
      </div>

      {blocsAffiches.length === 0 ? <p className="border-t p-3 text-sm text-gray-600">{blocs.length === 0 ? "Aucune vaccination ni protocole à afficher." : "Aucun vaccin sélectionné."}</p> : <div className="vaccin-table-scroll overflow-auto border-t">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="text-[13px]">
            <tr className="vaccin-head-1">
              <th rowSpan={2} scope="col" className="animal-selection-column sticky left-0 top-0 z-50 border-r bg-gray-50 p-1 text-center" style={{ width: largeurSelection, minWidth: largeurSelection }}><span className="sr-only">Sélection animal</span></th>
              {enteteTriable("N°", "numero", "numero", "top-0 z-40 border-r bg-gray-50 p-1")}
              {!colonnesMasquees.has("nom") && <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, "nom")} className="animal-fixed top-0 z-40 border-r bg-gray-50 p-1 font-bold" style={{ left: decalageColonne("nom"), width: largeurColonne.nom, minWidth: largeurColonne.nom }}>Nom</th>}
              {enteteTriable("Âge", "age", "age", "top-0 z-40 border-r bg-gray-50 p-1")}
              {enteteTriable("Sexe", "sexe", "sexe", "top-0 z-40 border-r bg-gray-50 p-1")}
              {enteteTriable("Avant vêlage", "velage", "velage", "top-0 z-40 border-r bg-gray-50 p-1")}
              {blocsAffiches.map((bloc) => <th key={bloc.cle} colSpan={bloc.sousColonnes.length} scope="colgroup" className="sticky top-0 z-30 h-8 border-r border-b bg-gray-50 p-1 text-center font-bold text-gray-800">{bloc.nom}{bloc.voie && <span className="ml-1 font-normal text-gray-500">{bloc.voie}</span>}</th>)}
            </tr>
            <tr className="vaccin-head-2">{blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => { const cleTri = `vaccin:${etape.id}` as const; return <th key={etape.id} scope="col" className="sticky top-8 z-30 min-w-24 border-r bg-gray-50 p-1 text-center font-medium text-gray-600"><button type="button" onClick={() => basculerTri(cleTri)} className="w-full font-semibold">{etape.label || "Injection"}{indicateurTri(cleTri)}</button><span className="mt-0.5 block text-[9px] font-medium normal-case text-gray-500">{libelleVoieDose(etape.voie, etape.dose, etape.uniteDosage)}</span></th>; }))}</tr>
          </thead>
          <tbody className="divide-y">{resultat.map((ligne) => <tr key={ligne.animalId}>
            <td className="animal-selection-column sticky left-0 z-30 border-r bg-white p-1 text-center"><input type="checkbox" checked={animauxSelectionnes.has(ligne.animalId)} onChange={() => basculerDansSet(setAnimauxSelectionnes, ligne.animalId)} aria-label={`Sélectionner l’animal ${ligne.nutrav}`} className="h-5 w-5 accent-green-700" /></td>
            {!colonnesMasquees.has("numero") && <th scope="row" className="animal-fixed z-20 border-r bg-white p-1" style={{ left: decalageColonne("numero"), width: largeurColonne.numero, minWidth: largeurColonne.numero }}><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono text-sm font-black text-green-800 underline">{ligne.nutrav}</Link></th>}
            {!colonnesMasquees.has("nom") && <td className="animal-fixed z-20 max-w-24 border-r bg-white p-1 text-xs text-gray-600" style={{ left: decalageColonne("nom"), width: largeurColonne.nom, minWidth: largeurColonne.nom }}><span className="block truncate">{ligne.nom || "—"}</span></td>}
            {!colonnesMasquees.has("age") && <td className="animal-fixed z-20 border-r bg-white p-1 font-medium whitespace-nowrap text-gray-700" style={{ left: decalageColonne("age"), width: largeurColonne.age, minWidth: largeurColonne.age }}>{formatAgeTerrain(ligne.danaisIso)}</td>}
            {!colonnesMasquees.has("sexe") && <td className="animal-fixed z-20 border-r bg-white p-1 text-center font-medium text-gray-700" style={{ left: decalageColonne("sexe"), width: largeurColonne.sexe, minWidth: largeurColonne.sexe }}>{ligne.sexe}</td>}
            {!colonnesMasquees.has("velage") && <td className="animal-fixed z-20 border-r bg-white p-1 font-medium whitespace-nowrap text-gray-700" style={{ left: decalageColonne("velage"), width: largeurColonne.velage, minWidth: largeurColonne.velage }}>{ligne.dateVelagePrevueIso ? formatTempsAvantVelage(ligne.dateVelagePrevueIso) : "—"}</td>}
            {blocsAffiches.flatMap((bloc) => bloc.sousColonnes.map((etape) => { const cellule = ligne.cellules[etape.id]; const historique = cellule?.historiquesAValider[0]; return <td key={etape.id} className="border-r p-1 align-top">{renduCellule(cellule, ligne, etape)}{historique && <button type="button" title="Historique à rattacher" onClick={() => ouvrirHistorique(ligne, bloc)} className="vaccin-print-hidden mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-600 bg-amber-50 text-[11px] font-black text-amber-900">?</button>}</td>; }))}
          </tr>)}</tbody>
        </table>
        {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ces filtres.</p>}
      </div>}

      {menuColonne && <div ref={menuColonneRef} role="menu" aria-label="Options de colonne" className="fixed z-[70] w-56 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-xl" style={{ left: menuColonne.x, top: menuColonne.y }}>
        <button type="button" role="menuitem" disabled={colonnesMasquees.size >= colonnesAnimal.length - 1} onClick={() => masquerColonne(menuColonne.colonne)} className="block min-h-9 w-full rounded px-2 text-left font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Masquer cette colonne</button>
        {colonnesMasquees.size > 0 && <div className="mt-1 border-t pt-1"><p className="px-2 py-1 text-xs font-semibold text-gray-500">Réafficher une colonne</p>{colonnesAnimal.filter((colonne) => colonnesMasquees.has(colonne.id)).map((colonne) => <button key={colonne.id} type="button" role="menuitem" onClick={() => reafficherColonne(colonne.id)} className="block min-h-9 w-full rounded px-2 text-left text-gray-700 hover:bg-gray-50">{colonne.label}</button>)}<button type="button" role="menuitem" onClick={() => { setColonnesMasquees(new Set()); setMenuColonne(null); }} className="mt-1 block min-h-9 w-full rounded border-t px-2 text-left font-semibold text-gray-700 hover:bg-gray-50">Réafficher toutes les colonnes</button></div>}
      </div>}

      <p className="vaccin-print-hidden border-t px-3 py-2 text-xs text-gray-500">{resultat.length} animal(aux) · Jaune = à faire · Orange = bientôt, inclus dans « À faire » · Rouge = en retard.</p>

      {donneesManquantes && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Informations vaccinales manquantes"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-lg font-black text-gray-900">Information nécessaire</h2><p className="mt-1 text-sm text-gray-600">Renseignez uniquement la voie absente avant l’enregistrement.</p>
        <div className="mt-4 space-y-3">{groupesSession.filter((groupe) => !ajustements[groupe.cle]?.voie.trim()).map((groupe) => { const administration = ajustements[groupe.cle] ?? { voie: "", dose: "", uniteDosage: "ml" }; return <label key={groupe.cle} className="block text-sm font-semibold text-gray-800">{groupe.etape.medicamentNom || groupe.bloc.nom} — {groupe.etape.label || "Injection"}<input autoFocus value={administration.voie} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, voie: event.target.value } }))} placeholder="Voie d’administration" className="mt-1 min-h-10 w-full rounded-lg border px-3 font-normal" /></label>; })}</div>
        {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={enregistrement} onClick={() => { setDonneesManquantes(false); setErreur(""); }} className="min-h-11 rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Annuler</button><button type="button" disabled={enregistrement} onClick={() => void validerSession()} className="min-h-11 rounded-lg bg-green-800 font-bold text-white disabled:opacity-50">{enregistrement ? "Enregistrement…" : "Enregistrer"}</button></div>
      </div></div>}

      {renduPanneauHistorique()}
      <style jsx global>{`
        #tableau-vaccinal-impression .animal-fixed { position: sticky; }
        #tableau-vaccinal-impression .vaccin-table-scroll {
          max-height: max(24rem, calc(100vh - 17rem));
          scrollbar-width: auto;
          overscroll-behavior-inline: contain;
          -webkit-overflow-scrolling: touch;
          box-shadow: inset -10px 0 12px -14px rgba(0, 0, 0, 0.8);
        }
        @media (max-width: 640px) {
          #tableau-vaccinal-impression .animal-fixed:nth-child(n+4) { position: static; }
          #tableau-vaccinal-impression .vaccin-table-scroll { max-height: calc(100vh - 18rem); }
        }
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
          #tableau-vaccinal-impression .vaccin-table-scroll { max-height: none !important; overflow: visible !important; box-shadow: none; }
          #tableau-vaccinal-impression table { min-width: 100% !important; }
          #tableau-vaccinal-impression .sticky { position: static !important; }
        }
      `}</style>
    </section>
  );
}
