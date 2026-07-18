export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Building2,
  ExternalLink,
  HandHeart,
  HeartHandshake,
  MapPin,
  Phone,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import BackButton from "@/app/components/BackButton";
import { prisma } from "@/lib/prisma";

const LIENS = {
  agriecoute: "https://agriecoute.fr/",
  msa: "https://www.msa.fr/lfp/contact/coordonnees-msa",
  chambres: "https://chambres-agriculture.fr/le-reseau-chambres/qui-sommes-nous/annuaire-des-chambres",
  solidaritePaysans: "https://solidaritepaysans.org/qui-sommes-nous/les-missions-du-reseau",
  ministere: "https://agriculture.gouv.fr/agriculteurs-en-difficulte-plusieurs-structures-daide-peuvent-vous-accompagner",
  urgence3114: "https://3114.fr/",
};

const CAISSES_MSA = [
  { codes: ["01", "69"], nom: "MSA Ain-Rhône", url: "https://ain-rhone.msa.fr/" },
  { codes: ["38", "73", "74"], nom: "MSA Alpes du Nord", url: "https://alpesdunord.msa.fr/" },
  { codes: ["04", "05", "84"], nom: "MSA Alpes-Vaucluse", url: "https://alpes-vaucluse.msa.fr/" },
  { codes: ["67", "68"], nom: "MSA Alsace", url: "https://alsace.msa.fr/" },
  { codes: ["07", "26", "42"], nom: "MSA Ardèche Drôme Loire", url: "https://ardechedromeloire.msa.fr/" },
  { codes: ["22", "29"], nom: "MSA d’Armorique", url: "https://armorique.msa.fr/" },
  { codes: ["03", "15", "43", "63"], nom: "MSA Auvergne", url: "https://auvergne.msa.fr/" },
  { codes: ["18", "28", "45"], nom: "MSA Beauce Cœur de Loire", url: "https://bcl.msa.fr/" },
  { codes: ["36", "37", "41"], nom: "MSA Berry-Touraine", url: "https://berry-touraine.msa.fr/" },
  { codes: ["21", "58", "71", "89"], nom: "MSA Bourgogne", url: "https://bourgogne.msa.fr/" },
  { codes: ["16", "17"], nom: "MSA des Charentes", url: "https://charentes.msa.fr/" },
  { codes: ["2A / 2B"], nom: "MSA de la Corse", url: "https://corse.msa.fr/" },
  { codes: ["14", "50"], nom: "MSA Côtes Normandes", url: "https://cotesnormandes.msa.fr/" },
  { codes: ["24", "47"], nom: "MSA Dordogne Lot-et-Garonne", url: "https://dlg.msa.fr/" },
  { codes: ["25", "39", "70", "90"], nom: "MSA Franche-Comté", url: "https://franchecomte.msa.fr/" },
  { codes: ["33"], nom: "MSA Gironde", url: "https://gironde.msa.fr/" },
  { codes: ["11", "66"], nom: "MSA Grand Sud", url: "https://grandsud.msa.fr/" },
  { codes: ["27", "76"], nom: "MSA Haute-Normandie", url: "https://hautenormandie.msa.fr/" },
  { codes: ["75", "77", "78", "91", "92", "93", "94", "95"], nom: "MSA Île-de-France", url: "https://iledefrance.msa.fr/" },
  { codes: ["30", "34", "48"], nom: "MSA du Languedoc", url: "https://languedoc.msa.fr/" },
  { codes: ["19", "23", "87"], nom: "MSA du Limousin", url: "https://limousin.msa.fr/" },
  { codes: ["44", "85"], nom: "MSA Loire-Atlantique Vendée", url: "https://loire-atlantique-vendee.msa.fr/" },
  { codes: ["54", "57", "88"], nom: "MSA Lorraine", url: "https://lorraine.msa.fr/" },
  { codes: ["49"], nom: "MSA Maine-et-Loire", url: "https://maineetloire.msa.fr/" },
  { codes: ["08", "51", "55"], nom: "MSA Marne Ardennes Meuse", url: "https://marne-ardennes-meuse.msa.fr/" },
  { codes: ["53", "61", "72"], nom: "MSA Mayenne-Orne-Sarthe", url: "https://mayenne-orne-sarthe.msa.fr/" },
  { codes: ["12", "46", "81", "82"], nom: "MSA Midi-Pyrénées Nord", url: "https://mpn.msa.fr/" },
  { codes: ["09", "31", "32", "65"], nom: "MSA Midi-Pyrénées Sud", url: "https://mps.msa.fr/" },
  { codes: ["59", "62"], nom: "MSA Nord-Pas de Calais", url: "https://nord-pasdecalais.msa.fr/" },
  { codes: ["02", "60", "80"], nom: "MSA Picardie", url: "https://picardie.msa.fr/" },
  { codes: ["79", "86"], nom: "MSA Poitou", url: "https://poitou.msa.fr/" },
  { codes: ["35", "56"], nom: "MSA Portes de Bretagne", url: "https://portesdebretagne.msa.fr/" },
  { codes: ["06", "13", "83"], nom: "MSA Provence-Azur", url: "https://provenceazur.msa.fr/" },
  { codes: ["40", "64"], nom: "MSA Sud Aquitaine", url: "https://sudaquitaine.msa.fr/" },
  { codes: ["10", "52"], nom: "MSA Sud Champagne", url: "https://sudchampagne.msa.fr/" },
] as const;

