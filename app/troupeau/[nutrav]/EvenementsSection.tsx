"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, Pencil, Settings2, Pill, Plus, Clock, AlertTriangle, ScanLine, Loader2 } from "lucide-react";
import { addDays } from "date-fns";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { getAttenteInfo, doitAfficherViande, doitAfficherLait } from "@/lib/withdrawal";
import { getCategorieLabel } from "@/lib/evenements-sanitaires";
import EvenementEditPanel from "./EvenementEditPanel";
import TraitementForm from "./TraitementForm";
import { scanAndPersistOrdonnance } from "@/lib/scan-ordonnance-client";
import ConfirmDeleteButton from "@/app/components/ConfirmDeleteButton";

export interface TraitementRow {
  id: string;
  medicamentNom: string;
  dateDebut: string;
  dureeJours: number;
  voie: string | null;
  frequence: string | null;
  dose: number | null;
  doseRecommandee: number | null;
  uniteDosage: string | null;
  poidsUtilise: number | null;
  motif: string | null;
  veterinaire: string | null;
  statut: string;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  ordonnanceNumero: string | null;
  ordonnanceId: string | null;
  ordonnanceAAssocier: boolean;
}

export interface ReponseRow {
  id: string;
  questionId: string;
  libelleEnregistre: string;
  valeur: string;
  questionType: string;
}

export interface EvenementRow {
  id: string;
  type: string;
  categorie: string | null;
  date: Date;
  moment: string | null;
  temperature: number | null;
  description: string | null;
  photos: string | null;
  constatePar: string | null;
  resolu: boolean;
  symptomes: { id: string; libelle: string; typeEvenementId: string | null }[];
  reponses: ReponseRow[];
  traitements: TraitementRow[];
}

interface ScanResult {
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  dureeJours: number | null;
  dateDebut: string | null;
  veterinaire: string | null;
  motif: string | null;
  ordonnanceNumero: string | null;
}

function formatValeur(r: ReponseRow): string {
  try {
    const v = JSON.parse(r.valeur);
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  } catch {
    return r.valeur;
  }
}

