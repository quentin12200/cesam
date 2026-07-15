"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, X, ScanLine, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { scanAndCreateExtraction } from "@/lib/scan-ordonnance-client";
import MedicamentPicker, {
  type MedicamentOption,
  type PreconisationOption,
} from "@/app/sanitaire/nouvel-evenement/MedicamentPicker";

type Medicament = MedicamentOption;

interface Props {
  animalId: string;
  evenementId?: string;
  onClose: () => void;
  initialScan?: ScanResult;
  initialOrdonnanceId?: string | null;
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

const today = new Date().toISOString().slice(0, 10);

export default function TraitementForm({ animalId, evenementId, onClose, initialScan, initialOrdonnanceId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [medicamentId, setMedicamentId] = useState("");
  const [dateDebut, setDateDebut] = useState(today);
  const [dureeJours, setDureeJours] = useState("3");
  const [voie, setVoie] = useState("");
  const [frequence, setFrequence] = useState("");
  const [dose, setDose] = useState("");
  const [doseRecommandee, setDoseRecommandee] = useState<number | null>(null);
  const [doseBase, setDoseBase] = useState("");
  const [uniteDosage, setUniteDosage] = useState("ml");
  const [motif, setMotif] = useState("");
  const [delaiAttenteViandeJ, setDelaiAttenteViandeJ] = useState<number | null>(null);
  const [delaiAttenteLaitJ, setDelaiAttenteLaitJ] = useState<number | null>(null);
  const [preconisationChargee, setPreconisationChargee] = useState(false);
  const [veterinaire, setVeterinaire] = useState("");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState("");
  const [ordonnanceId, setOrdonnanceId] = useState<string | null>(initialOrdonnanceId ?? null);
  const [ordonnanceAAssocier, setOrdonnanceAAssocier] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "ok" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");

  useEffect(() => {
    fetch("/api/medicaments")
      .then((r) => r.json())
      .then((data: Medicament[]) => {
        const active = data.filter((m) => (m as unknown as { actif: boolean }).actif);
        setMedicaments(active);
        if (initialScan) {
          applyScannedWithMeds(active, initialScan);
          setScanStatus("ok");
          setScanMsg("Ordonnance analysée — vérifiez les champs ci-dessous");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMed = medicaments.find((m) => m.id === medicamentId);

  function preconisationPrioritaire(medicament: Medicament): PreconisationOption | null {
    const rang: Record<string, number> = { VALIDE: 0, A_VERIFIER: 1, IMPORTE: 2 };
    return [...(medicament.preconisations ?? [])]
      .sort((a, b) => (rang[a.statut] ?? 9) - (rang[b.statut] ?? 9))[0] ?? null;
  }

  function convertirDureeEnJours(preconisation: PreconisationOption): string {
    if (preconisation.dureeValeur == null) return "3";
    const valeur = preconisation.dureeValeur;
    switch (preconisation.dureeUnite) {
      case "HEURE":
        return String(Math.max(1, Math.ceil(valeur / 24)));
      case "48H":
        return String(valeur * 2);
      case "SEMAINE":
        return String(valeur * 7);
      case "MOIS":
        return String(valeur * 30);
      default:
        return String(valeur);
    }
  }

  function appliquerMedicament(medicament: Medicament) {
    const preconisation = preconisationPrioritaire(medicament);
    setMedicamentId(medicament.id);
    setVoie(preconisation?.voie ?? medicament.voie ?? "");
    setFrequence(preconisation?.frequence ?? "");
    setDose(
      preconisation?.dose != null
        ? String(preconisation.dose)
        : medicament.dosagePourKg != null
          ? String(medicament.dosagePourKg)
          : ""
    );
    const doseProposee = preconisation?.dose ?? medicament.dosagePourKg ?? null;
    setDoseRecommandee(doseProposee);
    setDoseBase(preconisation?.doseBase ?? (medicament.dosagePourKg != null ? "KG" : ""));
    setUniteDosage(preconisation?.unite ?? medicament.uniteDosage ?? "ml");
    setDureeJours(preconisation ? convertirDureeEnJours(preconisation) : "3");
    setMotif(preconisation?.indicationMotif ?? "");
    setDelaiAttenteViandeJ(
      preconisation?.delaiAttenteViandeJ ?? medicament.delaiAttenteViandeJ ?? null
    );
    setDelaiAttenteLaitJ(
      preconisation?.delaiAttenteLaitTraites ?? medicament.delaiAttenteLaitJ ?? null
    );
    setPreconisationChargee(Boolean(preconisation));
  }

  function choisirMedicament(medicament: Medicament | null) {
    if (medicament) {
      appliquerMedicament(medicament);
      return;
    }
    setMedicamentId("");
    setVoie("");
    setFrequence("");
    setDose("");
    setDoseRecommandee(null);
    setDoseBase("");
    setUniteDosage("ml");
    setDureeJours("3");
    setMotif("");
    setDelaiAttenteViandeJ(null);
    setDelaiAttenteLaitJ(null);
    setPreconisationChargee(false);
  }

  function applyScannedWithMeds(meds: Medicament[], result: ScanResult) {
    if (result.medicamentNom) {
      const match = meds.find(
        (m) =>
          m.nom.toLowerCase().includes(result.medicamentNom!.toLowerCase()) ||
          result.medicamentNom!.toLowerCase().includes(m.nom.toLowerCase())
      );
      if (match) {
        appliquerMedicament(match);
      } else {
        setMedicamentId("");
      }
    }
    if (result.voie) setVoie(result.voie);
    if (result.dose != null) setDose(String(result.dose));
    if (result.uniteDosage) setUniteDosage(result.uniteDosage);
    if (result.dureeJours != null) setDureeJours(String(result.dureeJours));
    if (result.dateDebut) setDateDebut(result.dateDebut);
    if (result.veterinaire) setVeterinaire(result.veterinaire);
    if (result.motif) setMotif(result.motif);
    if (result.ordonnanceNumero) setOrdonnanceNumero(result.ordonnanceNumero);
  }

  const effectiveNom = selectedMed?.nom ?? "";

  function applyScanned(result: ScanResult) {
    if (result.medicamentNom) {
      // Try to match existing medicament
      const match = medicaments.find(
        (m) =>
          m.nom.toLowerCase().includes(result.medicamentNom!.toLowerCase()) ||
          result.medicamentNom!.toLowerCase().includes(m.nom.toLowerCase())
      );
      if (match) {
        appliquerMedicament(match);
      } else {
        setMedicamentId("");
      }
    }
    if (result.voie) setVoie(result.voie);
    if (result.dose != null) setDose(String(result.dose));
    if (result.uniteDosage) setUniteDosage(result.uniteDosage);
    if (result.dureeJours != null) setDureeJours(String(result.dureeJours));
    if (result.dateDebut) setDateDebut(result.dateDebut);
    if (result.veterinaire) setVeterinaire(result.veterinaire);
    if (result.motif) setMotif(result.motif);
    if (result.ordonnanceNumero) setOrdonnanceNumero(result.ordonnanceNumero);
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setScanning(true);
    setScanStatus("idle");
    setScanMsg("");

    try {
      const { extractionId } = await scanAndCreateExtraction([file]);
      router.push(`/ordonnances/a-verifier/${extractionId}`);
    } catch (err) {
      setScanStatus("error");
      setScanMsg(err instanceof Error ? err.message : "Erreur lors du scan");
    } finally {
      setScanning(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveNom.trim()) return;
    setSaving(true);
    await fetch("/api/traitements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId,
        evenementId: evenementId ?? null,
        medicamentId: medicamentId || null,
        medicamentNom: effectiveNom,
        dateDebut,
        dureeJours: Number(dureeJours) || 1,
        voie: voie || null,
        frequence: frequence || null,
        dose: dose !== "" ? Number(dose) : null,
        doseRecommandee,
        uniteDosage: uniteDosage || null,
        motif: motif || null,
        veterinaire: veterinaire || null,
        ordonnanceNumero: ordonnanceNumero || null,
        ordonnanceId,
        ordonnanceAAssocier: !ordonnanceNumero && !ordonnanceId ? ordonnanceAAssocier : false,
        delaiAttenteViandeJ,
        delaiAttenteLaitJ,
      }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-800">
          {evenementId ? "Ajouter un médicament à l’événement" : "Nouveau traitement"}
        </span>
        <div className="flex items-center gap-2">
          {/* Scanner button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            title="Scanner une ordonnance (photo ou PDF)"
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
            {scanning ? "Analyse..." : "Scanner ordonnance"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFilePick}
          />
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scan status banner */}
      {scanStatus !== "idle" && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          scanStatus === "ok"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {scanStatus === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {scanMsg}
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
        <MedicamentPicker
          medicaments={medicaments}
          value={selectedMed ?? null}
          onChange={choisirMedicament}
        />
      </div>

      {preconisationChargee && (
        <div className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800">
          <CheckCircle2 size={13} />
          Préconisation chargée automatiquement. Tous les champs restent modifiables.
        </div>
      )}

      {(delaiAttenteViandeJ != null || delaiAttenteLaitJ != null) && (
        <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-700">
          {delaiAttenteViandeJ != null && <>Attente viande : {delaiAttenteViandeJ} jour(s)</>}
          {delaiAttenteViandeJ != null && delaiAttenteLaitJ != null && <span> · </span>}
          {delaiAttenteLaitJ != null && <>Attente lait : {delaiAttenteLaitJ} traite(s)</>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Date début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
          <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Voie</label>
          <input value={voie} onChange={(e) => setVoie(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="IM/SC..." />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Fréquence</label>
          <input value={frequence} onChange={(e) => setFrequence(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1x/jour" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Dose
            {doseBase && (
              <span className="ml-1 text-blue-600">
                {doseBase === "ANIMAL" ? "par animal" : doseBase === "KG" ? "par kg" : doseBase === "100KG" ? "par 100 kg" : doseBase === "QUARTIER" ? "par quartier" : doseBase}
              </span>
            )}
          </label>
          <input type="number" min={0} step="0.1" value={dose} onChange={(e) => setDose(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Unité</label>
          <input value={uniteDosage} onChange={(e) => setUniteDosage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ml" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Motif</label>
        <input value={motif} onChange={(e) => setMotif(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Pneumonie, diarrhée..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Vétérinaire</label>
          <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nom du vétérinaire" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">N° ordonnance</label>
          <input value={ordonnanceNumero} onChange={(e) => setOrdonnanceNumero(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: O97734" />
        </div>
      </div>

      {!ordonnanceNumero && !ordonnanceId && (
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={ordonnanceAAssocier} onChange={(e) => setOrdonnanceAAssocier(e.target.checked)} />
          Ordonnance à associer plus tard
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !effectiveNom.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save size={14} /> Enregistrer
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </form>
  );
}

