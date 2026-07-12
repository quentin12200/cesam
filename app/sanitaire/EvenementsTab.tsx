"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, History, AlertTriangle, AlertCircle, Clock, Pill } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface EvenementItem {
  id: string;
  animalNutrav: string;
  animalNom: string | null;
  type: string;
  symptomes: string[];
  date: string;
  description: string | null;
  resolu: boolean;
}

export interface TraitementItem {
  id: string;
  animalNutrav: string;
  animalNom: string | null;
  medicamentNom: string;
  medicamentId: string | null;
  dateDebut: string;
  dateFin: string;
  dureeJours: number;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  motif: string | null;
  veterinaire: string | null;
  statut: string;
  notes: string | null;
  delaiAttenteViandeJ: number | null;
  dateFinAttente: string | null;
  enCours: boolean;
  enAttente: boolean;
  joursRestantsAttente: number | null;
}

function EvenementRow({ e, muted }: { e: EvenementItem; muted?: boolean }) {
  return (
    <Link
      href={`/troupeau/${e.animalNutrav}?onglet=sante`}
      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
        muted ? "bg-gray-50 border-gray-100 opacity-75 hover:bg-gray-100" : "bg-red-50 border-red-100 hover:bg-red-100"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{e.animalNutrav}</span>
          <span className="text-sm font-medium text-gray-800">{e.animalNom ?? ""}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${muted ? "text-gray-600 bg-gray-200" : "text-red-700 bg-red-100"}`}>
            {e.symptomes.length > 1 ? e.symptomes.join(" • ") : e.type}
          </span>
        </div>
        {e.description && (
          <p className="text-xs text-gray-600 mt-1 truncate">{e.description}</p>
        )}
      </div>
      <span className="text-xs text-gray-400 shrink-0">
        {new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
      </span>
    </Link>
  );
}

function TraitementRow({ t, onTerminer }: { t: TraitementItem; onTerminer: (id: string) => void }) {
  return (
    <div className={`bg-white rounded-xl shadow border p-4 border-l-4 ${
      t.enCours ? "border-blue-400" : t.joursRestantsAttente && t.joursRestantsAttente > 0 ? "border-orange-400" : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/troupeau/${t.animalNutrav}`}
              className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 transition-colors">
              {t.animalNutrav}
            </Link>
            {t.animalNom && <span className="text-sm font-semibold text-gray-800">{t.animalNom}</span>}
          </div>

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{t.medicamentNom}</span>
            {t.voie && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.voie}</span>}
            {t.dose != null && (
              <span className="text-xs text-gray-500">{t.dose} {t.uniteDosage ?? "ml"}</span>
            )}
          </div>

          {t.motif && <div className="text-xs text-gray-500 mt-1">Motif : {t.motif}</div>}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {t.enCours && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                <Clock size={11} /> Traitement jusqu&apos;au {formatDate(new Date(t.dateFin))}
              </span>
            )}
            {t.enAttente && t.joursRestantsAttente != null && t.joursRestantsAttente > 0 && (
              <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium">
                <AlertTriangle size={11} /> Attente viande : {t.joursRestantsAttente}j restants
              </span>
            )}
          </div>

          {t.veterinaire && <div className="text-xs text-gray-400 mt-1">Vét. : {t.veterinaire}</div>}
        </div>

        {t.statut === "EN_COURS" && (
          <button onClick={() => onTerminer(t.id)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
            <CheckCircle2 size={13} /> Terminer
          </button>
        )}
      </div>
    </div>
  );
}

function TraitementRowMuted({ t }: { t: TraitementItem }) {
  return (
    <div className="bg-white rounded-xl shadow border p-3 opacity-75">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/troupeau/${t.animalNutrav}`}
          className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100">
          {t.animalNutrav}
        </Link>
        {t.animalNom && <span className="text-sm font-medium text-gray-700">{t.animalNom}</span>}
        <span className="text-sm text-gray-600">{t.medicamentNom}</span>
        <span className="ml-auto text-xs text-gray-400">{formatDate(new Date(t.dateDebut))}</span>
      </div>
      {t.motif && <div className="text-xs text-gray-400 mt-0.5">{t.motif}</div>}
    </div>
  );
}

function EnCoursTab({ evenements, traitements, onRefresh }: { evenements: EvenementItem[]; traitements: TraitementItem[]; onRefresh: () => void }) {
  const router = useRouter();
  const evtsEnCours = evenements.filter((e) => !e.resolu);
  const trtEnCours = traitements.filter((t) => t.enCours || t.enAttente);

  async function terminer(id: string) {
    await fetch(`/api/traitements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "TERMINE" }),
    });
    onRefresh();
    router.refresh();
  }

  if (evtsEnCours.length === 0 && trtEnCours.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircle2 size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun événement ni traitement en cours</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evtsEnCours.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
            <AlertCircle size={15} className="text-red-500" />
            Événements non résolus ({evtsEnCours.length})
          </h3>
          <div className="space-y-2">
            {evtsEnCours.map((e) => <EvenementRow key={e.id} e={e} />)}
          </div>
        </div>
      )}

      {trtEnCours.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm px-1">
            <Pill size={15} className="text-blue-500" />
            Traitements en cours ({trtEnCours.length})
          </h3>
          <div className="space-y-3">
            {trtEnCours.map((t) => <TraitementRow key={t.id} t={t} onTerminer={terminer} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoriqueTab({ evenements, traitements }: { evenements: EvenementItem[]; traitements: TraitementItem[] }) {
  const evtsResolus = evenements.filter((e) => e.resolu);
  const trtTermines = traitements.filter((t) => !t.enCours && !t.enAttente);

  if (evtsResolus.length === 0 && trtTermines.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <History size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun historique</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evtsResolus.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm px-1">
            <AlertCircle size={15} className="text-gray-400" />
            Événements résolus ({evtsResolus.length})
          </h3>
          <div className="space-y-2">
            {evtsResolus.map((e) => <EvenementRow key={e.id} e={e} muted />)}
          </div>
        </div>
      )}

      {trtTermines.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm px-1">
            <Pill size={15} className="text-gray-400" />
            Traitements terminés ({trtTermines.length})
          </h3>
          <div className="space-y-2">
            {trtTermines.map((t) => <TraitementRowMuted key={t.id} t={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvenementsTab({ evenements, traitements }: { evenements: EvenementItem[]; traitements: TraitementItem[] }) {
  const [onglet, setOnglet] = useState<"encours" | "historique">("encours");
  const [, forceRefresh] = useState(0);

  const enCoursCount = evenements.filter((e) => !e.resolu).length + traitements.filter((t) => t.enCours || t.enAttente).length;
  const attenteCount = traitements.filter((t) => t.enAttente && t.joursRestantsAttente && t.joursRestantsAttente > 0).length;
  const historiqueCount = evenements.filter((e) => e.resolu).length + traitements.filter((t) => !t.enCours && !t.enAttente).length;

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {([
          ["encours", "En cours", enCoursCount, attenteCount > 0],
          ["historique", "Historique", historiqueCount, false],
        ] as const).map(([id, label, count, alert]) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                alert ? "bg-orange-500 text-white" : onglet === id ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {onglet === "encours" && <EnCoursTab evenements={evenements} traitements={traitements} onRefresh={() => forceRefresh((n) => n + 1)} />}
      {onglet === "historique" && <HistoriqueTab evenements={evenements} traitements={traitements} />}
    </div>
  );
}