function TraitementCard({ t, affichageDelaiAttente, onTerminer, nested }: {
  t: TraitementRow;
  affichageDelaiAttente?: string;
  onTerminer: (id: string) => void;
  nested?: boolean;
}) {
  const now = new Date();
  const dateDebut = new Date(t.dateDebut);
  const dateFin = addDays(dateDebut, t.dureeJours);
  const enCours = now < dateFin && t.statut === "EN_COURS";
  const attente = getAttenteInfo(dateFin, t.delaiAttenteViandeJ, t.delaiAttenteLaitJ, now);
  const dateFinAttenteViande = attente.dateFinAttenteViande;
  const dateFinAttenteLait = attente.dateFinAttenteLait;
  const enAttente = attente.enAttenteViande && doitAfficherViande(affichageDelaiAttente);
  const enAttenteLait = attente.enAttenteLait && doitAfficherLait(affichageDelaiAttente);

  return (
    <div className={`border rounded-lg p-3 text-sm ${nested ? "bg-white" : ""} ${
      enCours ? "border-blue-200 bg-blue-50" : enAttente ? "border-orange-200 bg-orange-50" : "border-gray-100"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {nested && <Pill size={12} className="text-blue-400 shrink-0" />}
            <span className="font-medium text-gray-800">{t.medicamentNom}</span>
            {t.voie && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.voie}</span>}
            {t.frequence && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.frequence}</span>}
            {t.dose != null && (
              <span className="text-xs text-gray-500">
                {t.dose} {t.uniteDosage ?? "ml"}
                {t.doseRecommandee != null && t.doseRecommandee !== t.dose && (
                  <span className="text-gray-400"> (reco. {t.doseRecommandee})</span>
                )}
              </span>
            )}
          </div>
          {t.motif && <div className="text-xs text-gray-500 mt-0.5">{t.motif}</div>}
          <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
            <span>Du {formatDate(dateDebut)} — {t.dureeJours}j</span>
            {t.veterinaire && <span>Vét. {t.veterinaire}</span>}
            {t.ordonnanceNumero && (
              t.ordonnanceId ? (
                <Link href={`/ordonnances/${t.ordonnanceId}`} className="text-blue-600 hover:underline">
                  N° ordonnance : {t.ordonnanceNumero}
                </Link>
              ) : (
                <span>N° ordonnance : {t.ordonnanceNumero}</span>
              )
            )}
            {!t.ordonnanceNumero && t.ordonnanceAAssocier && (
              <span className="flex items-center gap-1 text-orange-600 font-medium">
                <AlertTriangle size={10} /> Ordonnance à associer
              </span>
            )}
            {enCours && (
              <span className="flex items-center gap-1 text-blue-600">
                <Clock size={10} /> jusqu&apos;au {formatDate(dateFin)}
              </span>
            )}
            {enAttente && dateFinAttenteViande && (
              <span className="flex items-center gap-1 text-orange-600 font-medium">
                <AlertTriangle size={10} /> Attente viande jusqu&apos;au {formatDate(dateFinAttenteViande)}
              </span>
            )}
            {enAttenteLait && dateFinAttenteLait && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <AlertTriangle size={10} /> Attente lait jusqu&apos;au {formatDate(dateFinAttenteLait)}
              </span>
            )}
            {!enCours && !enAttente && t.statut !== "EN_COURS" && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 size={10} /> Terminé
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {t.statut === "EN_COURS" && (
            <button onClick={() => onTerminer(t.id)}
              className="text-xs px-2 py-1 text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100">
              Terminer
            </button>
          )}
          <ConfirmDeleteButton url={`/api/traitements/${t.id}`} confirmMessage="Confirmer la suppression de ce traitement ?" />
        </div>
      </div>
    </div>
  );
}

function EvenementCard({ animalId, evt, affichageDelaiAttente, onTerminer }: {
  animalId: string;
  evt: EvenementRow;
  affichageDelaiAttente?: string;
  onTerminer: (id: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [detailsOuvert, setDetailsOuvert] = useState(false);
  const [editTemp, setEditTemp] = useState(false);
  const [tempValue, setTempValue] = useState(evt.temperature != null ? String(evt.temperature) : "");
  const [editionOuverte, setEditionOuverte] = useState(false);
  const [ajoutTraitementOuvert, setAjoutTraitementOuvert] = useState(false);

  async function toggleResolu() {
    setLoading(true);
    try {
      await fetch(`/api/evenements/${evt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolu: !evt.resolu }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function enregistrerTemp() {
    setLoading(true);
    try {
      await fetch(`/api/evenements/${evt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: tempValue !== "" ? Number(tempValue) : null }),
      });
      setEditTemp(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium">{evt.type}</span>
            {evt.categorie && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {getCategorieLabel(evt.categorie)}
              </span>
            )}
            {editTemp ? (
              <span className="flex items-center gap-1">
                <input
                  type="number" step="0.1" autoFocus value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") enregistrerTemp(); }}
                  className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs"
                />
                <button onClick={enregistrerTemp} className="text-xs text-blue-600">OK</button>
              </span>
            ) : (
              <button onClick={() => setEditTemp(true)} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full hover:bg-orange-100">
                {evt.temperature != null ? `${evt.temperature}°C` : <><Pencil size={9} /> température</>}
              </button>
            )}
          </div>
          {evt.symptomes.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {evt.symptomes.map((s) => (
                <span key={s.libelle} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {s.libelle}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-0.5">
            {formatDate(evt.date)}{evt.moment ? ` — ${evt.moment}` : ""}
            {evt.constatePar ? ` · Constaté par ${evt.constatePar}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              evt.resolu ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
          >
            {evt.resolu ? "Résolu" : "En cours"}
          </span>
          <ConfirmDeleteButton url={`/api/evenements/${evt.id}`} />
        </div>
      </div>

      {evt.description && (
        <div className="text-xs text-gray-500 mt-1">{evt.description}</div>
      )}
      {evt.photos && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={evt.photos} alt={evt.type} className="mt-2 h-20 rounded-lg border border-gray-200 object-cover" />
      )}

      {evt.reponses.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setDetailsOuvert((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ChevronDown size={12} className={`transition-transform ${detailsOuvert ? "rotate-180" : ""}`} />
            Précisions ({evt.reponses.length})
          </button>
          {detailsOuvert && (
            <div className="mt-1.5 bg-gray-50 rounded-lg p-2 space-y-1">
              {evt.reponses.map((r) => (
                <div key={r.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className="text-gray-400">{r.libelleEnregistre}</span>
                  <span className="font-medium">{formatValeur(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {evt.traitements.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {evt.traitements.map((t) => (
            <TraitementCard key={t.id} t={t} affichageDelaiAttente={affichageDelaiAttente} onTerminer={onTerminer} nested />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          onClick={toggleResolu}
          disabled={loading}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <CheckCircle2 size={12} />
          {evt.resolu ? "Marquer non résolu" : "Marquer résolu"}
        </button>
        <button
          onClick={() => setAjoutTraitementOuvert((v) => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          <Pill size={12} />
          {ajoutTraitementOuvert ? "Fermer" : "Médicament"}
        </button>
        <button
          onClick={() => setEditionOuverte((v) => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Settings2 size={12} />
          {editionOuverte ? "Fermer" : "Modifier"}
        </button>
      </div>

      {ajoutTraitementOuvert && (
        <div className="mt-2">
          <TraitementForm
            animalId={animalId}
            evenementId={evt.id}
            onClose={() => setAjoutTraitementOuvert(false)}
          />
        </div>
      )}

      {editionOuverte && (
        <EvenementEditPanel
          evenementId={evt.id}
          symptomes={evt.symptomes}
          reponses={evt.reponses.map((r) => ({ questionId: r.questionId, valeur: r.valeur }))}
          onClose={() => setEditionOuverte(false)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

interface Props {
  animalId: string;
  evenements: EvenementRow[];
  traitementsOrphelins: TraitementRow[];
  affichageDelaiAttente?: string;
}

export default function EvenementsSection({ animalId, evenements, traitementsOrphelins, affichageDelaiAttente }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanResult | undefined>();
  const [pendingOrdonnanceId, setPendingOrdonnanceId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setScanning(true);
    try {
      const { ordonnanceId, extracted } = await scanAndPersistOrdonnance(file);
      setPendingScan(extracted);
      setPendingOrdonnanceId(ordonnanceId);
      setShowForm(true);
    } finally {
      setScanning(false);
    }
  }

  async function terminer(id: string) {
    await fetch(`/api/traitements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "TERMINE" }),
    });
    router.refresh();
  }

  type Item =
    | { kind: "evenement"; date: number; evt: EvenementRow }
    | { kind: "traitement"; date: number; t: TraitementRow };

  const items: Item[] = [
    ...evenements.map((evt): Item => ({ kind: "evenement", date: evt.date.getTime(), evt })),
    ...traitementsOrphelins.map((t): Item => ({ kind: "traitement", date: new Date(t.dateDebut).getTime(), t })),
  ].sort((a, b) => b.date - a.date);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          Événements
          {items.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{items.length}</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            title="Scanner une ordonnance (photo ou PDF)"
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
            {scanning ? "Scan..." : "Scanner"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFilePick} />
          <button onClick={() => { setShowForm((v) => !v); setPendingScan(undefined); setPendingOrdonnanceId(null); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={13} /> Traitement
          </button>
        </div>
      </div>

      {showForm && (
        <TraitementForm
          animalId={animalId}
          onClose={() => { setShowForm(false); setPendingScan(undefined); setPendingOrdonnanceId(null); }}
          initialScan={pendingScan}
          initialOrdonnanceId={pendingOrdonnanceId}
        />
      )}

      {items.length === 0 && !showForm ? (
        <div className="text-center py-6 text-gray-400 text-sm">Aucun événement enregistré</div>
      ) : (
        <div className="space-y-2 mt-2">
          {items.map((item) =>
            item.kind === "evenement" ? (
              <EvenementCard key={`e-${item.evt.id}`} animalId={animalId} evt={item.evt} affichageDelaiAttente={affichageDelaiAttente} onTerminer={terminer} />
            ) : (
              <TraitementCard key={`t-${item.t.id}`} t={item.t} affichageDelaiAttente={affichageDelaiAttente} onTerminer={terminer} />
            )
          )}
        </div>
      )}
    </div>
  );
}
