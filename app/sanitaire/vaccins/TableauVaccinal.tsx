"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import ExecutantSelect, { type Intervenant } from "@/app/sanitaire/nouvel-evenement/ExecutantSelect";
import { formatAgeTerrain } from "@/lib/animal-age";
import { regrouperActesVaccinaux } from "@/lib/vaccination-session";
import MedicamentPicker, { type MedicamentOption } from "@/app/sanitaire/nouvel-evenement/MedicamentPicker";
import { medicamentCompatibleAvecEtape } from "@/lib/vaccine-attachment";
import { actionsSelectionAnimaux, basculerSelectionVisibles, celluleVaccinaleSelectionnable, etatSelectionMaitre, libelleAnimauxSelectionnes } from "@/lib/vaccine-selection";
import { construireChargeSoin } from "@/lib/vaccine-soin-seance";
import { actesDuVaccin, actesHistoriquesEtape, anneesDisponibles, datesCompactes, type ActeHistorique } from "@/lib/vaccine-history-view";
import { classeStatutVaccinal, comparerDateVelage, comparerUrgenceVaccinale, formatTempsAvantVelage, libelleVoieDose, voieCourte } from "@/lib/vaccine-table-presentation";
import { libelleFenetreVaccinale, selectionDepuisGroupeAgenda, type ActionAgenda, type GroupeAgenda } from "@/lib/vaccine-agenda";
import { useVaccinWorkspace, type VaccinMode } from "./useVaccinWorkspace";
import { compterVaccinationsVisibles } from "@/lib/vaccine-header-counts";
import CalendrierVaccinal from "./CalendrierVaccinal";

interface CelluleGrille {
  statut: "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU" | "VIDE";
  date: string | null;
  horsProgramme?: boolean;
  motifSansEcheance?: "HORS_CIBLE" | "ACQUIS_SANS_PREUVE" | "CALCUL_A_CONFIRMER";
  raisonsHorsCible?: { critere: "CATEGORIE" | "SEXE" | "GESTATION" | "RANG_VELAGE" | "LOT"; detail: string }[];
  aValider: boolean;
  rattachementProtocoleAutorise: boolean;
  historiquesAValider: HistoriqueAValider[];
  actes: ActeHistorique[];
  prochaine: { statut: "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU"; date: string; fenetre: { debut: string; fin: string } } | null;
  fenetre: { debut: string; fin: string } | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
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
  mereNutrav: string | null;
  mereNom: string | null;
  mereLiee: boolean;
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
  cycle: string | null;
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
type ColonneAnimal = "numero" | "nom" | "mere" | "age" | "sexe" | "velage";
type ColonneMasquable = Exclude<ColonneAnimal, "numero">;

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
  { id: "mere", label: "Mère" },
  { id: "age", label: "Âge" },
  { id: "sexe", label: "Sexe" },
  { id: "velage", label: "Avant vêlage" },
];
const colonnesMasquables = colonnesAnimal.filter((colonne): colonne is { id: ColonneMasquable; label: string } => colonne.id !== "numero");
const largeurColonne: Record<ColonneAnimal, number> = { numero: 64, nom: 92, mere: 72, age: 66, sexe: 42, velage: 76 };
const largeurSelection = 38;
const dateLocaleIso = () => {
  const date = new Date();
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10);
};
const cleActe = (animalId: string, etapeId: string) => `${animalId}|${etapeId}`;
const estAFaire = (statut: CelluleGrille["statut"]) => statut === "A_FAIRE" || statut === "BIENTOT";
// Une case FAIT n'est jamais verrouillée : une nouvelle administration reste possible (via l'historique).
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

