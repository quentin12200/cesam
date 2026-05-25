"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getBadgeClass, getEtatLabel, formatDate } from "@/lib/utils";
import Link from "next/link";
import { RefreshCw, Plus, CheckCircle, ArrowLeft, CalendarDays, Settings, Printer } from "lucide-react";

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
  derniereChaleur: string | null;
}

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
  traper: string | null;
}

type FilterEtat = "TOUS" | EtatGestation;

const filterLabels: Record<FilterEtat, string> = {
  TOUS: "Tous",
  GRIS: "Saillie récente",
  JAUNE: "À écho",
  VERT: "Pleine",
  ROUGE: "Vide",
  ROSE: "Imminent",
};

const LEGENDE = [
  { couleur: "bg-gray-400", label: "Saillie récente", detail: "Saillie effectuée il y a moins de 35 jours — trop tôt pour l'écho" },
  { couleur: "bg-yellow-400", label: "À échographier", detail: "Entre 35 et 45 jours après la saillie — moment idéal pour confirmer" },
  { couleur: "bg-green-500", label: "Pleine confirmée", detail: "Gestation confirmée par écho — date de vélage calculée" },
  { couleur: "bg-pink-400", label: "Vélage imminent", detail: "Vélage prévu dans moins de 30 jours — surveiller de près" },
  { couleur: "bg-red-500", label: "Vide", detail: "Non gestante — prête pour une nouvelle saillie" },
];