function extraireDepartement(adresse: string | null | undefined) {
  const codePostal = adresse?.match(/\b(?:0[1-9]|[1-8]\d|9[0-5]|97[1-6])\d{3}\b/)?.[0];
  if (!codePostal) return null;
  if (codePostal.startsWith("97")) return codePostal.slice(0, 3);
  if (codePostal.startsWith("20")) return "2A / 2B";
  return codePostal.slice(0, 2);
}

function trouverMsa(departement: string | null) {
  return departement ? CAISSES_MSA.find((caisse) => caisse.codes.some((code) => code === departement)) ?? null : null;
}

async function getLocalisation() {
  try {
    const config = await prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { adresse: true },
    });
    return { adresse: config?.adresse ?? null, departement: extraireDepartement(config?.adresse) };
  } catch {
    return { adresse: null, departement: null };
  }
}

function LienExterne({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-green-800 shadow-sm active:bg-gray-50">
      {children}<ExternalLink size={15} />
    </a>
  );
}

export default async function SoutienPage() {
  const localisation = await getLocalisation();
  const msa = trouverMsa(localisation.departement);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <header className="flex items-center gap-3">
        <BackButton className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 shadow" />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <HeartHandshake size={22} className="text-green-700" /> Soutien &amp; ressources
          </h1>
          <p className="text-sm text-gray-500">Parler, être accompagné ou aider un proche.</p>
        </div>
      </header>

      <section className="rounded-lg border-l-4 border-l-green-600 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <HandHeart size={22} className="mt-0.5 shrink-0 text-green-700" />
          <div>
            <h2 className="font-bold text-gray-900">Besoin de parler maintenant</h2>
            <p className="mt-1 text-sm text-gray-600">Des professionnels peuvent écouter, sans jugement, jour et nuit.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="tel:0969392919" className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 text-center font-bold text-white active:bg-green-800">
            <Phone size={19} /> Agri’Écoute · 09 69 39 29 19
          </a>
          <a href="tel:3114" className="flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-green-700 bg-white px-4 text-center font-bold text-green-800 active:bg-green-50">
            <Phone size={19} /> Prévention suicide · 3114
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-500">Agri’Écoute et le 3114 sont accessibles 24 h/24 et 7 j/7. Le 3114 est gratuit.</p>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <TriangleAlert size={21} className="mt-0.5 shrink-0 text-red-700" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-red-900">Danger immédiat</h2>
            <p className="mt-1 text-sm text-red-800">Si une personne risque de se faire du mal ou ne peut pas rester en sécurité, appelle les secours.</p>
            <div className="mt-3 flex gap-2">
              <a href="tel:15" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 px-3 font-bold text-white"><Phone size={18} /> SAMU 15</a>
              <a href="tel:112" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 px-3 font-bold text-white"><Phone size={18} /> Urgence 112</a>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MapPin size={21} className="mt-0.5 shrink-0 text-green-700" />
            <div>
              <h2 className="font-bold text-gray-900">Contacts proches de chez moi</h2>
              {localisation.departement ? (
                <p className="mt-0.5 text-sm text-gray-600">Département détecté : <strong>{localisation.departement}</strong></p>
              ) : (
                <p className="mt-0.5 text-sm text-orange-700">Département non détecté dans l’adresse de l’exploitation.</p>
              )}
            </div>
          </div>
          <Link href="/config/exploitation" className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-600">Corriger</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border border-gray-200 p-3">
            <Building2 size={19} className="text-green-700" />
            <h3 className="mt-2 font-bold text-gray-900">{msa?.nom ?? "Ma MSA"}</h3>
            <p className="mt-1 text-sm text-gray-600">Accompagnement social, santé, répit et cellule de prévention du mal-être.</p>
            <div className="mt-3"><LienExterne href={msa?.url ?? LIENS.msa}>{msa ? "Contacter ma MSA" : "Trouver ma caisse"}</LienExterne></div>
          </article>
          <article className="rounded-lg border border-gray-200 p-3">
            <Users size={19} className="text-green-700" />
            <h3 className="mt-2 font-bold text-gray-900">Solidarité Paysans</h3>
            <p className="mt-1 text-sm text-gray-600">Écoute et accompagnement humain, administratif, économique ou juridique.</p>
            <div className="mt-3"><LienExterne href={LIENS.solidaritePaysans}>Trouver une association</LienExterne></div>
          </article>
          <article className="rounded-lg border border-gray-200 p-3">
            <Building2 size={19} className="text-green-700" />
            <h3 className="mt-2 font-bold text-gray-900">Chambre d’agriculture</h3>
            <p className="mt-1 text-sm text-gray-600">Un interlocuteur local pour les difficultés professionnelles et l’accompagnement de l’exploitation.</p>
            <div className="mt-3"><LienExterne href={LIENS.chambres}>Ouvrir l’annuaire</LienExterne></div>
          </article>
          <article className="rounded-lg border border-gray-200 p-3">
            <HandHeart size={19} className="text-green-700" />
            <h3 className="mt-2 font-bold text-gray-900">Aides aux exploitants</h3>
            <p className="mt-1 text-sm text-gray-600">Dispositifs publics et structures pouvant accompagner une situation difficile.</p>
            <div className="mt-3"><LienExterne href={LIENS.ministere}>Voir les dispositifs</LienExterne></div>
          </article>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-gray-900"><Users size={20} className="text-green-700" /> Je m’inquiète pour quelqu’un</h2>
        <p className="mt-2 text-sm text-gray-600">Rester présent, écouter sans juger et proposer une aide professionnelle peut déjà compter. Le 3114 répond aussi aux proches qui cherchent comment aider.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="tel:3114" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green-700 px-4 text-sm font-bold text-white"><Phone size={17} /> Appeler le 3114</a>
          <LienExterne href={LIENS.urgence3114}>Conseils du 3114</LienExterne>
          <LienExterne href={LIENS.agriecoute}>AgriÉcoute en ligne</LienExterne>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <ShieldCheck size={18} className="shrink-0 text-green-700" />
        <p>Aucune consultation ni aucun appel n’est ajouté à l’historique de CESAM. Cette page oriente vers des professionnels, elle ne remplace pas un avis médical.</p>
      </div>
    </div>
  );
}