export default function TableauVaccinal({ blocs, lignes, actionsPrevues }: { blocs: Bloc[]; lignes: Ligne[]; actionsPrevues: ActionAgenda[] }) {
  const router = useRouter();
  const [vue, setVue] = useState<"TABLEAU" | "AGENDA">("TABLEAU");
  const [recherche, setRecherche] = useState("");
  const [vaccinModes, setVaccinModes] = useState<Record<string, VaccinMode>>({});
  const [statuts, setStatuts] = useState<Set<Statut>>(new Set());
  const [tri, setTri] = useState<Tri | null>(null);
  const [directionTri, setDirectionTri] = useState<DirectionTri | null>(null);
  const [colonnesMasquees, setColonnesMasquees] = useState<Set<ColonneMasquable>>(new Set());
  const [menuColonne, setMenuColonne] = useState<{ colonne: ColonneMasquable; x: number; y: number } | null>(null);
  const menuColonneRef = useRef<HTMLDivElement>(null);
  const [colonnesMenuOuvert, setColonnesMenuOuvert] = useState(false);
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
  const [panneauHistorique, setPanneauHistorique] = useState<{ animalId: string; blocCle: string; etapeId: string } | null>(null);
  const [acteEnEdition, setActeEnEdition] = useState<string | null>(null);
  const [soinOuvert, setSoinOuvert] = useState(false);
  const [medicamentsSoins, setMedicamentsSoins] = useState<MedicamentOption[]>([]);
  const [soinMedicament, setSoinMedicament] = useState<MedicamentOption | null>(null);
  const [soinVoie, setSoinVoie] = useState("");
  const [soinDose, setSoinDose] = useState("");
  const [soinUnite, setSoinUnite] = useState("ml");
  const [soinAnimaux, setSoinAnimaux] = useState<Set<string>>(new Set());
  const [soinModifierAnimaux, setSoinModifierAnimaux] = useState(false);
  const [soinEnCours, setSoinEnCours] = useState(false);
  const [soinMessage, setSoinMessage] = useState("");
  const [vaccinsMenuOuvert, setVaccinsMenuOuvert] = useState(false);
  const [saisieOuverte, setSaisieOuverte] = useState(false);

  const { message: messageBrouillon, vider: viderBrouillon } = useVaccinWorkspace({
    vue, recherche, vaccinModes, statuts, tri, directionTri, colonnesMasquees, anneesAffichees, toutHistorique, uniquementSelection,
    animauxSelectionnes, actesSelectionnes, dateSession, executant, ajustements,
  }, { setVue, setRecherche, setVaccinModes, setStatuts, setTri, setDirectionTri, setColonnesMasquees, setAnneesAffichees, setToutHistorique, setUniquementSelection, setAnimauxSelectionnes, setActesSelectionnes, setDateSession, setExecutant, setAjustements }, lignes, blocs);

  useEffect(() => {
    fetch("/api/intervenants").then((reponse) => reponse.json()).then(setIntervenants).catch(() => {});
  }, []);

  useEffect(() => {
    function fermerMenu(event: PointerEvent) {
      if (!menuColonneRef.current?.contains(event.target as Node)) setMenuColonne(null);
    }
    function fermerSurEchap(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuColonne(null);
        setVaccinsMenuOuvert(false);
        setColonnesMenuOuvert(false);
      }
    }
    document.addEventListener("pointerdown", fermerMenu);
    window.addEventListener("keydown", fermerSurEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerMenu);
      window.removeEventListener("keydown", fermerSurEchap);
    };
  }, []);

  const modeVaccin = (cle: string): VaccinMode => vaccinModes[cle] ?? "OUVERT";
  const changerModeVaccin = (cle: string, mode: VaccinMode) => setVaccinModes((actuels) => ({ ...actuels, [cle]: mode }));
  const blocsAffiches = useMemo(() => blocs.filter((bloc) => vaccinModes[bloc.cle] !== "MASQUE"), [blocs, vaccinModes]);
  const vaccinsMasques = blocs.length - blocsAffiches.length;

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

  // Le même jeu de lignes filtrées que celui réellement affiché : aucun nouveau calcul sanitaire.
  const compteursVaccin = useMemo(() => compterVaccinationsVisibles(resultat, blocsAffiches), [resultat, blocsAffiches]);

  const anneeCourante = new Date().getFullYear();
  const anneesListe = useMemo(() => anneesDisponibles(lignes.flatMap((ligne) => ligne.actes.map((acte) => acte.date)), anneeCourante), [anneeCourante, lignes]);
  // Filtre d'affichage uniquement : la grille (planner) est toujours calculée sur tout l'historique.
  const anneesFiltre = toutHistorique ? null : anneesAffichees;
  const etatMaitre = etatSelectionMaitre(resultat.map((ligne) => ligne.animalId), animauxSelectionnes);

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
      (acte) => { const cellule = acte.ligne.cellules[acte.etape.id]; return `${acte.etape.id}:${cellule?.rattachementProtocoleAutorise ? "structure" : "libre"}:${cellule?.voie ?? acte.etape.voie ?? ""}:${cellule?.dose ?? acte.etape.dose ?? ""}`; },
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

  function ouvrirMenuColonne(event: React.MouseEvent, colonne: ColonneMasquable) {
    event.preventDefault();
    setMenuColonne({
      colonne,
      x: Math.min(event.clientX, window.innerWidth - 240),
      y: Math.min(event.clientY, window.innerHeight - 220),
    });
  }

  function masquerColonne(colonne: ColonneMasquable) {
    setColonnesMasquees((actuelles) => new Set(actuelles).add(colonne));
    if (tri === colonne) {
      setTri(null);
      setDirectionTri(null);
    }
    setMenuColonne(null);
  }

  function reafficherColonne(colonne: ColonneMasquable) {
    setColonnesMasquees((actuelles) => {
      const suivantes = new Set(actuelles);
      suivantes.delete(colonne);
      return suivantes;
    });
    setMenuColonne(null);
  }

  function enteteTriable(label: string, valeur: Tri, colonne: ColonneAnimal, classe: string) {
    if (colonne !== "numero" && colonnesMasquees.has(colonne)) return null;
    return <th rowSpan={2} scope="col" onContextMenu={colonne === "numero" ? undefined : (event) => ouvrirMenuColonne(event, colonne)} className={`animal-fixed animal-fixed-${colonne} ${classe}`} style={{ left: decalageColonne(colonne), width: largeurColonne[colonne], minWidth: largeurColonne[colonne] }}><button type="button" onClick={() => basculerTri(valeur)} className="w-full py-0.5 text-left font-bold" aria-label={`Trier par ${label}`}>{label}{indicateurTri(valeur)}</button></th>;
  }

  function decalageColonne(colonne: ColonneAnimal) {
    let decalage = largeurSelection;
    for (const candidate of colonnesAnimal) {
      if (candidate.id === colonne) break;
      if (candidate.id === "numero" || !colonnesMasquees.has(candidate.id)) decalage += largeurColonne[candidate.id];
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
    if (!celluleVaccinaleSelectionnable(cellule, etape.medicamentId)) return;
    basculerDansSet(setActesSelectionnes, cleActe(ligne.animalId, etape.id));
  }

  function basculerAnimauxVisibles() {
    setAnimauxSelectionnes((actuels) => basculerSelectionVisibles(resultat.map((ligne) => ligne.animalId), actuels));
  }

  function administrationsParDefaut() {
    return Object.fromEntries(groupesSession.map((groupe) => { const cellule = groupe.actes[0].ligne.cellules[groupe.etape.id]; return [groupe.cle, {
      voie: (cellule?.voie ?? groupe.etape.voie) === "À renseigner" ? "" : cellule?.voie ?? groupe.etape.voie ?? "",
      dose: (cellule?.dose ?? groupe.etape.dose) == null ? "" : String(cellule?.dose ?? groupe.etape.dose),
      uniteDosage: cellule?.uniteDosage ?? groupe.etape.uniteDosage ?? "ml",
    }]; }));
  }

  function enregistrerSelection() {
    if (!dateSession || !executant.trim() || groupesSession.length === 0) {
      setErreur("Indique la date, l’exécutant et sélectionne au moins un acte.");
      return;
    }
    const administrations = { ...administrationsParDefaut(), ...ajustements };
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
      viderBrouillon();
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

  function ouvrirHistorique(ligne: Ligne, bloc: Bloc, etape: SousColonne) {
    setEtapeChoisie("");
    setActeEnEdition(null);
    setErreur("");
    setPanneauHistorique({ animalId: ligne.animalId, blocCle: bloc.cle, etapeId: etape.id });
  }

  function renduCellule(cellule: CelluleGrille | undefined, ligne: Ligne, etape: SousColonne) {
    if (!cellule) return <span className="text-gray-300">—</span>;
    const bloc = blocs.find((item) => item.sousColonnes.some((sousColonne) => sousColonne.id === etape.id));
    const selectionne = actesSelectionnes.has(cleActe(ligne.animalId, etape.id));
    const disponible = celluleVaccinaleSelectionnable(cellule, etape.medicamentId);
    const historiqueEtape = actesHistoriquesEtape(ligne.actes, etape.id);
    // La grille peut reconnaître une ancienne étape en lecture, sans modifier l'acte stocké.
    for (const acte of cellule.actes) {
      if (!historiqueEtape.some((v) => v.sourceType === acte.sourceType && v.sourceId === acte.sourceId && v.date === acte.date && v.medicamentId === acte.medicamentId)) historiqueEtape.push(acte);
    }
    const tousLesActes = historiqueEtape.map((acte) => afficherDate(acte.date)).join(", ");
    const datesInitiales = datesCompactes(historiqueEtape, anneesFiltre, 1);
    const historique = historiqueEtape.length > 0 && bloc
      ? <button type="button" title={`Historique : ${tousLesActes} — voir ou corriger l’étape`} aria-label={`Ouvrir l’historique ${etape.label || "vaccinal"} : ${tousLesActes}`} onClick={() => ouvrirHistorique(ligne, bloc, etape)} className="flex w-full items-center justify-center gap-x-1 rounded border border-green-600 bg-green-100 px-1 py-0.5 font-bold text-green-950 hover:bg-green-200">
          <span className="text-base leading-none">✓</span>
          {datesInitiales.total === 0 ? <span className="text-[10px]">ancien</span> : <>{datesInitiales.libelles.map((libelle) => <span key={libelle} className="text-[11px]">{libelle}</span>)}{datesInitiales.reste > 0 && <span className="text-[10px] font-black">+{datesInitiales.reste}</span>}</>}
        </button>
      : null;

    const prochaine = cellule.aValider ? null : cellule.statut === "FAIT" ? cellule.prochaine : cellule.statut !== "VIDE" && cellule.fenetre
      ? { statut: cellule.statut, fenetre: cellule.fenetre }
      : null;
    const saisieLibre = etape.protocoleId === null && !cellule.aValider;
    const premiereEtape = bloc?.sousColonnes[0]?.id === etape.id && etape.cycle !== "ENTRETIEN";
    const action = prochaine ? (() => {
      const libelle = libelleFenetreVaccinale(prochaine.statut, prochaine.fenetre.debut, prochaine.fenetre.fin, premiereEtape);
      return <button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title={cellule.statut === "FAIT" ? "Prochaine échéance : ajouter ou retirer des vaccinations à enregistrer" : disponible ? "Ajouter ou retirer des vaccinations à enregistrer" : "Médicament à renseigner"} className={`flex w-full items-center justify-center gap-1 rounded border px-1 py-0.5 ${classeStatutVaccinal[prochaine.statut]} ${selectionne ? "ring-2 ring-slate-800" : ""} disabled:cursor-not-allowed disabled:opacity-50`}><span className={`${cellule.statut === "FAIT" ? "text-[11px]" : "text-xl"} font-black leading-none`}>{selectionne ? "☑" : cellule.statut === "FAIT" ? "→" : "☐"}</span><span className="text-[10px] font-semibold leading-tight">{libelle.statut && <span className="block">{libelle.statut}</span>}<span className="block">{libelle.date}</span></span></button>;
    })() : saisieLibre
      ? <div className="text-center text-[10px] text-gray-600"><span className="block">Sans protocole</span><button type="button" disabled={!disponible} aria-pressed={selectionne} onClick={() => basculerActe(ligne, etape)} title="Enregistrer une vaccination faite sans échéance calculée" className={`mt-0.5 min-h-9 rounded border border-gray-400 bg-gray-50 px-2 font-semibold text-gray-800 ${selectionne ? "ring-2 ring-gray-700" : ""} disabled:cursor-not-allowed disabled:opacity-50`}>{selectionne ? "☑" : "+"} enregistrer</button></div>
      : null;
    const aRattacher = cellule.historiquesAValider.length > 0 && bloc
      ? <button type="button" title="Historique à rattacher" onClick={() => ouvrirHistorique(ligne, bloc, etape)} className="vaccin-print-hidden flex min-h-9 w-full items-center justify-center rounded border-2 border-amber-700 bg-amber-50 px-1 text-[11px] font-bold text-amber-950">À rattacher</button>
      : null;

    const libellesCriteres = {
      CATEGORIE: "catégorie", SEXE: "sexe", GESTATION: "gestation", RANG_VELAGE: "rang de vêlage", LOT: "lot",
    } as const;
    const raisonsHorsCible = cellule.raisonsHorsCible ?? [];
    const motifSansEcheance = !cellule.aValider && cellule.statut === "VIDE" && !historiqueEtape.length && cellule.motifSansEcheance
      ? cellule.motifSansEcheance === "HORS_CIBLE"
        ? <details className="rounded border border-amber-500 bg-amber-50 px-1 py-1 text-center text-[10px] font-semibold text-amber-950">
            <summary className="cursor-pointer" title="Ouvrir les critères du protocole qui excluent cet animal">
              Hors cible : {raisonsHorsCible.length ? [...new Set(raisonsHorsCible.map((raison) => libellesCriteres[raison.critere]))].join(", ") : "vérifier"}
            </summary>
            <div className="mt-1 space-y-1 border-t border-amber-200 pt-1 text-left font-normal">
              {raisonsHorsCible.length
                ? raisonsHorsCible.map((raison, index) => <p key={index}>{raison.detail}</p>)
                : <p>Vérifie la catégorie, le sexe, la gestation, le lot et le rang de vêlage définis dans le protocole.</p>}
              <p className="font-semibold">Aucune vaccination n’est déduite de cette exclusion.</p>
            </div>
          </details>
        : <span role="status" title={cellule.motifSansEcheance === "ACQUIS_SANS_PREUVE"
          ? "Le protocole porte un statut acquis, mais aucune injection correspondante n'a été retrouvée dans l'historique reconnu. À contrôler avant toute correction."
          : "La planification ne peut pas être établie à partir des données actuelles. Vérifier les dates, le protocole et les anciens statuts."}
          className="block rounded border border-amber-500 bg-amber-50 px-1 py-1 text-center text-[10px] font-semibold text-amber-950">
          {cellule.motifSansEcheance === "ACQUIS_SANS_PREUVE" ? "Statut acquis sans acte · vérifier" : "Calcul à confirmer"}
        </span>
      : null;
    const horsProgramme = cellule.horsProgramme && !cellule.aValider
      ? <span title="Âge maximal de démarrage défini par l'élevage, sans vaccination enregistrée" className="block rounded border border-slate-300 bg-slate-50 px-1 py-1 text-center text-[10px] font-semibold text-slate-600">Hors programme</span>
      : null;
    if (!historique && !action && !aRattacher && !horsProgramme && !motifSansEcheance) return <span className="text-gray-300">—</span>;
    return <div className="space-y-0.5">
      {historique}
      {aRattacher}
      {motifSansEcheance}
      {horsProgramme}
      {action}
      {selectionne && cellule.statut === "FAIT" && !cellule.prochaine && <span className="block rounded border border-slate-700 px-1 text-center text-[10px] font-bold text-slate-900 ring-2 ring-slate-700">+ nouvelle</span>}
    </div>;
  }

  function renduPanneauHistorique() {
    if (!panneauHistorique) return null;
    const ligne = lignes.find((item) => item.animalId === panneauHistorique.animalId);
    const bloc = blocs.find((item) => item.cle === panneauHistorique.blocCle);
    const etapeCliquee = bloc?.sousColonnes.find((item) => item.id === panneauHistorique.etapeId);
    if (!ligne || !bloc || !etapeCliquee) return null;
    // Identité RÉELLE du médicament de la colonne : deux vaccins d'un même protocole ne partagent jamais leur historique.
    const medicamentId = etapeCliquee.medicamentId ?? bloc.medicamentId;
    const nomVaccin = etapeCliquee.medicamentNom ?? bloc.nom;
    // Source unique : les actes réels unifiés (Vaccination + Traitement VACCIN) de lib/vaccine-acts.ts.
    const actesDuProduit = actesDuVaccin(ligne.actes, { id: medicamentId, nom: nomVaccin });
    // Ne jamais afficher un acte d’un autre produit au seul motif que le protocole le propose à rattacher.
    // Exemple : un ROTAVEC en attente ne doit pas apparaître dans l’historique BOVILIS CRYPTIUM.
    const actesVaccin = actesDuProduit;
    const configEtapes = { etapes: bloc.etapes.map((item) => ({ id: item.id, reference: item.reference, medicaments: item.medicamentIds.map((idMedicament) => ({ medicamentId: idMedicament })) })) };
    const etapeDe = (acte: ActeHistorique) => {
      const structuree = bloc.protocoleId && acte.protocoleId === bloc.protocoleId && acte.etapeProtocoleId
        ? bloc.sousColonnes.find((sousColonne) => sousColonne.id === acte.etapeProtocoleId) : null;
      return structuree ?? bloc.sousColonnes.find((colonne) => ligne.cellules[colonne.id]?.actes.some((v) =>
        v.sourceType === acte.sourceType && v.sourceId === acte.sourceId && v.date === acte.date && v.medicamentId === acte.medicamentId)) ?? null;
    };
    const nonRattaches = actesVaccin.filter((acte) => !etapeDe(acte)).length;
    const cleEdition = (acte: ActeHistorique) => `${acte.sourceType}:${acte.sourceId}`;
    const fermer = () => { setPanneauHistorique(null); setActeEnEdition(null); setEtapeChoisie(""); setErreur(""); };
    // Une étape déjà faite n'est jamais verrouillée : on peut ajouter une nouvelle administration.
    const etapesNouvelleAdministration = bloc.protocoleId && medicamentId
      ? bloc.sousColonnes.filter((candidate) => medicamentCompatibleAvecEtape(configEtapes, candidate.id, medicamentId))
      : [];
    const ajouterNouvelleAdministration = (etape: SousColonne) => {
      setActesSelectionnes((actuels) => new Set(actuels).add(cleActe(ligne.animalId, etape.id)));
      fermer();
    };
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label={`Historique — ${nomVaccin}`}><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
      <h2 className="text-lg font-black text-gray-900">Historique — {nomVaccin}</h2>
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
              {!sousColonne && <span className="text-xs text-gray-600">{acte.vaccin}</span>}
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
      {etapesNouvelleAdministration.length > 0 && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-2">
        <p className="text-sm font-semibold text-green-950">Nouvelle administration</p>
        <p className="mb-2 text-[11px] text-green-900">Ajoute un nouvel acte à la séance (date et exécutant de la séance) ; les anciennes dates ne changent pas.</p>
        <div className="flex flex-wrap gap-1">{etapesNouvelleAdministration.map((candidate) => <button key={candidate.id} type="button" onClick={() => ajouterNouvelleAdministration(candidate)} className="min-h-9 rounded-lg border border-green-700 bg-white px-3 text-sm font-semibold text-green-900">+ {candidate.label || "Injection"}</button>)}</div>
      </div>}
      {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
      <button type="button" disabled={rattachementEnCours} onClick={fermer} className="mt-4 min-h-11 w-full rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Fermer</button>
    </div></div>;
  }

  // Séance de travail : un soin non vaccinal (ex. bolus) appliqué au même lot, même date, même exécutant.
  const animauxDuLot = useMemo(() => {
    const ids = new Set([...animauxSelectionnes, ...actes.map((acte) => acte.ligne.animalId)]);
    return lignes.filter((ligne) => ids.has(ligne.animalId));
  }, [actes, animauxSelectionnes, lignes]);

  async function ouvrirSoin() {
    if (animauxDuLot.length === 0) {
      setErreur("Sélectionne d’abord des animaux ou des vaccinations.");
      return;
    }
    setErreur("");
    setSoinMessage("");
    setSoinMedicament(null);
    setSoinVoie("");
    setSoinDose("");
    setSoinUnite("ml");
    setSoinModifierAnimaux(false);
    setSoinAnimaux(new Set(animauxDuLot.map((ligne) => ligne.animalId)));
    setSoinOuvert(true);
    if (medicamentsSoins.length === 0) {
      try {
        const liste = await fetch("/api/medicaments").then((reponse) => reponse.json()) as (MedicamentOption & { actif: boolean })[];
        // Un soin n'est jamais un vaccin : les médicaments de catégorie VACCIN restent dans le tableau vaccinal.
        setMedicamentsSoins(liste.filter((medicament) => medicament.actif && medicament.categorie !== "VACCIN"));
      } catch {
        setErreur("Les médicaments n’ont pas pu être chargés.");
      }
    }
  }

  async function enregistrerSoin() {
    if (!soinMedicament || soinAnimaux.size === 0) return;
    if (!dateSession || !executant.trim()) {
      setErreur("Indique la date et l’exécutant de la séance.");
      return;
    }
    setSoinEnCours(true);
    setErreur("");
    try {
      const charge = construireChargeSoin({
        animalIds: [...soinAnimaux],
        date: dateSession,
        executant,
        medicamentId: soinMedicament.id,
        medicamentNom: soinMedicament.nom,
        voie: soinVoie.trim() || null,
        dose: soinDose === "" ? null : Number(soinDose),
        uniteDosage: soinUnite || null,
        delaiAttenteViandeJ: soinMedicament.delaiAttenteViandeJ,
        delaiAttenteLaitJ: soinMedicament.delaiAttenteLaitJ,
      });
      const reponse = await fetch("/api/evenements/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(charge) });
      const detail = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(detail.error || "Le soin n’a pas pu être enregistré.");
      setSoinMessage(`${soinMedicament.nom} enregistré pour ${soinAnimaux.size} animal(aux).`);
      setSoinOuvert(false);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Le soin n’a pas pu être enregistré.");
    } finally {
      setSoinEnCours(false);
    }
  }

  function renduPanneauSoin() {
    if (!soinOuvert) return null;
    const fermer = () => { setSoinOuvert(false); setErreur(""); };
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Ajouter un soin ou traitement"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
      <h2 className="text-lg font-black text-gray-900">Ajouter un soin / traitement</h2>
      <p className="text-xs text-gray-500">Date {afficherDate(dateSession)} · exécutant {executant || "à renseigner"} — enregistré comme un traitement sanitaire normal, jamais comme un vaccin.</p>
      <div className="mt-3"><MedicamentPicker medicaments={medicamentsSoins} value={soinMedicament} onChange={(medicament) => { setSoinMedicament(medicament); setSoinVoie(medicament?.voie ?? ""); setSoinUnite(medicament?.uniteDosage ?? "ml"); }} /></div>
      {soinMedicament && <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold text-gray-700">
        <label>Voie<input value={soinVoie} onChange={(event) => setSoinVoie(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm font-normal" /></label>
        <label>Dose<input type="number" min={0} step="0.1" value={soinDose} onChange={(event) => setSoinDose(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm font-normal" /></label>
        <label>Unité<input value={soinUnite} onChange={(event) => setSoinUnite(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border px-2 text-sm font-normal" /></label>
      </div>}
      <div className="mt-3 rounded-lg bg-gray-50 p-2 text-sm">
        <div className="flex items-center gap-2"><b className="mr-auto">{soinAnimaux.size} animal(aux) du lot</b><button type="button" onClick={() => setSoinModifierAnimaux((actuel) => !actuel)} className="min-h-8 text-xs font-semibold text-green-800 underline">{soinModifierAnimaux ? "Terminé" : "Modifier les animaux"}</button></div>
        {soinModifierAnimaux && <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">{animauxDuLot.map((ligne) => <label key={ligne.animalId} className="flex min-h-9 cursor-pointer items-center gap-2"><input type="checkbox" checked={soinAnimaux.has(ligne.animalId)} onChange={() => basculerDansSet(setSoinAnimaux, ligne.animalId)} className="h-5 w-5 accent-green-700" />{ligne.nutrav} {ligne.nom}</label>)}</div>}
      </div>
      {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
      <button type="button" disabled={!soinMedicament || soinAnimaux.size === 0 || soinEnCours} onClick={() => void enregistrerSoin()} className="mt-3 min-h-11 w-full rounded-lg bg-green-800 font-semibold text-white disabled:opacity-40">{soinEnCours ? "Enregistrement…" : `Appliquer aux ${soinAnimaux.size} animaux`}</button>
      <button type="button" disabled={soinEnCours} onClick={fermer} className="mt-2 min-h-11 w-full rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Annuler</button>
    </div></div>;
  }

  function preparerDepuisAgenda(groupe: GroupeAgenda) {
    const selection = selectionDepuisGroupeAgenda(groupe);
    setAnimauxSelectionnes(new Set(selection.animalIds));
    setActesSelectionnes(new Set(selection.actes));
    setUniquementSelection(true);
    const bloc = blocs.find((item) => item.sousColonnes.some((etape) => etape.id === groupe.actions[0]?.etapeId));
    if (bloc) changerModeVaccin(bloc.cle, "OUVERT");
    setVue("TABLEAU");
  }

  return (
    <section id="tableau-vaccinal-impression" className="rounded-2xl bg-white shadow-sm">
      {messageBrouillon && <p role="status" className="vaccin-print-hidden m-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{messageBrouillon}</p>}
      <h1 className="hidden text-lg font-black print:block">Tableau vaccinal</h1>
      <div className="vaccin-print-hidden flex flex-wrap items-start gap-2 p-3">
        <div className="inline-flex min-h-10 rounded-lg border bg-white p-1 text-sm font-semibold">
          <button type="button" aria-pressed={vue === "TABLEAU"} onClick={() => setVue("TABLEAU")} className={`rounded-md px-3 ${vue === "TABLEAU" ? "bg-green-800 text-white" : "text-gray-700"}`}>Tableau</button>
          <button type="button" aria-pressed={vue === "AGENDA"} onClick={() => setVue("AGENDA")} className={`rounded-md px-3 ${vue === "AGENDA" ? "bg-green-800 text-white" : "text-gray-700"}`}>Agenda</button>
        </div>
        {vue === "TABLEAU" && <>
        <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Recherche animal" aria-label="Rechercher un animal" className="min-h-10 min-w-48 flex-1 rounded-lg border px-3 text-sm" />

        <button type="button" onClick={() => setVaccinsMenuOuvert(true)} aria-haspopup="dialog" aria-expanded={vaccinsMenuOuvert} className="flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Vaccins · {vaccinsMasques} masqué{vaccinsMasques > 1 ? "s" : ""} ▾</button>

        <button type="button" onClick={() => setColonnesMenuOuvert(true)} aria-haspopup="dialog" aria-expanded={colonnesMenuOuvert} className="flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Colonnes</button>

        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-semibold text-gray-700">Statuts ▾</summary>
          <div className="absolute right-0 z-40 mt-1 min-w-44 rounded-xl border bg-white p-2 shadow-xl">
            {([['faits', 'Faits'], ['aFaire', 'À faire'], ['enRetard', 'En retard']] as const).map(([valeur, label]) => <label key={valeur} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={statuts.has(valeur)} onChange={() => basculerDansSet(setStatuts, valeur)} className="h-4 w-4 accent-green-700" />{label}</label>)}
            <button type="button" onClick={() => setStatuts(new Set())} className="mt-1 text-xs font-semibold underline">Afficher tous les statuts</button>
          </div>
        </details>
        </>}

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

      {vue === "AGENDA" && <CalendrierVaccinal actions={actionsPrevues} lignes={lignes} blocs={blocs} anneesFiltre={anneesFiltre} onPreparer={preparerDepuisAgenda} />}
      <div className={vue === "TABLEAU" ? "" : "hidden"}>
      <p className="vaccin-print-hidden mx-3 mb-2 flex flex-wrap items-center gap-x-2 text-xs text-gray-600"><span className="font-semibold">{libelleAnimauxSelectionnes(animauxSelectionnes.size)}</span><span aria-hidden="true">·</span><button type="button" disabled={animauxSelectionnes.size === 0} onClick={() => setUniquementSelection((actuel) => !actuel)} className="min-h-9 px-1 font-semibold text-green-800 underline disabled:opacity-40">{actionsSelectionAnimaux(uniquementSelection).basculerVue}</button><span aria-hidden="true">·</span><button type="button" disabled={animauxSelectionnes.size === 0} onClick={() => { setAnimauxSelectionnes(new Set()); setUniquementSelection(false); }} className="min-h-9 px-1 font-semibold text-green-800 underline disabled:opacity-40">{actionsSelectionAnimaux(uniquementSelection).vider}</button></p>


      <div className="vaccin-print-hidden mx-3 mb-3 rounded-xl border border-green-200 bg-green-50 p-2 sm:p-3">
        <button type="button" onClick={() => setSaisieOuverte((actuel) => !actuel)} aria-expanded={saisieOuverte} className="flex min-h-9 w-full items-center justify-between text-left text-sm font-black text-green-950 sm:hidden"><span>💉 Saisie · {actes.length} vaccination(s) sélectionnée(s)</span><span aria-hidden="true">{saisieOuverte ? "▴" : "▾"}</span></button>
        <div className={`${saisieOuverte ? "block" : "hidden"} sm:block`}>
        <p className="mb-2 hidden text-sm font-black text-green-950 sm:block">Saisie des vaccinations</p>
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(12rem,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold text-green-950">Date<input type="date" value={dateSession} onChange={(event) => setDateSession(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal text-gray-900" /></label>
          <label className="text-xs font-semibold text-green-950">Exécutant<div className="mt-1 font-normal text-gray-900"><ExecutantSelect intervenants={intervenants} value={executant} onChange={setExecutant} onAdded={(intervenant) => setIntervenants((actuels) => [...actuels, intervenant])} /></div></label>
          <button type="button" disabled={actes.length === 0 || enregistrement} onClick={enregistrerSelection} className="min-h-10 rounded-lg bg-green-800 px-3 text-sm font-bold text-white disabled:opacity-40">{enregistrement ? "Enregistrement…" : `Enregistrer ${actes.length} vaccination(s)`}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><p className="mr-auto text-xs font-semibold text-green-950">{nombreAnimaux} animal(aux) · {actes.length} vaccination(s) sélectionnée(s)</p><button type="button" onClick={() => void ouvrirSoin()} className="min-h-8 rounded-lg border border-green-700 bg-white px-2 text-xs font-semibold text-green-900">+ Ajouter un soin / traitement</button>{soinMessage && <span className="text-xs font-semibold text-green-900">{soinMessage}</span>}{actes.length > 0 && <button type="button" onClick={() => setActesSelectionnes(new Set())} className="min-h-8 rounded-lg border bg-white px-2 text-xs font-semibold">Vider la sélection</button>}</div>
        {erreur && !donneesManquantes && <p className="mt-2 text-sm font-semibold text-red-700">{erreur}</p>}
        </div>
      </div>

      <div className="vaccin-table-scroll overflow-auto border-t">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="text-[13px]">
            <tr className="vaccin-head-1">
              <th rowSpan={2} scope="col" className="animal-selection-column sticky left-0 top-0 z-50 border-r bg-gray-50 p-1 text-center" style={{ width: largeurSelection, minWidth: largeurSelection }}><input type="checkbox" aria-label="Sélectionner ou désélectionner les animaux visibles" checked={etatMaitre === "TOUS"} ref={(element) => { if (element) element.indeterminate = etatMaitre === "PARTIEL"; }} onChange={basculerAnimauxVisibles} className="h-5 w-5 accent-green-700" /></th>
              {enteteTriable("N°", "numero", "numero", "top-0 z-40 border-r bg-gray-50 p-1")}
              {!colonnesMasquees.has("nom") && <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, "nom")} className="animal-fixed top-0 z-40 border-r bg-gray-50 p-1 font-bold" style={{ left: decalageColonne("nom"), width: largeurColonne.nom, minWidth: largeurColonne.nom }}>Nom</th>}
              {!colonnesMasquees.has("mere") && <th rowSpan={2} scope="col" onContextMenu={(event) => ouvrirMenuColonne(event, "mere")} className="animal-fixed top-0 z-40 border-r bg-gray-50 p-1 font-bold" style={{ left: decalageColonne("mere"), width: largeurColonne.mere, minWidth: largeurColonne.mere }}>Mère</th>}
              {enteteTriable("Âge", "age", "age", "top-0 z-40 border-r bg-gray-50 p-1")}
              {enteteTriable("Sexe", "sexe", "sexe", "top-0 z-40 border-r bg-gray-50 p-1")}
              {enteteTriable("Avant vêlage", "velage", "velage", "top-0 z-40 border-r bg-gray-50 p-1")}
              {blocsAffiches.map((bloc) => modeVaccin(bloc.cle) === "COMPACT"
                ? <th key={bloc.cle} scope="col" title={bloc.nom} className="sticky top-0 z-30 w-11 min-w-11 border-r border-b bg-gray-100 p-0 text-center"><button type="button" onClick={() => changerModeVaccin(bloc.cle, "OUVERT")} aria-label={`Ouvrir ${bloc.nom} — ${bloc.protocoleId ? `${compteursVaccin[bloc.cle]?.total.aFaire ?? 0} à faire` : "sans protocole"}`} className="min-h-11 w-11 text-base font-bold text-gray-700"><span className="block leading-none">‖</span><span className="block text-[10px] leading-tight">{bloc.protocoleId ? compteursVaccin[bloc.cle]?.total.aFaire ?? 0 : "—"}</span></button></th>
                : <th key={bloc.cle} colSpan={bloc.sousColonnes.length} scope="colgroup" title={bloc.nom} className="sticky top-0 z-30 h-11 min-w-36 border-r border-b bg-gray-50 p-1 text-center font-bold text-gray-800"><span className="flex h-10 items-center justify-center gap-1"><span className="min-w-0 flex-1 leading-tight"><span className="block truncate">{bloc.nom}</span><span className="block text-[10px] font-semibold text-gray-700">{bloc.protocoleId ? <>{compteursVaccin[bloc.cle]?.total.aFaire ?? 0} à faire{(compteursVaccin[bloc.cle]?.total.enRetard ?? 0) > 0 ? ` · ${compteursVaccin[bloc.cle].total.enRetard} en retard` : ""}</> : "Sans protocole"}</span></span><span className="vaccin-print-hidden inline-flex shrink-0 gap-0.5"><button type="button" onClick={() => changerModeVaccin(bloc.cle, "COMPACT")} aria-label={`Réduire ${bloc.nom}`} title={`Réduire ${bloc.nom}`} className="min-h-9 min-w-9 rounded border bg-white text-base">−</button><button type="button" onClick={() => changerModeVaccin(bloc.cle, "MASQUE")} aria-label={`Masquer ${bloc.nom}`} title={`Masquer ${bloc.nom}`} className="min-h-9 rounded border bg-white px-1 text-[10px]">Masquer</button></span></span></th>)}
            </tr>
            <tr className="vaccin-head-2">{blocsAffiches.flatMap((bloc) => modeVaccin(bloc.cle) === "COMPACT"
              ? [<th key={`${bloc.cle}-compact`} className="sticky top-11 z-30 w-11 min-w-11 border-r bg-gray-100 p-0"><button type="button" onClick={() => changerModeVaccin(bloc.cle, "OUVERT")} aria-label={`Ouvrir ${bloc.nom}`} title={bloc.nom} className="min-h-10 w-11 text-gray-600">‖</button></th>]
              : bloc.sousColonnes.map((etape) => { const cleTri = `vaccin:${etape.id}` as const; return <th key={etape.id} scope="col" className="sticky top-11 z-30 min-w-24 border-r bg-gray-50 p-1 text-center font-medium text-gray-600"><button type="button" onClick={() => basculerTri(cleTri)} className="w-full font-semibold">{etape.protocoleId === null ? "Sans protocole" : etape.label || "Étape"}{indicateurTri(cleTri)}</button><span className="mt-0.5 block text-[9px] font-medium normal-case text-gray-500">{libelleVoieDose(etape.voie, etape.dose, etape.uniteDosage)}</span>{etape.protocoleId && <span className="mt-0.5 block text-[10px] font-bold text-gray-800">{compteursVaccin[bloc.cle]?.etapes[etape.id]?.aFaire ?? 0} à faire</span>}</th>; }))}</tr>
          </thead>
          <tbody className="divide-y">{resultat.map((ligne) => <tr key={ligne.animalId}>
            <td className="animal-selection-column sticky left-0 z-30 border-r bg-white p-1 text-center"><input type="checkbox" checked={animauxSelectionnes.has(ligne.animalId)} onChange={() => basculerDansSet(setAnimauxSelectionnes, ligne.animalId)} aria-label={`Sélectionner l’animal ${ligne.nutrav}`} className="h-5 w-5 accent-green-700" /></td>
            <th scope="row" className="animal-fixed z-20 border-r bg-white p-1" style={{ left: decalageColonne("numero"), width: largeurColonne.numero, minWidth: largeurColonne.numero }}><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono text-sm font-black text-green-800 underline">{ligne.nutrav}</Link></th>
            {!colonnesMasquees.has("nom") && <td className="animal-fixed z-20 max-w-24 border-r bg-white p-1 text-xs text-gray-600" style={{ left: decalageColonne("nom"), width: largeurColonne.nom, minWidth: largeurColonne.nom }}><span className="block truncate">{ligne.nom || "—"}</span></td>}
            {!colonnesMasquees.has("mere") && <td className="animal-fixed z-20 border-r bg-white p-1 text-xs text-gray-700" style={{ left: decalageColonne("mere"), width: largeurColonne.mere, minWidth: largeurColonne.mere }} title={ligne.mereNom ? `${ligne.mereNutrav ?? ""} — ${ligne.mereNom}` : ligne.mereNutrav ?? undefined}>{ligne.mereNutrav ? (ligne.mereLiee ? <Link href={`/troupeau/${ligne.mereNutrav}`} className="font-mono font-bold text-green-800 underline">{ligne.mereNutrav}</Link> : <span className="font-mono font-semibold">{ligne.mereNutrav}</span>) : "—"}</td>}
            {!colonnesMasquees.has("age") && <td className="animal-fixed z-20 border-r bg-white p-1 font-medium whitespace-nowrap text-gray-700" style={{ left: decalageColonne("age"), width: largeurColonne.age, minWidth: largeurColonne.age }}>{formatAgeTerrain(ligne.danaisIso)}</td>}
            {!colonnesMasquees.has("sexe") && <td className="animal-fixed z-20 border-r bg-white p-1 text-center font-medium text-gray-700" style={{ left: decalageColonne("sexe"), width: largeurColonne.sexe, minWidth: largeurColonne.sexe }}>{ligne.sexe}</td>}
            {!colonnesMasquees.has("velage") && <td className="animal-fixed z-20 border-r bg-white p-1 font-medium whitespace-nowrap text-gray-700" style={{ left: decalageColonne("velage"), width: largeurColonne.velage, minWidth: largeurColonne.velage }}>{ligne.dateVelagePrevueIso ? formatTempsAvantVelage(ligne.dateVelagePrevueIso) : "—"}</td>}
            {blocsAffiches.flatMap((bloc) => modeVaccin(bloc.cle) === "COMPACT"
              ? [<td key={`${bloc.cle}-compact`} className="w-11 min-w-11 border-r bg-gray-50 p-0 text-center"><button type="button" onClick={() => changerModeVaccin(bloc.cle, "OUVERT")} aria-label={`Ouvrir ${bloc.nom}`} title={bloc.nom} className="min-h-11 w-11 text-gray-600">‖</button></td>]
              : bloc.sousColonnes.map((etape) => <td key={etape.id} className="border-r p-1 align-top">{renduCellule(ligne.cellules[etape.id], ligne, etape)}</td>))}
          </tr>)}</tbody>
        </table>
        {resultat.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun animal avec ces filtres.</p>}
      </div>
      {blocsAffiches.length === 0 && <p className="vaccin-print-hidden border-t p-3 text-sm text-gray-600">{blocs.length === 0 ? "Aucun vaccin configuré." : "Tous les vaccins sont masqués. Ouvre « Vaccins » pour les retrouver."}</p>}

      {menuColonne && <div ref={menuColonneRef} role="menu" aria-label="Options de colonne" className="fixed z-[70] w-56 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-xl" style={{ left: menuColonne.x, top: menuColonne.y }}>
        <button type="button" role="menuitem" onClick={() => masquerColonne(menuColonne.colonne)} className="block min-h-9 w-full rounded px-2 text-left font-medium text-gray-700 hover:bg-gray-50">Masquer cette colonne</button>
        {colonnesMasquees.size > 0 && <div className="mt-1 border-t pt-1"><p className="px-2 py-1 text-xs font-semibold text-gray-500">Réafficher une colonne</p>{colonnesMasquables.filter((colonne) => colonnesMasquees.has(colonne.id)).map((colonne) => <button key={colonne.id} type="button" role="menuitem" onClick={() => reafficherColonne(colonne.id)} className="block min-h-9 w-full rounded px-2 text-left text-gray-700 hover:bg-gray-50">{colonne.label}</button>)}<button type="button" role="menuitem" onClick={() => { setColonnesMasquees(new Set()); setMenuColonne(null); }} className="mt-1 block min-h-9 w-full rounded border-t px-2 text-left font-semibold text-gray-700 hover:bg-gray-50">Réafficher toutes les colonnes</button></div>}
      </div>}

      {colonnesMenuOuvert && <div className="vaccin-print-hidden fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Colonnes" onMouseDown={(event) => { if (event.target === event.currentTarget) setColonnesMenuOuvert(false); }}>
        <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl">
          <h2 className="font-black text-gray-900">Colonnes animales</h2><p className="mt-1 text-xs text-gray-600">Le N° reste toujours visible.</p>
          <div className="mt-2">{colonnesMasquables.map((colonne) => <label key={colonne.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={!colonnesMasquees.has(colonne.id)} onChange={() => colonnesMasquees.has(colonne.id) ? reafficherColonne(colonne.id) : masquerColonne(colonne.id)} className="h-5 w-5 accent-green-700" />{colonne.label}</label>)}</div>
          <div className="mt-2 flex gap-2"><button type="button" onClick={() => setColonnesMasquees(new Set(colonnesMasquables.map((colonne) => colonne.id)))} className="min-h-11 flex-1 rounded-lg border px-2 text-sm font-semibold">N° seulement</button><button type="button" onClick={() => setColonnesMasquees(new Set())} className="min-h-11 flex-1 rounded-lg border px-2 text-sm font-semibold">Tout afficher</button></div>
          <button type="button" onClick={() => setColonnesMenuOuvert(false)} className="mt-3 min-h-11 w-full rounded-lg bg-green-800 font-bold text-white">Fermer</button>
        </div>
      </div>}

      {vaccinsMenuOuvert && <div className="vaccin-print-hidden fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Vaccins affichés" onMouseDown={(event) => { if (event.target === event.currentTarget) setVaccinsMenuOuvert(false); }}>
        <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="border-b p-3"><h2 className="font-black text-gray-900">Vaccins · {vaccinsMasques} masqué{vaccinsMasques > 1 ? "s" : ""}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold"><button type="button" onClick={() => setVaccinModes(Object.fromEntries(blocs.map((bloc) => [bloc.cle, "OUVERT" as const])))} className="min-h-9 underline">Tout afficher</button><button type="button" onClick={() => setVaccinModes(Object.fromEntries(blocs.map((bloc) => [bloc.cle, "COMPACT" as const])))} className="min-h-9 underline">Tout réduire</button></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{blocs.map((bloc) => <div key={bloc.cle} className="border-b px-2 py-2"><p className="mb-1 break-words text-sm font-semibold">{bloc.nom}</p><div className="grid grid-cols-3 gap-1">{(["OUVERT", "COMPACT", "MASQUE"] as const).map((mode) => <button key={mode} type="button" onClick={() => changerModeVaccin(bloc.cle, mode)} aria-pressed={modeVaccin(bloc.cle) === mode} aria-label={`${mode === "OUVERT" ? "Afficher" : mode === "COMPACT" ? "Réduire" : "Masquer"} ${bloc.nom}`} className={`min-h-11 rounded border px-1 text-xs font-semibold ${modeVaccin(bloc.cle) === mode ? "border-green-800 bg-green-50 text-green-950" : "text-gray-700"}`}>{mode === "OUVERT" ? "Afficher" : mode === "COMPACT" ? "Réduire" : "Masquer"}</button>)}</div></div>)}</div>
          <div className="border-t p-3"><button type="button" onClick={() => setVaccinsMenuOuvert(false)} className="min-h-11 w-full rounded-lg bg-green-800 font-bold text-white">Fermer</button></div>
        </div>
      </div>}

      <p className="vaccin-print-hidden border-t px-3 py-2 text-xs text-gray-600">{resultat.length} animal(aux) · ✓ vert = acte réel · Gris = prévu / sans protocole · Jaune = bientôt · Orange = à faire · Rouge = en retard · Ambre = à rattacher.</p>
      </div>

      {donneesManquantes && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Informations vaccinales manquantes"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-lg font-black text-gray-900">Information nécessaire</h2><p className="mt-1 text-sm text-gray-600">Renseignez uniquement la voie absente avant l’enregistrement.</p>
        <div className="mt-4 space-y-3">{groupesSession.filter((groupe) => !ajustements[groupe.cle]?.voie.trim()).map((groupe) => { const administration = ajustements[groupe.cle] ?? { voie: "", dose: "", uniteDosage: "ml" }; return <label key={groupe.cle} className="block text-sm font-semibold text-gray-800">{groupe.etape.medicamentNom || groupe.bloc.nom} — {groupe.etape.label || "Injection"}<input autoFocus value={administration.voie} onChange={(event) => setAjustements((actuels) => ({ ...actuels, [groupe.cle]: { ...administration, voie: event.target.value } }))} placeholder="Voie d’administration" className="mt-1 min-h-10 w-full rounded-lg border px-3 font-normal" /></label>; })}</div>
        {erreur && <p className="mt-3 text-sm font-semibold text-red-700">{erreur}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={enregistrement} onClick={() => { setDonneesManquantes(false); setErreur(""); }} className="min-h-11 rounded-lg border font-semibold text-gray-700 disabled:opacity-50">Annuler</button><button type="button" disabled={enregistrement} onClick={() => void validerSession()} className="min-h-11 rounded-lg bg-green-800 font-bold text-white disabled:opacity-50">{enregistrement ? "Enregistrement…" : "Enregistrer"}</button></div>
      </div></div>}

      {renduPanneauHistorique()}
      {renduPanneauSoin()}
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
          #tableau-vaccinal-impression .vaccin-table-scroll { max-height: calc(100dvh - 12rem); }
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
