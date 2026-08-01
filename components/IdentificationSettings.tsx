"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Tags } from "lucide-react";

type Lot = {
  id: string;
  reference: string | null;
  premierNutrav: string;
  premierNunati: string;
  quantite: number;
  prochainIndex: number;
  restantes?: number;
};

type ApercuLot = {
  quantiteDemandee: number;
  premierNumero: string;
  premierNumeroLibre: string;
  dernierNumero: string;
  sautes: Array<{
    nutrav: string;
    nunati: string;
    utilisePar: string | null;
  }>;
};

export default function IdentificationSettings() {
  const [lot, setLot] = useState<Lot | null>(null);
  const [nouveauLot, setNouveauLot] = useState(false);
  const [lotsEnAttente, setLotsEnAttente] = useState<Lot[]>([]);
  const [proposition, setProposition] = useState<{
    nutrav: string;
    nunati: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [premierNunati, setPremierNunati] = useState("");
  const [quantite, setQuantite] = useState("");
  const [preview, setPreview] = useState<ApercuLot | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  async function charger() {
    const res = await fetch("/api/identification");
    if (!res.ok) return;
    const data = await res.json();
    setLot(data.lotActif);
    setLotsEnAttente(data.lotsEnAttente ?? []);
    setProposition(data.proposition ?? null);
  }

  useEffect(() => {
    void charger();
  }, []);

  useEffect(() => {
    const quantiteDemandee = Number(quantite);
    if (
      !premierNunati.match(/\d{4}$/) ||
      !Number.isInteger(quantiteDemandee) ||
      quantiteDemandee < 1
    ) {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    setPreview(null);
    setPreviewLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewError("");
      try {
        const res = await fetch("/api/identification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            premierNunati,
            quantite: quantiteDemandee,
            preview: true,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Aperçu impossible");
        setPreview(data.preview);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPreview(null);
        setPreviewError(
          error instanceof Error ? error.message : "Aperçu impossible"
        );
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [premierNunati, quantite]);

  async function creerLot() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/identification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        premierNunati,
        quantite: Number(quantite),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      const creation = data.creation as ApercuLot;
      setNouveauLot(false);
      setPremierNunati("");
      setQuantite("");
      setPreview(null);
      setMessage(
        `${lot ? "Nouveau lot enregistré. Il prendra la suite du lot actuel." : "Nouveau lot activé"} Série finale : ${creation.premierNumero} à ${creation.dernierNumero}, ${creation.quantiteDemandee} boucles libres.`
      );
      await charger();
    } else {
      setMessage(data.error ?? "Erreur");
    }
  }

  const restantes = lot
    ? lot.restantes ?? Math.max(0, lot.quantite - lot.prochainIndex)
    : 0;
  const prochainNutrav = proposition?.nutrav ?? "—";

  return (
    <details className="group mt-5 border-t border-gray-100 pt-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2">
        <Tags size={18} className="text-orange-600" />
        <span className="flex-1 text-sm font-bold">
          Identification des animaux
        </span>
        <ChevronDown
          size={17}
          className="transition group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 pt-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold">Lot actif</h4>
              {!lot && (
                <p className="mt-1 text-xs text-gray-500">
                  Aucun lot configuré
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNouveauLot((value) => !value)}
              className="text-right text-xs font-semibold text-green-700"
            >
              Ajouter un nouveau lot de boucles
            </button>
          </div>

          {lot && (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-gray-500">Premier numéro national</dt>
                <dd className="break-all font-mono font-semibold">
                  {lot.premierNunati}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Quantité commandée</dt>
                <dd className="font-semibold">{lot.quantite}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Prochain numéro de travail</dt>
                <dd className="font-mono text-base font-bold text-green-700">
                  {prochainNutrav}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Boucles restantes</dt>
                <dd
                  className={`text-base font-bold ${
                    restantes === 0
                      ? "text-red-700"
                      : restantes <= Math.ceil(lot.quantite * 0.1)
                        ? "text-orange-700"
                        : "text-gray-800"
                  }`}
                >
                  {restantes}
                </dd>
              </div>
            </dl>
          )}

          {lotsEnAttente.length > 0 && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {lotsEnAttente.length} lot
              {lotsEnAttente.length > 1 ? "s" : ""} en attente.{" "}
              {lotsEnAttente[0].premierNunati} prendra automatiquement la suite.
            </p>
          )}

          {nouveauLot && (
            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              <input
                value={premierNunati}
                onChange={(event) =>
                  setPremierNunati(event.target.value.toUpperCase())
                }
                placeholder="Premier numéro national complet"
                className="w-full rounded-lg border px-3 py-2.5 font-mono text-sm"
              />
              <input
                value={quantite}
                onChange={(event) => setQuantite(event.target.value)}
                type="number"
                min={1}
                placeholder="Nombre de boucles commandées"
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
              />

              {previewLoading && (
                <p className="text-xs text-gray-500">Calcul de la série…</p>
              )}
              {previewError && (
                <p className="text-xs font-medium text-red-600">
                  {previewError}
                </p>
              )}
              {preview && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-950">
                  <p className="font-bold">
                    {preview.quantiteDemandee} boucles seront enregistrées
                  </p>
                  <p className="mt-1">
                    Série générée :{" "}
                    <span className="font-mono font-semibold">
                      {preview.premierNumero} à {preview.dernierNumero}
                    </span>
                  </p>
                  {preview.sautes.length > 0 ? (
                    <div className="mt-2 border-t border-green-200 pt-2">
                      <p className="font-semibold">
                        {preview.sautes.length} numéro
                        {preview.sautes.length > 1 ? "s" : ""} déjà utilisé
                        {preview.sautes.length > 1 ? "s" : ""} et sauté
                        {preview.sautes.length > 1 ? "s" : ""} :
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {preview.sautes.map((numero) => (
                          <li key={`${numero.nunati}-${numero.nutrav}`}>
                            <span className="font-mono font-semibold">
                              {numero.nunati}
                            </span>
                            {numero.utilisePar
                              ? ` — utilisé par ${numero.utilisePar}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-1 text-green-800">
                      Aucun numéro déjà utilisé dans cette série.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={saving || previewLoading || !preview}
                onClick={() => void creerLot()}
                className="min-h-11 w-full rounded-lg bg-green-700 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer ce lot"}
              </button>
            </div>
          )}
        </div>
        {message && (
          <p
            className={`text-xs font-medium ${
              message.includes("Erreur") || message.includes("impossible")
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
