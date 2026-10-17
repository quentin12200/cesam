"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { classeStatutVaccinal, formatTempsAvantVelage } from "@/lib/vaccine-table-presentation";
import {
  cleJourCalendrier,
  construireJoursCalendrier,
  dateAffichageActionAgenda,
  formatDateAgenda,
  libelleFenetreVaccinale,
  regrouperActionsAgenda,
  type ActionAgenda,
  type GroupeAgenda,
  type StatutAgenda,
} from "@/lib/vaccine-agenda";

interface ActeAgenda {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  date: string;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
}

interface LigneAgenda {
  animalId: string;
  nutrav: string;
  nom: string | null;
  mereNutrav: string | null;
  mereNom: string | null;
  dateVelagePrevueIso: string | null;
  actes: ActeAgenda[];
}

interface BlocAgenda {
  cle: string;
  nom: string;
  medicamentId: string | null;
  sousColonnes: { id: string; label: string; medicamentId: string | null }[];
}

interface EvenementPrevu {
  type: "PREVU";
  cle: string;
  dateJour: string;
  statut: StatutAgenda;
  vaccin: string;
  etape: string;
  groupe: GroupeAgenda;
}

interface EvenementFait {
  type: "FAIT";
  cle: string;
  dateJour: string;
  statut: "FAIT";
  vaccin: string;
  etape: string;
  date: string;
  animaux: LigneAgenda[];
}

type EvenementCalendrier = EvenementPrevu | EvenementFait;
type FiltreAgenda = "PREVOIR" | "FAITS" | "DEUX";

const joursSemaine = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const titreMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const libelleStatut: Record<StatutAgenda | "FAIT", string> = {
  EN_RETARD: "En retard", A_FAIRE: "À faire", BIENTOT: "Bientôt", PREVU: "Prévu", FAIT: "Fait",
};

function nombreAnimaux(evenement: EvenementCalendrier): number {
  return evenement.type === "PREVU" ? evenement.groupe.actions.length : evenement.animaux.length;
}