const DUREE_GESTATION = 285;

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
  const [saillieError, setSaillieError] = useState<string | null>(null);
  const [confirmVideId, setConfirmVideId] = useState<string | null>(null);

  // Chaleur form
  const [showChaleurForm, setShowChaleurForm] = useState(false);
  const [chaleurAnimalId, setChaleurAnimalId] = useState("");
  const [chaleurDate, setChaleurDate] = useState(new Date().toISOString().split("T")[0]);
  const [chaleurNotes, setChaleurNotes] = useState("");

  // Saillie form
  const [saillieAnimalId, setSaillieAnimalId] = useState("");
  const [saillieDate, setSaillieDate] = useState(new Date().toISOString().split("T")[0]);
  const [saillieType, setSaillieType] = useState<"NATURELLE" | "IA">("NATURELLE");
  const [saillieTaureauId, setSaillieTaureauId] = useState("");
  // IA bull state
  const [iaSelectedId, setIaSelectedId] = useState("");
  const [iaNupere, setIaNupere] = useState("");
  const [iaNopere, setIaNopere] = useState("");
  const [iaTraper, setIaTraper] = useState("");

  // Echo form
  const [echoSaillieId, setEchoSaillieId] = useState("");
  const [echoDate, setEchoDate] = useState(new Date().toISOString().split("T")[0]);
  const [echoResultat, setEchoResultat] = useState("PLEINE");
  const [echoJours, setEchoJours] = useState(45);
  const [echoUnite, setEchoUnite] = useState<"jours" | "mois">("jours");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [repro, taureauData] = await Promise.all([
        fetch("/api/reproduction", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/taureaux", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setVaches(repro.vaches ?? []);
      setTaureaux(taureauData.taureaux ?? []);
    } catch {
      setMessage("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  function openSaillieForm(vache?: VacheRepro) {
    setSaillieAnimalId(vache?.id ?? "");
    setSaillieDate(new Date().toISOString().split("T")[0]);
    setSaillieType("NATURELLE");
    setSaillieTaureauId("");
    setIaSelectedId("");
    setIaNupere("");
    setIaNopere("");
    setIaTraper("");
    setSaillieError(null);
    setShowSaillieForm(true);
  }

  function openEchoForm(vache: VacheRepro) {
    setSelectedVache(vache);
    setEchoSaillieId(vache.saillieId!);
    setEchoResultat("PLEINE");
    setEchoDate(new Date().toISOString().split("T")[0]);
    const joursSaillie = vache.derniereSaillie
      ? differenceInDays(new Date(), new Date(vache.derniereSaillie))
      : 45;
    setEchoJours(Math.max(1, joursSaillie));
    setEchoUnite("jours");
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

  const gestationsActives = vachesAvecEtat
    .filter((v) => (v.etat === "VERT" || v.etat === "ROSE") && v.dateVelagePrevue)
    .sort((a, b) => new Date(a.dateVelagePrevue!).getTime() - new Date(b.dateVelagePrevue!).getTime());

  const farmBulls = taureaux.filter((t) => t.present);
  const iaBulls = taureaux.filter((t) => !t.present);

  const now = new Date();

  async function handleSaillieSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let taureauId: string | undefined = undefined;

      if (saillieType === "NATURELLE") {
        taureauId = saillieTaureauId || undefined;
      } else {
        if (iaSelectedId) {
          taureauId = iaSelectedId;
        } else if (iaNupere.trim()) {
          const res = await fetch("/api/taureaux", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nupere: iaNupere.trim(),
              nopere: iaNopere.trim() || null,
              traper: iaTraper.trim() || null,
              present: false,
            }),
          });
          if (res.status === 409) {
            const existing = taureaux.find((t) => t.nupere === iaNupere.trim());
            taureauId = existing?.id;
          } else if (res.ok) {
            const t = await res.json();
            taureauId = t.id;
          }
        }
      }

      const res = await fetch("/api/saillies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId: saillieAnimalId, date: saillieDate, type: saillieType, taureauId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erreur serveur" }));
        setSaillieError(data.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      setMessage("Saillie enregistrée !");
      setShowSaillieForm(false);
      setFilterEtat("TOUS");
      await fetchData();
    } catch (err) {
      setSaillieError("Erreur réseau : " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleEchoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const joursGestationFinal = echoUnite === "mois" ? Math.round(echoJours * 30.5) : echoJours;
      const res = await fetch("/api/echographies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saillieId: echoSaillieId,
          date: echoDate,
          resultat: echoResultat,
          joursGestation: echoResultat === "PLEINE" ? joursGestationFinal : undefined,
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

  async function marquerVide(vache: VacheRepro) {
    if (!vache.saillieId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/echographies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saillieId: vache.saillieId,
          date: new Date().toISOString().split("T")[0],
          resultat: "VIDE",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`${vache.nutrav} marquée vide`);
      setConfirmVideId(null);
      await fetchData();
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  function openChaleurForm(vache?: VacheRepro) {
    setChaleurAnimalId(vache?.id ?? "");
    setChaleurDate(new Date().toISOString().split("T")[0]);
    setChaleurNotes("");
    setShowChaleurForm(true);
  }

  async function handleChaleurSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/chaleurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId: chaleurAnimalId, date: chaleurDate, notes: chaleurNotes.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Chaleur enregistrée !");
      setShowChaleurForm(false);
      await fetchData();
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  // Echo real-time calculations
  const echoJoursEffectifs = echoUnite === "mois" ? Math.round(echoJours * 30.5) : echoJours;
  const echoDateConception = echoResultat === "PLEINE" && echoJoursEffectifs > 0
    ? addDays(new Date(echoDate), -echoJoursEffectifs) : null;
  const echoDateVelagePrevue = echoResultat === "PLEINE" && echoJoursEffectifs > 0
    ? addDays(new Date(echoDate), DUREE_GESTATION - echoJoursEffectifs) : null;
  const joursAvantVelage = echoDateVelagePrevue
    ? differenceInDays(echoDateVelagePrevue, new Date(echoDate)) : null;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
            <ArrowLeft size={18} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800">Reproduction</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reproduction/impression" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" title="Tableau imprimable">
            <Printer size={18} />
          </Link>
          <Link href="/taureaux" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" title="Gérer les taureaux">
            <Settings size={18} />
          </Link>
          <button
            onClick={() => openSaillieForm()}
            className="flex items-center gap-1 bg-green-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Saillie
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage(null)} className="text-green-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Calendrier de gestation — tableau */}
      {gestationsActives.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <CalendarDays size={18} className="text-green-700" />
            <span className="font-semibold text-gray-800">Calendrier de gestation</span>
            <span className="text-xs text-gray-400 ml-auto">
              {gestationsActives.length} vache{gestationsActives.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold">Vache</th>
                  <th className="px-3 py-2 text-center font-semibold">9 mois</th>
                  <th className="px-3 py-2 text-center font-semibold">Père</th>
                  <th className="px-3 py-2 text-center font-semibold">Délai</th>
                  <th className="px-2 py-2 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gestationsActives.map((v) => {
                  const calving = new Date(v.dateVelagePrevue!);
                  const daysLeft = differenceInDays(calving, now);
                  const rowBg = daysLeft <= 14 ? "bg-pink-50" : daysLeft <= 30 ? "bg-yellow-50" : "";
                  const badgeColor = daysLeft <= 14
                    ? "bg-pink-100 text-pink-700"
                    : daysLeft <= 30
                    ? "bg-orange-100 text-orange-700"
                    : "bg-green-100 text-green-700";
                  return (
                    <tr key={v.id} className={rowBg}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                            {v.nutrav}
                          </span>
                          <span className="text-gray-700 font-medium truncate max-w-[80px]">
                            {v.nobovi ?? "Sans nom"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-800">
                        {calving.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 text-xs">
                        {v.taureauNom ?? "IA"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                          J-{daysLeft}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const progress = Math.min(100, Math.max(0, ((DUREE_GESTATION - daysLeft) / DUREE_GESTATION) * 100));
                          const r = 12;
                          const circ = 2 * Math.PI * r;
                          const dash = (progress / 100) * circ;
                          const color = daysLeft <= 14 ? "#f472b6" : daysLeft <= 30 ? "#fb923c" : "#22c55e";
                          return (
                            <svg width="32" height="32" viewBox="0 0 32 32" className="inline-block">
                              <circle cx="16" cy="16" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
                              <circle
                                cx="16" cy="16" r={r}
                                fill="none"
                                stroke={color}
                                strokeWidth="4"
                                strokeDasharray={`${dash} ${circ}`}
                                strokeDashoffset={circ / 4}
                                strokeLinecap="round"
                                style={{ transform: "rotate(-90deg)", transformOrigin: "16px 16px" }}
                              />
                              <text x="16" y="20" textAnchor="middle" fontSize="7" fontWeight="bold" fill={color}>
                                {Math.round(progress)}%
                              </text>
                            </svg>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow p-2 flex gap-1 overflow-x-auto">
        {(["TOUS", "ROUGE", "JAUNE", "VERT", "ROSE", "GRIS"] as FilterEtat[]).map((etat) => {
          const count = etat === "TOUS" ? vachesAvecEtat.length : counts[etat];
          const isActive = filterEtat === etat;
          const badgeColor =
            etat === "TOUS" ? (isActive ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600")
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

      {/* Légende */}
      <details className="bg-white rounded-xl shadow">
        <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer select-none flex items-center gap-2">
          <span>🎨</span> Comprendre les couleurs
        </summary>
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {LEGENDE.map((l) => (
            <div key={l.label} className="flex items-start gap-3">
              <span className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${l.couleur}`} />
              <div>
                <span className="text-sm font-semibold text-gray-800">{l.label}</span>
                <span className="text-xs text-gray-500 ml-2">{l.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </details>

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
                    {vache.derniereChaleur && (
                      <div className="text-xs text-pink-500 mt-0.5">
                        Chaleur: {formatDate(new Date(vache.derniereChaleur))}
                        {" · J+"}{differenceInDays(now, new Date(vache.derniereChaleur))}
                      </div>
                    )}
                    {vache.dateVelagePrevue && (vache.etat === "VERT" || vache.etat === "ROSE") && (
                      <div className="text-xs text-green-700 font-medium mt-0.5">
                        Vélage prévu: {formatDate(new Date(vache.dateVelagePrevue))}
                        {" · J-"}{differenceInDays(new Date(vache.dateVelagePrevue), new Date())}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${getBadgeClass(vache.etat)}`}>
                    {getEtatLabel(vache.etat)}
                  </span>
                  {(() => {
                    const joursDepuisChaleur = vache.derniereChaleur
                      ? differenceInDays(now, new Date(vache.derniereChaleur)) : null;
                    return (
                      <>
                        {joursDepuisChaleur !== null && joursDepuisChaleur <= 3 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                            🌡️ En chaleur (J+{joursDepuisChaleur})
                          </span>
                        )}
                        {joursDepuisChaleur !== null && joursDepuisChaleur >= 18 && joursDepuisChaleur <= 24 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                            ⚡ Retour J+21 ?
                          </span>
                        )}
                      </>
                    );
                  })()}
                  <div className="flex gap-1 flex-wrap justify-end">
                    {(vache.etat === "JAUNE" || vache.etat === "GRIS") && vache.saillieId && (
                      <button
                        onClick={() => openEchoForm(vache)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Écho
                      </button>
                    )}
                    {vache.etat === "ROUGE" && (
                      <button
                        onClick={() => openChaleurForm(vache)}
                        className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-lg flex items-center gap-1"
                      >
                        🌡️ Chaleur
                      </button>
                    )}
                    <button
                      onClick={() => openSaillieForm(vache)}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Saillie
                    </button>
                  </div>
                  {vache.saillieId && vache.etat !== "ROUGE" && (
                    confirmVideId === vache.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-gray-500">Non pleine ?</span>
                        <button
                          onClick={() => marquerVide(vache)}
                          disabled={saving}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg font-semibold"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => setConfirmVideId(null)}
                          className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmVideId(vache.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors mt-0.5"
                      >
                        ✗ Marquer vide
                      </button>
                    )
                  )}
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

      {/* ── Modal Chaleur ── */}
      {showChaleurForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">🌡️ Observer une chaleur</h3>
              <button onClick={() => setShowChaleurForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enregistrez l&apos;observation de signes de chaleur. Un rappel J+21 apparaîtra automatiquement.
            </p>
            <form onSubmit={handleChaleurSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vache</label>
                <select
                  value={chaleurAnimalId}
                  onChange={(e) => setChaleurAnimalId(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="">Sélectionner une vache...</option>
                  {vachesAvecEtat
                    .filter((v) => v.etat === "ROUGE" || !v.saillieId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>{v.nutrav} – {v.nobovi ?? "Sans nom"}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;observation</label>
                <input
                  type="date"
                  value={chaleurDate}
                  onChange={(e) => setChaleurDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input
                  type="text"
                  value={chaleurNotes}
                  onChange={(e) => setChaleurNotes(e.target.value)}
                  placeholder="ex : chaleur forte, montée, mucus..."
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer la chaleur"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Saillie ── */}
      {showSaillieForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enregistrer une saillie</h3>
              <button onClick={() => setShowSaillieForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSaillieSubmit} className="space-y-4">

              {/* Vache */}
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
                    <option key={v.id} value={v.id}>{v.nutrav} – {v.nobovi ?? "Sans nom"}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
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

              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de saillie</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaillieType("NATURELLE")}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      saillieType === "NATURELLE"
                        ? "bg-green-700 text-white border-green-700 shadow-md"
                        : "border-gray-200 text-gray-600 hover:border-green-300"
                    }`}
                  >
                    🐄 Naturelle
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaillieType("IA")}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      saillieType === "IA"
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    💉 Insémination
                  </button>
                </div>
              </div>

              {/* NATURELLE — sélection taureau de la ferme */}
              {saillieType === "NATURELLE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taureau de la ferme</label>
                  {farmBulls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {farmBulls.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSaillieTaureauId(saillieTaureauId === t.id ? "" : t.id)}
                          className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                            saillieTaureauId === t.id
                              ? "bg-green-700 text-white border-green-700 shadow-md"
                              : "border-gray-200 hover:border-green-400 text-gray-700 bg-white"
                          }`}
                        >
                          <span className="text-2xl mb-1">🐂</span>
                          <span className="font-bold text-sm leading-tight text-center">{t.nopere ?? t.nupere}</span>
                          <span className={`text-[11px] font-mono mt-0.5 ${saillieTaureauId === t.id ? "text-green-100" : "text-gray-400"}`}>
                            {t.nupere}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2">
                      Aucun taureau enregistré —{" "}
                      <Link href="/taureaux" className="text-green-700 underline font-medium">gérer les taureaux</Link>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">Optionnel — laisser vide si non précisé</p>
                </div>
              )}

              {/* IA — insémination artificielle */}
              {saillieType === "IA" && (
                <div className="space-y-3">
                  {/* Taureaux IA déjà utilisés */}
                  {iaBulls.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Taureau IA déjà utilisé</label>
                      <div className="flex flex-wrap gap-2">
                        {iaBulls.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (iaSelectedId === t.id) {
                                setIaSelectedId("");
                              } else {
                                setIaSelectedId(t.id);
                                setIaNupere("");
                                setIaNopere("");
                                setIaTraper("");
                              }
                            }}
                            className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                              iaSelectedId === t.id
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-gray-200 text-gray-600 hover:border-blue-300 bg-white"
                            }`}
                          >
                            {t.nopere ?? t.nupere}
                            {t.traper && <span className="ml-1 opacity-70">· {t.traper}</span>}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 my-3">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs text-gray-400">ou saisir un nouveau</span>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>
                    </div>
                  )}

                  {/* Saisie nouveau taureau IA */}
                  <div className={`space-y-2 transition-opacity ${iaSelectedId ? "opacity-30 pointer-events-none" : ""}`}>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Référence / Numéro paillette</label>
                      <input
                        type="text"
                        value={iaNupere}
                        onChange={(e) => { setIaNupere(e.target.value); setIaSelectedId(""); }}
                        placeholder="ex : FR2312345678"
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nom du taureau</label>
                        <input
                          type="text"
                          value={iaNopere}
                          onChange={(e) => { setIaNopere(e.target.value); setIaSelectedId(""); }}
                          placeholder="ex : Kaarl Piroux"
                          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Race / Origine</label>
                        <input
                          type="text"
                          value={iaTraper}
                          onChange={(e) => { setIaTraper(e.target.value); setIaSelectedId(""); }}
                          placeholder="ex : BA, Limousin"
                          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Tous les champs sont optionnels</p>
                  </div>
                </div>
              )}

              {saillieError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {saillieError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer la saillie"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Échographie ── */}
      {showEchoForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Résultat échographie
                {selectedVache && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    — {selectedVache.nutrav} {selectedVache.nobovi ?? ""}
                  </span>
                )}
              </h3>
              <button onClick={() => setShowEchoForm(false)} className="text-gray-400 text-2xl leading-none">×</button>
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
                    {vachesAvecEtat
                      .filter((v) => v.saillieId && (v.etat === "JAUNE" || v.etat === "GRIS"))
                      .map((v) => (
                        <option key={v.saillieId} value={v.saillieId!}>
                          {v.nutrav} – {v.nobovi ?? "Sans nom"} (saillie {formatDate(new Date(v.derniereSaillie!))})
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
                {selectedVache?.derniereSaillie && (() => {
                  const j = differenceInDays(new Date(echoDate), new Date(selectedVache.derniereSaillie));
                  return j > 0 ? (
                    <p className="text-xs text-gray-400 mt-1">
                      Saillie le {formatDate(new Date(selectedVache.derniereSaillie))} · {j} j avant l&apos;écho
                    </p>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEchoResultat("PLEINE")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      echoResultat === "PLEINE" ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    ✓ Pleine
                  </button>
                  <button
                    type="button"
                    onClick={() => setEchoResultat("VIDE")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      echoResultat === "VIDE" ? "bg-red-500 text-white border-red-500" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    ✗ Vide
                  </button>
                </div>
              </div>

              {echoResultat === "PLEINE" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jours de gestation à la date de l&apos;écho
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={echoJours}
                        onChange={(e) => setEchoJours(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={echoUnite === "mois" ? 9 : 284}
                        required
                        className="flex-1 border border-gray-200 rounded-lg p-2.5 text-sm text-center font-bold text-lg"
                      />
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setEchoUnite("jours")}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${
                            echoUnite === "jours" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          jours
                        </button>
                        <button
                          type="button"
                          onClick={() => setEchoUnite("mois")}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${
                            echoUnite === "mois" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          mois
                        </button>
                      </div>
                    </div>
                    {echoUnite === "mois" && (
                      <p className="text-xs text-gray-400 mt-1">≈ {echoJoursEffectifs} jours</p>
                    )}
                  </div>

                  {echoDateConception && echoDateVelagePrevue && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Début de gestation estimé</span>
                        <span className="font-semibold text-gray-800">
                          {echoDateConception.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                      <div className="h-px bg-gray-200" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Vélage prévu</span>
                        <span className="font-bold text-green-700">
                          {echoDateVelagePrevue.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                      {joursAvantVelage !== null && (
                        <div className={`text-center text-xs font-semibold py-1 px-2 rounded-lg ${
                          joursAvantVelage <= 30 ? "bg-pink-100 text-pink-700"
                          : joursAvantVelage <= 60 ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                        }`}>
                          dans {joursAvantVelage} jours
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
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
