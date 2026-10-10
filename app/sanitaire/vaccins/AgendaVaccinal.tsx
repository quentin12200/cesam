"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTempsAvantVelage } from "@/lib/vaccine-table-presentation";
import { formatDateAgenda, libelleFenetreVaccinale, regrouperActionsAgenda, semaineDu, type ActionAgenda, type GroupeAgenda, type StatutAgenda } from "@/lib/vaccine-agenda";

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

type FiltreAgenda = "PREVOIR" | "FAITS" | "DEUX";

const titreSection: Record<StatutAgenda, string> = {
  EN_RETARD: "En retard",
  A_FAIRE: "À faire maintenant",
  BIENTOT: "Bientôt",
  PREVU: "À venir",
};

const classeSection: Record<StatutAgenda, string> = {
  EN_RETARD: "border-red-300 bg-red-50",
  A_FAIRE: "border-yellow-300 bg-yellow-50",
  BIENTOT: "border-orange-300 bg-orange-50",
  PREVU: "border-slate-200 bg-slate-50",
};

function CarteAction({ groupe, lignes }: { groupe: GroupeAgenda; lignes: Map<string, LigneAgenda> }) {
  const libelle = libelleFenetreVaccinale(groupe.statut, groupe.dateMin, groupe.dateMax);
  return <details className={`rounded-xl border p-3 ${classeSection[groupe.statut]}`}>
    <summary className="cursor-pointer list-none">
      <p className="font-black text-gray-900">{groupe.medicamentNom} — {groupe.etapeLabel || "Injection"}</p>
      <p className="mt-0.5 text-sm text-gray-700">{groupe.actions.length} animal(aux) · {[libelle.statut, libelle.date].filter(Boolean).join(" · ")}</p>
    </summary>
    <ul className="mt-3 divide-y border-t">
      {groupe.actions.map((action) => {
        const ligne = lignes.get(action.animalId);
        return <li key={`${action.animalId}-${action.etapeId}`} className="py-2 text-sm">
          <p><Link href={`/troupeau/${action.nutrav}`} className="font-mono font-black text-green-800 underline">{action.nutrav}</Link>{action.nom ? ` ${action.nom}` : ""}</p>
          <p className="text-xs text-gray-600">Mère {ligne?.mereNutrav ?? "—"}{ligne?.mereNom ? ` ${ligne.mereNom}` : ""} · Avant vêlage {action.dateVelageReference ? formatTempsAvantVelage(action.dateVelageReference) : "—"}</p>
          <p className="text-xs text-gray-600">Fenêtre {formatDateAgenda(action.dateMin)} → {formatDateAgenda(action.dateMax)}</p>
        </li>;
      })}
    </ul>
  </details>;
}

export default function AgendaVaccinal({
  actions,
  lignes,
  blocs,
  anneesFiltre,
}: {
  actions: ActionAgenda[];
  lignes: LigneAgenda[];
  blocs: BlocAgenda[];
  anneesFiltre: Set<number> | null;
}) {
  const [filtre, setFiltre] = useState<FiltreAgenda>("PREVOIR");
  const indexLignes = useMemo(() => new Map(lignes.map((ligne) => [ligne.animalId, ligne])), [lignes]);
  const groupesPrevus = useMemo(() => regrouperActionsAgenda(actions), [actions]);
  const faits = useMemo(() => {
    const etapes = new Map(blocs.flatMap((bloc) => bloc.sousColonnes.map((etape) => [etape.id, { bloc, etape }] as const)));
    const groupes = new Map<string, { cle: string; date: string; vaccin: string; etape: string; animaux: LigneAgenda[] }>();
    for (const ligne of lignes) {
      for (const acte of ligne.actes) {
        const date = new Date(acte.date);
        if (anneesFiltre && !anneesFiltre.has(date.getFullYear())) continue;
        const rattachement = acte.etapeProtocoleId ? etapes.get(acte.etapeProtocoleId) : null;
        const vaccin = rattachement?.bloc.nom ?? acte.vaccin;
        const etape = rattachement?.etape.label ?? "Injection";
        const jour = acte.date.slice(0, 10);
        const cle = `${jour}|${acte.medicamentId ?? vaccin}|${etape}`;
        const groupe = groupes.get(cle);
        if (groupe) groupe.animaux.push(ligne);
        else groupes.set(cle, { cle, date: acte.date, vaccin, etape, animaux: [ligne] });
      }
    }
    return [...groupes.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [anneesFiltre, blocs, lignes]);

  return <div className="border-t p-3">
    <div className="mb-3 inline-flex rounded-lg border bg-white p-1 text-sm font-semibold">
      {([['PREVOIR', 'À prévoir'], ['FAITS', 'Faits'], ['DEUX', 'Les deux']] as const).map(([valeur, label]) => <button key={valeur} type="button" aria-pressed={filtre === valeur} onClick={() => setFiltre(valeur)} className={`min-h-9 rounded-md px-3 ${filtre === valeur ? "bg-green-800 text-white" : "text-gray-700"}`}>{label}</button>)}
    </div>

    {(filtre === "PREVOIR" || filtre === "DEUX") && <div className="space-y-5">
      {(["EN_RETARD", "A_FAIRE", "BIENTOT", "PREVU"] as const).map((statut) => {
        const groupes = groupesPrevus.filter((groupe) => groupe.statut === statut);
        if (groupes.length === 0) return null;
        let derniereSemaine = "";
        return <section key={statut}>
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-gray-800">{titreSection[statut]}</h2>
          <div className="space-y-2">{groupes.map((groupe) => {
            const semaine = statut === "PREVU" ? semaineDu(groupe.dateMin) : "";
            const afficherSemaine = semaine && semaine !== derniereSemaine;
            derniereSemaine = semaine || derniereSemaine;
            return <div key={groupe.cle}>{afficherSemaine && <h3 className="mb-1 mt-3 text-xs font-bold text-gray-500">{semaine}</h3>}<CarteAction groupe={groupe} lignes={indexLignes} /></div>;
          })}</div>
        </section>;
      })}
      {groupesPrevus.length === 0 && <p className="rounded-xl border p-4 text-sm text-gray-600">Aucune échéance vaccinale calculée.</p>}
    </div>}

    {(filtre === "FAITS" || filtre === "DEUX") && <section className={filtre === "DEUX" ? "mt-6 border-t pt-5" : ""}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-gray-800">Faits</h2>
      <div className="space-y-2">{faits.map((groupe) => <details key={groupe.cle} className="rounded-xl border border-green-200 bg-green-50 p-3"><summary className="cursor-pointer list-none"><p className="font-black text-gray-900">{new Intl.DateTimeFormat("fr-FR").format(new Date(groupe.date))} · {groupe.vaccin} — {groupe.etape}</p><p className="text-sm text-gray-700">{groupe.animaux.length} animal(aux) fait(s)</p></summary><ul className="mt-2 divide-y border-t">{groupe.animaux.map((ligne) => <li key={ligne.animalId} className="py-2 text-sm"><Link href={`/troupeau/${ligne.nutrav}`} className="font-mono font-black text-green-800 underline">{ligne.nutrav}</Link>{ligne.nom ? ` ${ligne.nom}` : ""}</li>)}</ul></details>)}</div>
      {faits.length === 0 && <p className="rounded-xl border p-4 text-sm text-gray-600">Aucun acte vaccinal réel pour les années affichées.</p>}
    </section>}
  </div>;
}
