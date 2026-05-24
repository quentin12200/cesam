"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getBadgeClass, getEtatLabel, formatDate } from "@/lib/utils";
import Link from "next/link";
import { RefreshCw, Plus, CheckCircle, ArrowLeft, CalendarDays } from "lucide-react";

type EtatGestation = "GRIS" | "JAUNE" | "VERT" | "ROUGE" | "ROSE";

interface VacheRepro {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  derniereSaillie: string | null;
  gestationEtat: string | null;
  dateVelagePrevue: string | null;
  dernierVelage: string | null;
  saillieId: string | null;
  taureauNom: string | null;
}

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
}

type FilterEtat = "TOUS" | EtatGestation;

const filterLabels: Record<FilterEtat, string> = {
  TOUS: "Tous",
  GRIS: "En attente",
  JAUNE: "À écho",
  VERT: "Pleine",
  ROUGE: "Vide",
  ROSE: "Imminent",
};

const DUREE_GESTATION = 285; // jours — Blonde Aquitaine

function moisLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function ReproductionContent() {
  const [vaches, setVaches] = useState<VacheRepro[]>([]);
  const [taureaux, setTaureaux] = useState<Taureau[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialFiltre = (searchParams.get("filtre") as FilterEtat) ?? "TOUS";
  const [filterEtat, setFilterEtat] = useState<FilterEtat>(initialFiltre);
  const [showSaillieForm, setShowSaillieForm] = useState(false);
  const [showEchoForm, setShowEchoForm] = useState(false);
  const [selectedVache, setSelectedVache] = useState<VacheRepro | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Saillie form state
  const [saillieAnimalId, setSaillieAnimalId] = useState("");
  const [saillieDate, setSaillieDate] = useState(new Date().toISOString().split("T")[0]);
  const [saillieType, setSaillieType] = useState("IA");
  const [saillieGroupage, setSaillieGroupage] = useState(false);
  const [saillieTaureauId, setSaillieTaureauId] = useState("");

  // Echo form state — on utilise la date de vélage prévue directement
  const [echoSaillieId, setEchoSaillieId] = useState("");
  const [echoDate, setEchoDate] = useState(new Date().toISOString().split("T")[0]);
  const [echoResultat, setEchoResultat] = useState("PLEINE");
  const [echoDateVelage, setEchoDateVelage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [repro, taureauData] = await Promise.all([
        fetch("/api/reproduction").then((r) => r.json()),
        fetch("/api/taureaux").then((r) => r.json()),
      ]);
      setVaches(repro.vaches ?? []);
      setTaureaux(taureauData.taureaux ?? []);
    } catch {
      setMessage("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  function openEchoForm(vache: VacheRepro) {
    setSelectedVache(vache);
    setEchoSaillieId(vache.saillieId!);
    setEchoResultat("PLEINE");
    // Pré-calculer la date de vélage depuis la date de saillie + 285 j
    if (vache.derniereSaillie) {
      const velagePrevue = addDays(new Date(vache.derniereSaillie), DUREE_GESTATION);
      setEchoDateVelage(velagePrevue.toISOString().split("T")[0]);
    } else {
      setEchoDateVelage(addDays(new Date(), 240).toISOString().split("T")[0]);
    }
    setShowEchoForm(true);
  }

  const vachesAvecEtat = vaches.map((v) => ({
    ...v,
    etat: getEtatGestation(
      v.derniereSaillie ? new Date(v.derniereSaillie) : null,
      v.gestationEtat,
      v.dateVelagePrevue ? new Date(v.dateVelagePrevue) : null,
      v.dernierVelage ? new Date(v.dernierVelage) : null
    ) as EtatGestation,
  }));

  const filtered = filterEtat === "TOUS"
    ? vachesAvecEtat
    : vachesAvecEtat.filter((v) => v.etat === filterEtat);

  const counts: Record<EtatGestation, number> = { GRIS: 0, JAUNE: 0, VERT: 0, ROUGE: 0, ROSE: 0 };
  vachesAvecEtat.forEach((v) => counts[v.etat]++);

  // Calendrier: vaches VERT/ROSE avec date de vélage prévue, triées par date
  const velagesPrevus = vachesAvecEtat
    .filter((v) => (v.etat === "VERT" || v.etat === "ROSE") && v.dateVelagePrevue)
    .sort((a, b) => new Date(a.dateVelagePrevue!).getTime() - new Date(b.dateVelagePrevue!).getTime());

  // Grouper par mois
  const velagesParMois: { moisLabel: string; vaches: typeof velagesPrevus }[] = [];
  for (const v of velagesPrevus) {
    const d = new Date(v.dateVelagePrevue!);
    const label = moisLabel(d);
    const last = velagesParMois[velagesParMois.length - 1];
    if (last && last.moisLabel === label) {
      last.vaches.push(v);
    } else {
      velagesParMois.push({ moisLabel: label, vaches: [v] });
    }
  }

  async function handleSaillieSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/saillies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId: saillieAnimalId,
          date: saillieDate,
          type: saillieType,
          groupage: saillieGroupage,
          taureauId: saillieTaureauId || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Saillie enregistrée !");
      setShowSaillieForm(false);
      await fetchData();
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleEchoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/echographies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saillieId: echoSaillieId,
          date: echoDate,
          resultat: echoResultat,
          dateVelagePrevue: echoResultat === "PLEINE" ? echoDateVelage : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Échographie enregistrée !");
      setShowEchoForm(false);
      await fetchData();
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  // Jours restants avant vélage (pour affichage dans le formulaire)
  const joursAvantVelage = echoDateVelage
    ? differenceInDays(new Date(echoDateVelage), new Date(echoDate))
    : null;

  // Jours de gestation à la date de l'écho (info vétérinaire)
  const joursGestationEcho = selectedVache?.derniereSaillie
    ? differenceInDays(new Date(echoDate), new Date(selectedVache.derniereSaillie))
    : null;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800">Reproduction</h2>
        </div>
        <button
          onClick={() => { setShowSaillieForm(true); setSelectedVache(null); }}
          className="flex items-center gap-1 bg-green-700 text-white text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={16} /> Saillie
        </button>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage(null)} className="text-green-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Calendrier vélages prévus */}
      {velagesParMois.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarDays size={18} className="text-green-700" />
            Vélages prévus ({velagesPrevus.length})
          </h3>
          <div className="space-y-3">
            {velagesParMois.map(({ moisLabel: label, vaches: mv }) => (
              <div key={label}>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {label} · {mv.length} vache{mv.length > 1 ? "s" : ""}
                </div>
                <div className="space-y-1">
                  {mv.map((v) => {
                    const jours = differenceInDays(new Date(v.dateVelagePrevue!), new Date());
                    const urgence = jours <= 7 ? "bg-pink-100 text-pink-700" : jours <= 21 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700";
                    return (
                      <div key={v.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">{v.nutrav}</span>
                          <span className="text-sm text-gray-700">{v.nobovi ?? "Sans nom"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{formatDate(new Date(v.dateVelagePrevue!))}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgence}`}>J-{jours}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow p-2 flex gap-1 overflow-x-auto">
        {(["TOUS", "ROUGE", "JAUNE", "VERT", "ROSE", "GRIS"] as FilterEtat[]).map((etat) => {
          const count = etat === "TOUS" ? vachesAvecEtat.length : counts[etat];
          const isActive = filterEtat === etat;
          const badgeColor = etat === "TOUS" ? (isActive ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600")
            : etat === "ROUGE" ? (isActive ? "bg-red-500 text-white" : "bg-red-100 text-red-600")
            : etat === "JAUNE" ? (isActive ? "bg-yellow-400 text-black" : "bg-yellow-50 text-yellow-700")
            : etat === "VERT" ? (isActive ? "bg-green-500 text-white" : "bg-green-100 text-green-700")
            : etat === "ROSE" ? (isActive ? "bg-pink-400 text-white" : "bg-pink-100 text-pink-600")
            : (isActive ? "bg-gray-400 text-white" : "bg-gray-100 text-gray-600");
          return (
            <button
              key={etat}
              onClick={() => setFilterEtat(etat)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${badgeColor}`}
            >
              {filterLabels[etat]}
              <span className="font-bold ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Liste vaches */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vache) => (
            <div key={vache.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-green-700 text-white text-xs font-bold px-2 py-1 rounded-lg font-mono">{vache.nutrav}</span>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{vache.nobovi ?? "Sans nom"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {vache.derniereSaillie ? `Saillie: ${formatDate(new Date(vache.derniereSaillie))}` : "Pas de saillie"}
                    </div>
                    {vache.taureauNom && <div className="text-xs text-gray-400">Taureau: {vache.taureauNom}</div>}
                    {vache.dateVelagePrevue && (vache.etat === "VERT" || vache.etat === "ROSE") && (
                      <div className="text-xs text-green-700 font-medium mt-0.5">
                        Vélage prévu: {formatDate(new Date(vache.dateVelagePrevue))}
                        {" · J-"}{differenceInDays(new Date(vache.dateVelagePrevue), new Date())}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${getBadgeClass(vache.etat)}`}>
                    {getEtatLabel(vache.etat)}
                  </span>
                  <div className="flex gap-1">
                    {(vache.etat === "JAUNE" || vache.etat === "GRIS") && vache.saillieId && (
                      <button
                        onClick={() => openEchoForm(vache)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Écho
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSaillieAnimalId(vache.id);
                        setShowSaillieForm(true);
                      }}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Saillie
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
              Aucune vache dans cette catégorie
            </div>
          )}
        </div>
      )}

      {/* Modal Saillie */}
      {showSaillieForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enregistrer une saillie</h3>
              <button onClick={() => setShowSaillieForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleSaillieSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vache</label>
                <select
                  value={saillieAnimalId}
                  onChange={(e) => setSaillieAnimalId(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="">Sélectionner une vache...</option>
                  {vaches.map((v) => (
                    <option key={v.id} value={v.id}>{v.nutrav} - {v.nobovi ?? "Sans nom"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={saillieDate}
                  onChange={(e) => setSaillieDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={saillieType}
                  onChange={(e) => setSaillieType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="IA">IA (Insémination artificielle)</option>
                  <option value="NATURELLE">Saillie naturelle</option>
                  <option value="TRANSFERT">Transfert embryonnaire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taureau (optionnel)</label>
                <select
                  value={saillieTaureauId}
                  onChange={(e) => setSaillieTaureauId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="">Aucun / Inconnu</option>
                  {taureaux.map((t) => (
                    <option key={t.id} value={t.id}>{t.nopere ?? t.nupere}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="groupage"
                  checked={saillieGroupage}
                  onChange={(e) => setSaillieGroupage(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="groupage" className="text-sm text-gray-700">Groupage (IA de groupe)</label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer la saillie"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Échographie */}
      {showEchoForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Résultat échographie
                {selectedVache && <span className="text-sm font-normal text-gray-500 ml-2">— {selectedVache.nutrav} {selectedVache.nobovi ?? ""}</span>}
              </h3>
              <button onClick={() => setShowEchoForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleEchoSubmit} className="space-y-4">
              {!selectedVache && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vache</label>
                  <select
                    value={echoSaillieId}
                    onChange={(e) => {
                      setEchoSaillieId(e.target.value);
                      const v = vachesAvecEtat.find((x) => x.saillieId === e.target.value);
                      if (v) openEchoForm(v);
                    }}
                    required
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  >
                    <option value="">Sélectionner une vache...</option>
                    {vachesAvecEtat.filter(v => v.saillieId && (v.etat === "JAUNE" || v.etat === "GRIS")).map((v) => (
                      <option key={v.saillieId} value={v.saillieId!}>
                        {v.nutrav} - {v.nobovi ?? "Sans nom"} (saillie {formatDate(new Date(v.derniereSaillie!))})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de l&apos;écho</label>
                <input
                  type="date"
                  value={echoDate}
                  onChange={(e) => setEchoDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
                {joursGestationEcho !== null && joursGestationEcho > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Soit ~{joursGestationEcho} jours depuis la saillie du {formatDate(new Date(selectedVache!.derniereSaillie!))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEchoResultat("PLEINE")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${echoResultat === "PLEINE" ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-700"}`}
                  >
                    ✓ Pleine
                  </button>
                  <button
                    type="button"
                    onClick={() => setEchoResultat("VIDE")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${echoResultat === "VIDE" ? "bg-red-500 text-white border-red-500" : "border-gray-200 text-gray-700"}`}
                  >
                    ✗ Vide
                  </button>
                </div>
              </div>

              {echoResultat === "PLEINE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de vélage prévue</label>
                  <input
                    type="date"
                    value={echoDateVelage}
                    onChange={(e) => setEchoDateVelage(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  />
                  {joursAvantVelage !== null && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${
                      joursAvantVelage <= 30 ? "bg-pink-50 text-pink-700" :
                      joursAvantVelage <= 60 ? "bg-orange-50 text-orange-700" :
                      "bg-green-50 text-green-700"
                    }`}>
                      📅 Vélage dans <strong>{joursAvantVelage} jours</strong>
                      {" · "}{new Date(echoDateVelage).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">
                    Pré-rempli depuis la saillie + {DUREE_GESTATION} jours. Ajustez si le vétérinaire donne une date différente.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer résultat"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReproductionPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">Chargement...</div>}>
      <ReproductionContent />
    </Suspense>
  );
}