function DetailsEvenement({ evenement, lignes, blocs, onPreparer, onFermer }: {
  evenement: EvenementCalendrier;
  lignes: Map<string, LigneAgenda>;
  blocs: BlocAgenda[];
  onPreparer: (groupe: GroupeAgenda) => void;
  onFermer: () => void;
}) {
  const premiereEtape = evenement.type === "PREVU" && evenement.groupe.actions[0]?.typeEtape !== "ENTRETIEN" && blocs.some((bloc) => bloc.sousColonnes[0]?.id === evenement.groupe.actions[0]?.etapeId);
  const libelle = evenement.type === "PREVU" ? libelleFenetreVaccinale(evenement.statut, evenement.groupe.dateMin, evenement.groupe.dateMax, premiereEtape) : null;
  const animaux = evenement.type === "PREVU"
    ? evenement.groupe.actions.map((action) => ({ action, ligne: lignes.get(action.animalId) }))
    : evenement.animaux.map((ligne) => ({ action: null, ligne }));

  return <div>
    <button type="button" onClick={onFermer} className="mb-2 min-h-9 text-sm font-semibold text-green-800 underline">← Retour au jour</button>
    <p className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${classeStatutVaccinal[evenement.statut]}`}>{libelleStatut[evenement.statut]}</p>
    <h2 className="mt-2 text-lg font-black text-gray-950">{evenement.vaccin} — {evenement.etape}</h2>
    <p className="text-sm text-gray-600">{nombreAnimaux(evenement)} animal(aux){evenement.type === "PREVU" && libelle ? ` · ${[libelle.statut, libelle.date].filter(Boolean).join(" · ")}` : evenement.type === "FAIT" ? ` · fait le ${formatDateAgenda(evenement.date)}` : ""}</p>
    <ul className="mt-3 max-h-[50vh] divide-y overflow-y-auto border-y">
      {animaux.map(({ action, ligne }) => ligne && <li key={ligne.animalId} className="py-2 text-sm">
        <p><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-black text-green-800 underline">{ligne.nutrav}</Link>{ligne.nom ? ` ${ligne.nom}` : ""}</p>
        {action && <><p className="text-xs text-gray-600">Mère {ligne.mereNutrav ?? "—"}{ligne.mereNom ? ` ${ligne.mereNom}` : ""} · Avant vêlage {action.dateVelageReference ? formatTempsAvantVelage(action.dateVelageReference) : "—"}</p><p className="text-xs text-gray-600">Fenêtre {formatDateAgenda(action.dateMin)} → {formatDateAgenda(action.dateMax)}</p></>}
      </li>)}
    </ul>
    {evenement.type === "PREVU" && <button type="button" onClick={() => onPreparer(evenement.groupe)} className="mt-4 min-h-11 w-full rounded-lg bg-green-800 px-4 font-bold text-white">Préparer cette action</button>}
  </div>;
}

export default function CalendrierVaccinal({ actions, lignes, blocs, anneesFiltre, onPreparer }: {
  actions: ActionAgenda[];
  lignes: LigneAgenda[];
  blocs: BlocAgenda[];
  anneesFiltre: Set<number> | null;
  onPreparer: (groupe: GroupeAgenda) => void;
}) {
  const [filtre, setFiltre] = useState<FiltreAgenda>("PREVOIR");
  const [moisAffiche, setMoisAffiche] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1, 12); });
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);
  const [evenementOuvert, setEvenementOuvert] = useState<string | null>(null);
  const aujourdHui = useMemo(() => new Date(), []);
  const cleAujourdhui = cleJourCalendrier(aujourdHui);
  const indexLignes = useMemo(() => new Map(lignes.map((ligne) => [ligne.animalId, ligne])), [lignes]);
  const jours = useMemo(() => construireJoursCalendrier(moisAffiche), [moisAffiche]);
  const groupesPrevus = useMemo(() => regrouperActionsAgenda(actions), [actions]);

  useEffect(() => {
    function fermerSurEchap(event: KeyboardEvent) {
      if (event.key === "Escape") { setJourOuvert(null); setEvenementOuvert(null); }
    }
    window.addEventListener("keydown", fermerSurEchap);
    return () => window.removeEventListener("keydown", fermerSurEchap);
  }, []);

  const faits = useMemo<EvenementFait[]>(() => {
    const etapes = new Map(blocs.flatMap((bloc) => bloc.sousColonnes.map((etape) => [etape.id, { bloc, etape }] as const)));
    const groupes = new Map<string, EvenementFait>();
    for (const ligne of lignes) {
      for (const acte of ligne.actes) {
        const date = new Date(acte.date);
        if (anneesFiltre && !anneesFiltre.has(date.getFullYear())) continue;
        const rattachement = acte.etapeProtocoleId ? etapes.get(acte.etapeProtocoleId) : null;
        const vaccin = rattachement?.bloc.nom ?? acte.vaccin;
        const etape = rattachement?.etape.label ?? "Injection";
        const dateJour = cleJourCalendrier(date);
        const cle = `${dateJour}|${acte.medicamentId ?? vaccin}|${etape}`;
        const groupe = groupes.get(cle);
        if (groupe) {
          if (!groupe.animaux.some((animal) => animal.animalId === ligne.animalId)) groupe.animaux.push(ligne);
        } else {
          groupes.set(cle, { type: "FAIT", cle, dateJour, statut: "FAIT", vaccin, etape, date: acte.date, animaux: [ligne] });
        }
      }
    }
    return [...groupes.values()];
  }, [anneesFiltre, blocs, lignes]);

  const evenements = useMemo<EvenementCalendrier[]>(() => {
    const prevus: EvenementPrevu[] = groupesPrevus.map((groupe) => ({ type: "PREVU", cle: `prevu|${groupe.cle}`, dateJour: dateAffichageActionAgenda(groupe, aujourdHui), statut: groupe.statut, vaccin: groupe.medicamentNom, etape: groupe.etapeLabel || "Injection", groupe }));
    if (filtre === "PREVOIR") return prevus;
    if (filtre === "FAITS") return faits;
    return [...prevus, ...faits];
  }, [aujourdHui, faits, filtre, groupesPrevus]);

  const evenementsParJour = useMemo(() => {
    const index = new Map<string, EvenementCalendrier[]>();
    for (const evenement of evenements) {
      const liste = index.get(evenement.dateJour) ?? [];
      liste.push(evenement);
      index.set(evenement.dateJour, liste);
    }
    return index;
  }, [evenements]);

  const evenementsJour = jourOuvert ? evenementsParJour.get(jourOuvert) ?? [] : [];
  const evenementDetail = evenementOuvert ? evenements.find((evenement) => evenement.cle === evenementOuvert) ?? null : null;

  function changerMois(ecart: number) {
    setMoisAffiche((actuel) => new Date(actuel.getFullYear(), actuel.getMonth() + ecart, 1, 12));
    setJourOuvert(null); setEvenementOuvert(null);
  }

  function revenirAujourdhui() {
    setMoisAffiche(new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1, 12));
    setJourOuvert(cleAujourdhui); setEvenementOuvert(null);
  }

  return <div className="border-t bg-gray-50 p-2 sm:p-3">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1"><button type="button" onClick={() => changerMois(-1)} aria-label="Mois précédent" className="min-h-10 min-w-10 rounded-lg border bg-white text-xl font-bold">‹</button><button type="button" onClick={revenirAujourdhui} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold">Aujourd’hui</button><button type="button" onClick={() => changerMois(1)} aria-label="Mois suivant" className="min-h-10 min-w-10 rounded-lg border bg-white text-xl font-bold">›</button></div>
      <h2 className="min-w-48 flex-1 text-center text-lg font-black capitalize text-gray-950">{titreMois.format(moisAffiche)}</h2>
      <div className="inline-flex rounded-lg border bg-white p-1 text-sm font-semibold">{([['PREVOIR', 'À prévoir'], ['FAITS', 'Faits'], ['DEUX', 'Les deux']] as const).map(([valeur, label]) => <button key={valeur} type="button" aria-pressed={filtre === valeur} onClick={() => setFiltre(valeur)} className={`min-h-8 rounded-md px-2 sm:px-3 ${filtre === valeur ? "bg-green-800 text-white" : "text-gray-700"}`}>{label}</button>)}</div>
    </div>

    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><div className="min-w-[720px]">
      <div className="grid grid-cols-7 border-b bg-gray-100">{joursSemaine.map((jour) => <div key={jour} className="p-2 text-center text-xs font-black uppercase tracking-wide text-gray-600">{jour}</div>)}</div>
      <div className="grid grid-cols-7">{jours.map((jour) => {
        const duJour = evenementsParJour.get(jour.cle) ?? [];
        const visible = duJour.slice(0, 3);
        return <div key={jour.cle} onClick={() => { setJourOuvert(jour.cle); setEvenementOuvert(null); }} className={`min-h-28 cursor-pointer border-b border-r p-1.5 text-left align-top hover:bg-green-50 ${jour.dansMois ? "bg-white" : "bg-gray-50 text-gray-400"} ${jour.cle === cleAujourdhui ? "ring-2 ring-inset ring-green-700" : ""}`}>
          <button type="button" onClick={() => { setJourOuvert(jour.cle); setEvenementOuvert(null); }} aria-label={`Voir le ${dateLongue.format(jour.date)}`} className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${jour.cle === cleAujourdhui ? "bg-green-800 text-white" : ""}`}>{jour.date.getDate()}</button>
          <div className="space-y-1">{visible.map((evenement) => <button key={evenement.cle} type="button" aria-label={`${evenement.vaccin}, ${evenement.etape}, ${nombreAnimaux(evenement)} animaux, ${libelleStatut[evenement.statut]}`} onClick={(event) => { event.stopPropagation(); setJourOuvert(jour.cle); setEvenementOuvert(evenement.cle); }} className={`block w-full rounded border px-1 py-0.5 text-left text-[10px] font-bold leading-tight ${classeStatutVaccinal[evenement.statut]}`}><span className="block truncate">{evenement.vaccin}</span><span className="block truncate font-medium">{evenement.etape} · {nombreAnimaux(evenement)}</span></button>)}{duJour.length > visible.length && <button type="button" onClick={(event) => { event.stopPropagation(); setJourOuvert(jour.cle); setEvenementOuvert(null); }} className="block px-1 text-[10px] font-black text-gray-600">+{duJour.length - visible.length}</button>}</div>
        </div>;
      })}</div>
    </div></div>

    {jourOuvert && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="Détail du calendrier vaccinal" onMouseDown={(event) => { if (event.currentTarget === event.target) { setJourOuvert(null); setEvenementOuvert(null); } }}><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
      {evenementDetail ? <DetailsEvenement evenement={evenementDetail} lignes={indexLignes} blocs={blocs} onPreparer={onPreparer} onFermer={() => setEvenementOuvert(null)} /> : <><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h2 className="text-lg font-black capitalize text-gray-950">{dateLongue.format(new Date(`${jourOuvert}T12:00:00`))}</h2><p className="text-sm text-gray-600">{evenementsJour.length} action(s) vaccinale(s)</p></div><button type="button" onClick={() => setJourOuvert(null)} aria-label="Fermer" className="min-h-10 min-w-10 rounded-lg border text-xl">×</button></div><div className="mt-4 space-y-2">{evenementsJour.map((evenement) => <button key={evenement.cle} type="button" onClick={() => setEvenementOuvert(evenement.cle)} className={`w-full rounded-xl border p-3 text-left ${classeStatutVaccinal[evenement.statut]}`}><span className="block font-black">{evenement.vaccin} — {evenement.etape}</span><span className="block text-sm">{nombreAnimaux(evenement)} animal(aux) · {libelleStatut[evenement.statut]}</span></button>)}{evenementsJour.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">Aucune action vaccinale ce jour.</p>}</div></>}
    </div></div>}
  </div>;
}
