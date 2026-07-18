"use client";

import { useState } from "react";
import { Building2, Check, ExternalLink, Mail, Phone } from "lucide-react";
import { ANNUAIRE_CHAMBRES, DEPARTEMENTS, trouverContactReagir } from "@/lib/soutien/reagir";

export default function ReseauReagir({ departementInitial }: { departementInitial: string | null }) {
  const [departement, setDepartement] = useState(departementInitial ?? "");
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState(false);
  const contact = trouverContactReagir(departement);

  async function changerDepartement(nouveauDepartement: string) {
    setDepartement(nouveauDepartement);
    setEnregistre(false);
    setErreur(false);
    try {
      const reponse = await fetch("/api/soutien/departement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departement: nouveauDepartement }),
      });
      if (!reponse.ok) throw new Error("Enregistrement impossible");
      setEnregistre(true);
      window.setTimeout(() => setEnregistre(false), 2500);
    } catch {
      setErreur(true);
    }
  }

  return (
    <article className="rounded-lg border border-gray-200 p-3 sm:col-span-2">
      <div className="flex items-start gap-2">
        <Building2 size={19} className="mt-0.5 shrink-0 text-green-700" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900">Réseau RÉAGIR</h3>
          <p className="mt-0.5 text-sm text-gray-600">Un contact local et confidentiel pour faire le point et chercher des solutions avec l’exploitation.</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-gray-600" htmlFor="departement-reagir">Département</label>
        {departement && <span className="text-xs text-gray-500">Modifier le département</span>}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <select
          id="departement-reagir"
          value={departement}
          onChange={(event) => changerDepartement(event.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900"
        >
          <option value="">Choisir un département</option>
          {DEPARTEMENTS.map(([code, nom]) => <option key={code} value={code}>{code} · {nom}</option>)}
        </select>
        {enregistre && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-green-700"><Check size={15} /> Mémorisé</span>}
      </div>
      {erreur && <p className="mt-1 text-xs text-red-700">Le choix n’a pas pu être mémorisé. Réessaie dans un instant.</p>}

      {contact ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="font-bold text-gray-900">{contact.nom}</p>
          {contact.precision && <p className="mt-0.5 text-sm text-gray-600">{contact.precision}</p>}
          <p className="mt-1 font-semibold text-green-800">{contact.telephone}</p>
          {contact.email && <p className="break-all text-sm text-gray-600">{contact.email}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`tel:${contact.telephone.replace(/\s/g, "")}`} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 text-sm font-bold text-white active:bg-green-800">
              <Phone size={18} /> Appeler
            </a>
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-green-700 bg-white px-4 text-sm font-bold text-green-800 active:bg-green-50">
                <Mail size={18} /> Envoyer un e-mail
              </a>
            )}
          </div>
          <a href={contact.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-gray-500">
            Coordonnées officielles <ExternalLink size={13} />
          </a>
        </div>
      ) : departement ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="font-semibold text-gray-800">Contact RÉAGIR introuvable</p>
          <p className="mt-1 text-sm text-gray-600">La Chambre d’agriculture du département pourra orienter vers la cellule locale adaptée.</p>
          <a href={ANNUAIRE_CHAMBRES} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-green-800">
            Trouver ma Chambre <ExternalLink size={15} />
          </a>
        </div>
      ) : null}
    </article>
  );
}
