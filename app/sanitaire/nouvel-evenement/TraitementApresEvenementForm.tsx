"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { addDays, format } from "date-fns";
import { Loader2, CheckCircle2, AlertTriangle, Search, X, ChevronLeft } from "lucide-react";
import { getAttenteInfo } from "@/lib/withdrawal";

interface Target {
  animalId: string;
  evenementId: string;
  nutrav: string;
  nom: string | null;
}

interface Medicament {
  id: string;
  nom: string;
  dci: string | null;
  voie: string | null;
  dosagePourKg: number | null;
  uniteDosage: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  temporaire: boolean;
  actif: boolean;
  prescriptionRequise: boolean;
}

interface Ordonnance {
  id: string;
  date: string;
  numero: string | null;
  veterinaireNom: string | null;
  medicamentNom: string;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  frequence: string | null;
  dureeJours: number | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  precautions: string | null;
  rappels: string | null;
  statut: string;
}

interface Props {
  targets: Target[];
  symptomesLibelles: string[];
  dateDebut: string;
  onDone: () => void;
  onSkip: () => void;
}

type Step = "form" | "preview";

export default function TraitementApresEvenementForm({ targets, symptomesLibelles, dateDebut, onDone, onSkip }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [traitementsEnregistres, setTraitementsEnregistres] = useState(0);

  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [suggestions, setSuggestions] = useState<Medicament[]>([]);
  const [rechercheMed, setRechercheMed] = useState("");
  const [medicamentId, setMedicamentId] = useState("");
  const [medicamentNomLibre, setMedicamentNomLibre] = useState("");
  const [modeTemporaire, setModeTemporaire] = useState(false);

  const [ordonnancesMatch, setOrdonnancesMatch] = useState<Ordonnance[]>([]);
  const [ordonnanceChoisie, setOrdonnanceChoisie] = useState<Ordonnance | null>(null);
  const [ordonnanceAAssocier, setOrdonnanceAAssocier] = useState(false);

  const [dateDebutTraitement, setDateDebutTraitement] = useState(dateDebut);
  const [dureeJours, setDureeJours] = useState("3");
  const [voie, setVoie] = useState("");
  const [frequence, setFrequence] = useState("");
  const [dose, setDose] = useState("");
  const [uniteDosage, setUniteDosage] = useState("ml");
  const [motif, setMotif] = useState("");
  const [veterinaire, setVeterinaire] = useState("");
  const [delaiAttenteViandeJ, setDelaiAttenteViandeJ] = useState("");
  const [delaiAttenteLaitJ, setDelaiAttenteLaitJ] = useState("");

  const [poids, setPoids] = useState<Record<string, { poids: number; date: string }>>({});
  const [doseParAnimal, setDoseParAnimal] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/medicaments").then((r) => r.json()).then((data: Medicament[]) => setMedicaments(data.filter((m) => m.actif)));
    fetch(`/api/animaux/poids-recents?ids=${targets.map((t) => t.animalId).join(",")}`)
      .then((r) => r.json())
      .then(setPoids)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (symptomesLibelles.length === 0) return;
    fetch(`/api/medicaments/suggestions?symptomes=${encodeURIComponent(symptomesLibelles.join(","))}`)
      .then((r) => r.json())
      .then(setSuggestions)
      .catch(() => {});
  }, [symptomesLibelles]);

  const selectedMed = medicaments.find((m) => m.id === medicamentId);
  const effectiveNom = medicamentId ? (selectedMed?.nom ?? "") : medicamentNomLibre;

  const resultatsRecherche = useMemo(() => {
    const q = rechercheMed.trim().toLowerCase();
    if (!q) return [];
    return medicaments.filter((m) => m.nom.toLowerCase().includes(q) || (m.dci ?? "").toLowerCase().includes(q));
  }, [rechercheMed, medicaments]);

  const choisirMedicament = useCallback((m: Medicament) => {
    setMedicamentId(m.id);
    setMedicamentNomLibre("");
    setModeTemporaire(false);
    setVoie(m.voie ?? "");
    setUniteDosage(m.uniteDosage ?? "ml");
    if (m.delaiAttenteViandeJ != null) setDelaiAttenteViandeJ(String(m.delaiAttenteViandeJ));
    if (m.delaiAttenteLaitJ != null) setDelaiAttenteLaitJ(String(m.delaiAttenteLaitJ));
    setRechercheMed("");
    setOrdonnanceChoisie(null);
    setOrdonnanceAAssocier(false);
  }, []);

  // Recherche des ordonnances existantes pour le médicament choisi
  useEffect(() => {
    if (!effectiveNom.trim()) { setOrdonnancesMatch([]); return; }
    fetch(`/api/ordonnances/for-medicament?nom=${encodeURIComponent(effectiveNom.trim())}`)
      .then((r) => r.json())
      .then(setOrdonnancesMatch)
      .catch(() => setOrdonnancesMatch([]));
  }, [effectiveNom]);

  function choisirOrdonnance(o: Ordonnance | null) {
    setOrdonnanceChoisie(o);
    setOrdonnanceAAssocier(false);
    if (!o) return;
    if (o.dose != null) setDose(String(o.dose));
    if (o.uniteDosage) setUniteDosage(o.uniteDosage);
    if (o.voie) setVoie(o.voie);
    if (o.frequence) setFrequence(o.frequence);
    if (o.dureeJours != null) setDureeJours(String(o.dureeJours));
    if (o.delaiAttenteViandeJ != null) setDelaiAttenteViandeJ(String(o.delaiAttenteViandeJ));
    if (o.delaiAttenteLaitJ != null) setDelaiAttenteLaitJ(String(o.delaiAttenteLaitJ));
    if (o.veterinaireNom) setVeterinaire(o.veterinaireNom);
  }

  // Dose recommandée calculée au poids quand un médicament catalogué avec dosagePourKg est choisi
  const doseRecommandeeParAnimal = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const t of targets) {
      if (ordonnanceChoisie?.dose != null) {
        map[t.animalId] = ordonnanceChoisie.dose;
        continue;
      }
      const p = poids[t.animalId]?.poids;
      if (selectedMed?.dosagePourKg != null && p != null) {
        map[t.animalId] = Math.round(selectedMed.dosagePourKg * p * 100) / 100;
      } else {
        map[t.animalId] = null;
      }
    }
    return map;
  }, [targets, selectedMed, poids, ordonnanceChoisie]);

  useEffect(() => {
    setDoseParAnimal((prev) => {
      const next = { ...prev };
      for (const t of targets) {
        const reco = doseRecommandeeParAnimal[t.animalId];
        if (next[t.animalId] === undefined && reco != null) next[t.animalId] = String(reco);
      }
      return next;
    });
  }, [doseRecommandeeParAnimal, targets]);

  function appliquerDoseATous() {
    if (dose === "") return;
    const next: Record<string, string> = {};
    for (const t of targets) next[t.animalId] = dose;
    setDoseParAnimal(next);
  }

  async function creerMedicamentTemporaire(): Promise<string | null> {
    if (!medicamentNomLibre.trim()) return null;
    const existing = medicaments.find((m) => m.nom.toLowerCase() === medicamentNomLibre.trim().toLowerCase());
    if (existing) return existing.id;
    try {
      const res = await fetch("/api/medicaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: medicamentNomLibre.trim(), voie: voie || null, uniteDosage: uniteDosage || null, temporaire: true }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.id ?? null;
    } catch {
      return null;
    }
  }

  const dateFin = useMemo(() => {
    try {
      return addDays(new Date(dateDebutTraitement), (Number(dureeJours) || 1) - 1);
    } catch {
      return new Date(dateDebutTraitement);
    }
  }, [dateDebutTraitement, dureeJours]);

  const attente = useMemo(
    () => getAttenteInfo(dateFin, delaiAttenteViandeJ !== "" ? Number(delaiAttenteViandeJ) : null, delaiAttenteLaitJ !== "" ? Number(delaiAttenteLaitJ) : null),
    [dateFin, delaiAttenteViandeJ, delaiAttenteLaitJ]
  );

  const avertissements = useMemo(() => {
    const warnings: string[] = [];
    if (!effectiveNom.trim()) warnings.push("Aucun médicament sélectionné.");
    if (!voie.trim()) warnings.push("Voie d'administration non renseignée.");
    const sansDose = targets.filter((t) => !doseParAnimal[t.animalId]?.trim());
    if (sansDose.length > 0) warnings.push(`Dose non renseignée pour ${sansDose.length} animal(x) : dose à confirmer.`);
    const sansPoids = targets.filter((t) => poids[t.animalId] == null);
    if (sansPoids.length > 0 && selectedMed?.dosagePourKg != null) {
      warnings.push(`Poids récent inconnu pour ${sansPoids.length} animal(x) : dose recommandée non calculée automatiquement.`);
    }
    if (!ordonnanceChoisie && selectedMed?.prescriptionRequise) {
      warnings.push("Ce médicament nécessite une prescription : aucune ordonnance associée pour l'instant.");
    }
    return warnings;
  }, [effectiveNom, voie, targets, doseParAnimal, poids, selectedMed, ordonnanceChoisie]);

  function passerEnPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveNom.trim()) { setError("Choisis un médicament ou saisis-en un nouveau"); return; }
    setError("");
    setStep("preview");
  }

  async function confirmer() {
    setSaving(true);
    setError("");
    try {
      let finalMedicamentId = medicamentId || null;
      if (!finalMedicamentId && modeTemporaire) {
        finalMedicamentId = await creerMedicamentTemporaire();
      }

      const res = await fetch("/api/traitements/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: targets.map((t) => ({
            animalId: t.animalId,
            evenementId: t.evenementId,
            doseRecommandee: doseRecommandeeParAnimal[t.animalId] ?? null,
            dose: doseParAnimal[t.animalId] !== undefined && doseParAnimal[t.animalId] !== "" ? Number(doseParAnimal[t.animalId]) : null,
            poidsUtilise: poids[t.animalId]?.poids ?? null,
          })),
          medicamentId: finalMedicamentId,
          medicamentNom: effectiveNom.trim(),
          dateDebut: dateDebutTraitement,
          dureeJours: Number(dureeJours) || 1,
          voie: voie || null,
          frequence: frequence || null,
          uniteDosage: uniteDosage || null,
          motif: motif || null,
          veterinaire: veterinaire || null,
          ordonnanceNumero: ordonnanceChoisie?.numero ?? null,
          ordonnanceId: ordonnanceChoisie?.id ?? null,
          ordonnanceAAssocier,
          delaiAttenteViandeJ: delaiAttenteViandeJ !== "" ? Number(delaiAttenteViandeJ) : null,
          delaiAttenteLaitJ: delaiAttenteLaitJ !== "" ? Number(delaiAttenteLaitJ) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur serveur");
      }
      setTraitementsEnregistres((n) => n + 1);
      setStep("form");
      // reset les champs médicament pour un éventuel traitement supplémentaire
      setMedicamentId("");
      setMedicamentNomLibre("");
      setModeTemporaire(false);
      setOrdonnanceChoisie(null);
      setOrdonnanceAAssocier(false);
      setDose("");
      setDoseParAnimal({});
      setMotif("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (step === "preview") {
    return (
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStep("form")} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={18} />
          </button>
          <h3 className="font-semibold text-gray-800">Vérifier avant validation</h3>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
          <p><span className="text-gray-500">Médicament :</span> <span className="font-medium">{effectiveNom}</span>{modeTemporaire && <span className="ml-1 text-xs text-orange-600">(temporaire)</span>}</p>
          <p><span className="text-gray-500">Voie / fréquence :</span> {voie || "—"} {frequence ? `· ${frequence}` : ""}</p>
          <p><span className="text-gray-500">Du :</span> {dateDebutTraitement} <span className="text-gray-500">pendant</span> {dureeJours} j</p>
          <p><span className="text-gray-500">Ordonnance :</span> {ordonnanceChoisie ? `${ordonnanceChoisie.numero ?? "n° inconnu"} — ${ordonnanceChoisie.veterinaireNom ?? "prescripteur inconnu"}` : ordonnanceAAssocier ? "à associer plus tard" : "aucune"}</p>
          {(delaiAttenteViandeJ || delaiAttenteLaitJ) && (
            <p>
              <span className="text-gray-500">Délai d&apos;attente :</span>{" "}
              {delaiAttenteViandeJ && `viande ${delaiAttenteViandeJ}j (fin ${attente.dateFinAttenteViande ? format(attente.dateFinAttenteViande, "dd/MM/yyyy") : "—"})`}
              {delaiAttenteViandeJ && delaiAttenteLaitJ ? " · " : ""}
              {delaiAttenteLaitJ && `lait ${delaiAttenteLaitJ}j (fin ${attente.dateFinAttenteLait ? format(attente.dateFinAttenteLait, "dd/MM/yyyy") : "—"})`}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Dose par animal</p>
          <div className="space-y-1">
            {targets.map((t) => (
              <div key={t.animalId} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                <span>{t.nutrav}{t.nom ? ` — ${t.nom}` : ""}</span>
                <span className="font-medium">
                  {doseParAnimal[t.animalId] || "?"} {uniteDosage}
                  {doseRecommandeeParAnimal[t.animalId] != null && Number(doseParAnimal[t.animalId]) !== doseRecommandeeParAnimal[t.animalId] && (
                    <span className="text-xs text-gray-400 ml-1">(reco. {doseRecommandeeParAnimal[t.animalId]})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {avertissements.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
            {avertissements.map((w) => (
              <div key={w} className="flex items-start gap-1.5 text-xs text-orange-700">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {w}
              </div>
            ))}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2">
          <button type="button" onClick={confirmer} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Confirmer le traitement
          </button>
          <button type="button" onClick={() => setStep("form")} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600">
            Modifier
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={passerEnPreview} className="bg-white rounded-xl shadow p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Nouveau traitement</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Pour {targets.length} animal{targets.length > 1 ? "aux" : ""} : {targets.map((t) => t.nutrav).join(", ")}
        </p>
        {traitementsEnregistres > 0 && (
          <p className="text-xs text-green-600 mt-1">{traitementsEnregistres} traitement(s) déjà enregistré(s) pour cet événement.</p>
        )}
      </div>

      {suggestions.length > 0 && !medicamentId && !modeTemporaire && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Suggestions d&apos;après l&apos;historique</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((m) => (
              <button key={m.id} type="button" onClick={() => choisirMedicament(m)}
                className="px-3 py-1.5 rounded-full text-sm border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100">
                {m.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
        {medicamentId ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-blue-800">{selectedMed?.nom}</span>
            <button type="button" onClick={() => setMedicamentId("")} className="text-blue-600 text-xs hover:underline">Changer</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
                <Search size={15} className="text-gray-400 mr-2 shrink-0" />
                <input value={rechercheMed} onChange={(e) => setRechercheMed(e.target.value)}
                  placeholder="Rechercher dans la pharmacie…" className="w-full text-sm outline-none" />
              </div>
              {resultatsRecherche.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-56 overflow-y-auto">
                  {resultatsRecherche.map((m) => (
                    <button key={m.id} type="button" onClick={() => choisirMedicament(m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {m.nom}{m.dci ? ` (${m.dci})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input value={medicamentNomLibre} onChange={(e) => { setMedicamentNomLibre(e.target.value); setModeTemporaire(true); }}
                placeholder="Ou créer un médicament temporaire (nom)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {modeTemporaire && medicamentNomLibre.trim() && (
              <p className="text-xs text-orange-600 mt-1">Sera créé comme médicament temporaire à la validation.</p>
            )}
          </>
        )}
      </div>

      {ordonnancesMatch.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Ordonnances existantes pour ce médicament</p>
          <div className="space-y-1.5">
            {ordonnancesMatch.map((o) => (
              <button key={o.id} type="button" onClick={() => choisirOrdonnance(ordonnanceChoisie?.id === o.id ? null : o)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${ordonnanceChoisie?.id === o.id ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:border-blue-300"}`}>
                <span className="font-medium">{o.numero ?? "sans numéro"}</span> — {format(new Date(o.date), "dd/MM/yyyy")} — {o.veterinaireNom ?? "prescripteur inconnu"} — {o.statut}
              </button>
            ))}
            <button type="button" onClick={() => { setOrdonnanceAAssocier(!ordonnanceAAssocier); setOrdonnanceChoisie(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${ordonnanceAAssocier ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white border-dashed border-gray-300 text-gray-500"}`}>
              Aucune de ces ordonnances — à associer plus tard
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Date début</label>
          <input type="date" value={dateDebutTraitement} onChange={(e) => setDateDebutTraitement(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
          <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
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
          <label className="text-xs text-gray-500 block mb-1">Unité</label>
          <input value={uniteDosage} onChange={(e) => setUniteDosage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ml" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Dose administrée (par défaut, appliquée à tous)</label>
        <div className="flex gap-2">
          <input type="number" min={0} step="0.1" value={dose} onChange={(e) => setDose(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button type="button" onClick={appliquerDoseATous} className="px-3 py-2 text-xs bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200">
            Appliquer à tous
          </button>
        </div>
        <div className="mt-2 space-y-1">
          {targets.map((t) => (
            <div key={t.animalId} className="flex items-center gap-2 text-xs">
              <span className="w-28 truncate text-gray-500">{t.nutrav}</span>
              <input type="number" min={0} step="0.1" value={doseParAnimal[t.animalId] ?? ""}
                onChange={(e) => setDoseParAnimal((prev) => ({ ...prev, [t.animalId]: e.target.value }))}
                className="flex-1 border rounded-lg px-2 py-1" placeholder="dose" />
              {doseRecommandeeParAnimal[t.animalId] != null && (
                <span className="text-gray-400">reco. {doseRecommandeeParAnimal[t.animalId]}</span>
              )}
              {poids[t.animalId] && <span className="text-gray-400">{poids[t.animalId].poids} kg</span>}
            </div>
          ))}
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Délai viande (j)</label>
            <input type="number" min={0} value={delaiAttenteViandeJ} onChange={(e) => setDelaiAttenteViandeJ(e.target.value)}
              className="w-full border rounded-lg px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Délai lait (j)</label>
            <input type="number" min={0} value={delaiAttenteLaitJ} onChange={(e) => setDelaiAttenteLaitJ(e.target.value)}
              className="w-full border rounded-lg px-2 py-2 text-sm" />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium">
          Vérifier et valider
        </button>
        <button type="button" onClick={onSkip} className="px-3 py-2.5 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
          <X size={15} />
        </button>
      </div>

      {traitementsEnregistres > 0 && (
        <button type="button" onClick={onDone} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
          Terminer — retour au module sanitaire
        </button>
      )}
    </form>
  );
}
