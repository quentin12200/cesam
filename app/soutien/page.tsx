export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  Building2,
  ExternalLink,
  HandHeart,
  HeartHandshake,
  MapPin,
  Mail,
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

const ACTION_SOCIALE_MPN = {
  caisse: "MSA Midi-Pyrénées Nord",
  contactUrl: "https://mpn.msa.fr/lfp/contact-travailleurs-sociaux",
  aidesUrl: "https://mpn.msa.fr/lfp/prestations-extra-legales",
  accompagnementUrl: "https://mpn.msa.fr/lfp/soutien/accompagnement-proximite",
  email: "mpnass.blf@mpn.msa.fr",
  numeroSecours: "05 63 21 61 39",
};

function extraireNumeroActionSociale(html: string) {
  const texte = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
  const texteNormalise = texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const debut = texteNormalise.indexOf("service action sanitaire et sociale");
  if (debut === -1) return null;
  return texte.slice(debut, debut + 350).match(/0[1-9](?:[ .-]?\d{2}){4}/)?.[0]?.replace(/[.-]/g, " ") ?? null;
}

const chargerContactActionSocialeMpn = unstable_cache(
  async () => {
    try {
      const reponse = await fetch(ACTION_SOCIALE_MPN.contactUrl, { signal: AbortSignal.timeout(5000) });
      if (!reponse.ok) throw new Error("Source MSA indisponible");
      const numero = extraireNumeroActionSociale(await reponse.text());
      if (!numero) throw new Error("Numéro non trouvé");
      return { numero, actualiseDepuisMsa: true };
    } catch {
      return { numero: ACTION_SOCIALE_MPN.numeroSecours, actualiseDepuisMsa: false };
    }
  },
  ["contact-action-sociale-msa-mpn"],
  { revalidate: 60 * 60 * 24 * 7 },
);

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
  { codes: ["971"], nom: "CGSS Guadeloupe", url: "https://www.cgss-guadeloupe.fr/" },
  { codes: ["972"], nom: "CGSS Martinique", url: "https://cgss-martinique.fr/" },
  { codes: ["973"], nom: "CGSS Guyane", url: "https://www.cgss-guyane.fr/agriculteurs/" },
  { codes: ["974"], nom: "CGSS La Réunion", url: "https://www.cgss.re/" },
  { codes: ["975"], nom: "CPS Saint-Pierre-et-Miquelon", url: "https://www.secuspm.com/" },
  { codes: ["976"], nom: "CSS Mayotte", url: "https://www.cssm.fr/" },
] as const;

type ContactSocialMsa = {
  codes: readonly string[];
  numero: string;
  sourceUrl: string;
  aidesUrl: string;
  email?: string;
  ligneDirecte?: boolean;
};

const CONTACTS_SOCIAUX_MSA: ContactSocialMsa[] = [
  { codes: ["01", "69"], numero: "04 74 45 98 30", sourceUrl: "https://ain-rhone.msa.fr/lfp/472", aidesUrl: "https://ain-rhone.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["38"], numero: "04 76 88 76 20", sourceUrl: "https://alpesdunord.msa.fr/lfp/nous-contacter", aidesUrl: "https://alpesdunord.msa.fr/lfp/solidarite/ass/aides-exceptionnelles", ligneDirecte: true },
  { codes: ["73", "74"], numero: "04 79 62 89 21", sourceUrl: "https://alpesdunord.msa.fr/lfp/nous-contacter", aidesUrl: "https://alpesdunord.msa.fr/lfp/solidarite/ass/aides-exceptionnelles", ligneDirecte: true },
  { codes: ["04", "05", "84"], numero: "04 90 13 60 98", sourceUrl: "https://alpes-vaucluse.msa.fr/lfp/les-aides-financi%C3%A8res-de-la-msa-alpes-vaucluse", aidesUrl: "https://alpes-vaucluse.msa.fr/lfp/les-aides-financi%C3%A8res-de-la-msa-alpes-vaucluse", ligneDirecte: true },
  { codes: ["67", "68"], numero: "03 88 81 75 17", sourceUrl: "https://alsace.msa.fr/lfp/cpass", aidesUrl: "https://alsace.msa.fr/lfp/cpass", email: "actionsociale@alsace.msa.fr", ligneDirecte: true },
  { codes: ["07", "26", "42"], numero: "04 75 75 68 95", sourceUrl: "https://ardechedromeloire.msa.fr/lfp/comment-contacter-la-msa-adl", aidesUrl: "https://ardechedromeloire.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["22", "29"], numero: "02 98 85 79 79", sourceUrl: "https://armorique.msa.fr/lfp/action-sanitaire-et-sociale", aidesUrl: "https://armorique.msa.fr/lfp/action-sanitaire-et-sociale" },
  { codes: ["03", "15", "43", "63"], numero: "04 71 64 46 64", sourceUrl: "https://auvergne.msa.fr/lfp/action-sociale-msa-auvergne", aidesUrl: "https://auvergne.msa.fr/lfp/action-sociale-msa-auvergne", ligneDirecte: true },
  { codes: ["18", "28", "45"], numero: "02 37 99 99 99", sourceUrl: "https://bcl.msa.fr/lfp/le-service-social-specialise-de-la-msa-bcl", aidesUrl: "https://bcl.msa.fr/lfp/le-service-social-specialise-de-la-msa-bcl", email: "contactass.blf@bcl.msa.fr", ligneDirecte: true },
  { codes: ["36", "37", "41"], numero: "02 54 29 45 34", sourceUrl: "https://berry-touraine.msa.fr/lfp/contact-particulier", aidesUrl: "https://berry-touraine.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["21", "58", "71", "89"], numero: "03 80 63 22 73", sourceUrl: "https://bourgogne.msa.fr/lfp/contact-partenaire-de-l-action-sociale", aidesUrl: "https://bourgogne.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["16", "17"], numero: "05 46 97 50 50", sourceUrl: "https://charentes.msa.fr/lfp/demande-aides-autonomie", aidesUrl: "https://charentes.msa.fr/lfp/action-sociale", email: "tech.ass@charentes.msa.fr" },
  { codes: ["2A / 2B"], numero: "04 95 29 27 26", sourceUrl: "https://corse.msa.fr/lfp/prestations-et-actions-msa-corse", aidesUrl: "https://corse.msa.fr/lfp/prestations-et-actions-msa-corse", email: "ass.blf@msa20.msa.fr", ligneDirecte: true },
  { codes: ["14", "50"], numero: "02 31 25 38 80", sourceUrl: "https://cotesnormandes.msa.fr/lfp/l-action-sociale-en-faveur-des-jeunes1", aidesUrl: "https://cotesnormandes.msa.fr/lfp/formulaires-action-sanitaire-et-sociale-msa-cotes-normandes" },
  { codes: ["24", "47"], numero: "05 53 67 78 47", sourceUrl: "https://dlg.msa.fr/lfp/vos-interlocuteurs-en-msa-dlg", aidesUrl: "https://dlg.msa.fr/lfp/action-sociale", email: "contact_ass.blf@dlg.msa.fr", ligneDirecte: true },
  { codes: ["25", "39", "70", "90"], numero: "03 84 96 31 01", sourceUrl: "https://franchecomte.msa.fr/lfp/la-bourse-solidarite-vacances", aidesUrl: "https://franchecomte.msa.fr/lfp/ass", ligneDirecte: true },
  { codes: ["33"], numero: "05 57 98 25 10", sourceUrl: "https://gironde.msa.fr/lfp/action-sociale", aidesUrl: "https://gironde.msa.fr/lfp/action-sociale", email: "accueilsocial.blf@msa33.msa.fr", ligneDirecte: true },
  { codes: ["11", "66"], numero: "04 68 55 11 66", sourceUrl: "https://grandsud.msa.fr/lfp/dncb-la-msa-aux-cotes-des-eleveurs", aidesUrl: "https://grandsud.msa.fr/lfp/action-sociale", email: "asd.blf@grandsud.msa.fr", ligneDirecte: true },
  { codes: ["27", "76"], numero: "02 35 600 600", sourceUrl: "https://hautenormandie.msa.fr/lfp/l-action-sociale-en-haute-normandie", aidesUrl: "https://hautenormandie.msa.fr/lfp/l-action-sociale-en-haute-normandie" },
  { codes: ["75", "77", "78", "91", "92", "93", "94", "95"], numero: "01 30 63 88 80", sourceUrl: "https://iledefrance.msa.fr/lfp/famille/aide-poursuite-etudes", aidesUrl: "https://iledefrance.msa.fr/lfp/action-sociale" },
  { codes: ["30", "34", "48"], numero: "04 99 58 30 00", sourceUrl: "https://languedoc.msa.fr/lfp/contact-partenaire-action-sociale", aidesUrl: "https://languedoc.msa.fr/lfp/action-sociale" },
  { codes: ["19", "23", "87"], numero: "05 44 00 04 04", sourceUrl: "https://limousin.msa.fr/lfp/agri-ecoute-un-numero-d-ecoute-en-cas-de-detresse", aidesUrl: "https://limousin.msa.fr/lfp/action-sociale" },
  { codes: ["44", "85"], numero: "02 40 41 39 94", sourceUrl: "https://loire-atlantique-vendee.msa.fr/lfp/contact-particulier", aidesUrl: "https://loire-atlantique-vendee.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["54", "57", "88"], numero: "03 83 50 35 20", sourceUrl: "https://lorraine.msa.fr/lfp/contacter-la-msa-lorraine", aidesUrl: "https://lorraine.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["49"], numero: "02 41 31 75 85", sourceUrl: "https://maineetloire.msa.fr/lfp/soutien/aide-au-repit-burnout", aidesUrl: "https://maineetloire.msa.fr/lfp/plan-d-action-sanitaire-et-sociale", email: "ass.grprec@msa49.msa.fr", ligneDirecte: true },
  { codes: ["08", "51", "55"], numero: "03 26 40 80 17", sourceUrl: "https://marne-ardennes-meuse.msa.fr/lfp/accompagnement-agriculteurs-en-difficulte", aidesUrl: "https://marne-ardennes-meuse.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["53", "72"], numero: "02 43 39 81 45", sourceUrl: "https://mayenne-orne-sarthe.msa.fr/lfp/le-departement-action-sanitaire-et-sociale-de-la-msa", aidesUrl: "https://mayenne-orne-sarthe.msa.fr/lfp/notre-action-sociale", ligneDirecte: true },
  { codes: ["61"], numero: "02 33 31 41 71", sourceUrl: "https://mayenne-orne-sarthe.msa.fr/lfp/le-departement-action-sanitaire-et-sociale-de-la-msa", aidesUrl: "https://mayenne-orne-sarthe.msa.fr/lfp/notre-action-sociale", ligneDirecte: true },
  { codes: ["12", "46", "81", "82"], numero: "05 63 21 61 39", sourceUrl: "https://mpn.msa.fr/lfp/contact-travailleurs-sociaux", aidesUrl: "https://mpn.msa.fr/lfp/prestations-extra-legales", email: "mpnass.blf@mpn.msa.fr", ligneDirecte: true },
  { codes: ["09", "31", "32", "65"], numero: "05 61 10 40 40", sourceUrl: "https://mps.msa.fr/lfp/l-aide-au-repit-pour-epuisement-professionnel-de-la-msa-midi-pyrenees-sud", aidesUrl: "https://mps.msa.fr/lfp/prendre-en-charge-les-situations", ligneDirecte: true },
  { codes: ["59", "62"], numero: "03 20 00 21 68", sourceUrl: "https://nord-pasdecalais.msa.fr/lfp/action-sociale", aidesUrl: "https://nord-pasdecalais.msa.fr/lfp/famille-logement", email: "actionsociale@msa59-62.msa.fr", ligneDirecte: true },
  { codes: ["02", "60", "80"], numero: "03 22 80 60 02", sourceUrl: "https://picardie.msa.fr/lfp/action-sociale", aidesUrl: "https://picardie.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["79"], numero: "05 49 44 56 19", sourceUrl: "https://poitou.msa.fr/lfp/service-social-msa-poitou", aidesUrl: "https://poitou.msa.fr/lfp/service-social-msa-poitou", email: "secretariat_ass.blf@poitou.msa.fr", ligneDirecte: true },
  { codes: ["86"], numero: "05 49 43 86 85", sourceUrl: "https://poitou.msa.fr/lfp/service-social-msa-poitou", aidesUrl: "https://poitou.msa.fr/lfp/service-social-msa-poitou", email: "secretariat_ass.blf@poitou.msa.fr", ligneDirecte: true },
  { codes: ["35", "56"], numero: "02 97 46 56 38", sourceUrl: "https://portesdebretagne.msa.fr/lfp", aidesUrl: "https://portesdebretagne.msa.fr/lfp/action-sanitaire-et-sociale", email: "secretariatass.blf@portesdebretagne.msa.fr", ligneDirecte: true },
  { codes: ["06", "13", "83"], numero: "04 91 16 58 39", sourceUrl: "https://provenceazur.msa.fr/lfp/action-sociale", aidesUrl: "https://provenceazur.msa.fr/lfp/action-sociale", email: "msapa_actionsociale.blf@provence-azur.msa.fr", ligneDirecte: true },
  { codes: ["40", "64"], numero: "05 58 06 54 76", sourceUrl: "https://sudaquitaine.msa.fr/lfp/aides-social-vacances", aidesUrl: "https://sudaquitaine.msa.fr/lfp/famille-logement" },
  { codes: ["10", "52"], numero: "03 25 30 26 48", sourceUrl: "https://sudchampagne.msa.fr/lfp/contact-particulier", aidesUrl: "https://sudchampagne.msa.fr/lfp/action-sociale", ligneDirecte: true },
  { codes: ["971"], numero: "05 90 93 45 11", sourceUrl: "https://www.cgss-guadeloupe.fr/17-prevention-sante-sociale/44-service-social.html", aidesUrl: "https://www.cgss-guadeloupe.fr/17-prevention-sante-sociale/44-service-social.html", ligneDirecte: true },
  { codes: ["972"], numero: "05 96 66 51 55", sourceUrl: "https://cgss-martinique.fr/contactez-la-cgss-martinique/action-sociale/", aidesUrl: "https://cgss-martinique.fr/contactez-la-cgss-martinique/action-sociale/", email: "gsc@cgss-martinique.fr", ligneDirecte: true },
  { codes: ["973"], numero: "36 46", sourceUrl: "https://www.cgss-guyane.fr/nous-contacter/contact-agriculteurs/", aidesUrl: "https://www.cgss-guyane.fr/agriculteurs/soutien-aux-agriculteurs/le-pass-agri/" },
  { codes: ["974"], numero: "02 62 40 33 25", sourceUrl: "https://www.cgss.re/actualites/modalites-daccueil-du-public-exceptionnelles", aidesUrl: "https://www.cgss.re/", email: "info.nsa@cgss.re" },
  { codes: ["975"], numero: "05 08 41 15 70", sourceUrl: "https://www.secuspm.com/index.php/fr/la-cps/nos-horaires", aidesUrl: "https://www.secuspm.com/", email: "accueil.cps@secuspm.com" },
  { codes: ["976"], numero: "02 69 61 91 91", sourceUrl: "https://www.cssm.fr/page/accueil", aidesUrl: "https://www.cssm.fr/page/accueil", email: "social@css-mayotte.fr", ligneDirecte: true },
];

function extraireDepartement(adresse: string | null | undefined) {
  const codePostal = adresse?.match(/\b(?:97[1-6]\d{2}|(?:0[1-9]|[1-8]\d|9[0-5])\d{3})\b/)?.[0];
  if (!codePostal) return null;
  if (codePostal.startsWith("97")) return codePostal.slice(0, 3);
  if (codePostal.startsWith("20")) return "2A / 2B";
  return codePostal.slice(0, 2);
}

function trouverMsa(departement: string | null) {
  return departement ? CAISSES_MSA.find((caisse) => caisse.codes.some((code) => code === departement)) ?? null : null;
}

function trouverContactSocial(departement: string | null) {
  return departement
    ? CONTACTS_SOCIAUX_MSA.find((contact) => contact.codes.includes(departement)) ?? null
    : null;
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
  const contactSocial = trouverContactSocial(localisation.departement);
  const contactActionSociale = contactSocial
    ? msa?.nom === ACTION_SOCIALE_MPN.caisse
      ? await chargerContactActionSocialeMpn()
      : { numero: contactSocial.numero, actualiseDepuisMsa: false }
    : null;

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
          <article className={`rounded-lg border border-gray-200 p-3 ${contactActionSociale ? "sm:col-span-2" : ""}`}>
            <Building2 size={19} className="text-green-700" />
            <h3 className="mt-2 font-bold text-gray-900">{msa?.nom ?? "Ma MSA"}</h3>
            {contactActionSociale ? (
              <>
                <p className="mt-1 text-sm text-gray-600">
                  Des travailleurs sociaux vous écoutent en toute confidentialité, font le point avec vous et cherchent des solutions adaptées aux difficultés personnelles, familiales, administratives, financières ou professionnelles.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <a href={`tel:${contactActionSociale.numero.replace(/\s/g, "")}`} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 text-center font-bold text-white active:bg-green-800">
                    <Phone size={19} /> {contactSocial?.ligneDirecte ? "Action sociale" : "Accueil MSA"} · {contactActionSociale.numero}
                  </a>
                  {contactSocial?.email ? (
                    <a href={`mailto:${contactSocial.email}`} className="flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-green-700 bg-white px-4 text-center font-semibold text-green-800 active:bg-green-50">
                      <Mail size={18} /> Écrire au service social
                    </a>
                  ) : (
                    <LienExterne href={contactSocial?.sourceUrl ?? msa?.url ?? LIENS.msa}>Contacter ce service</LienExterne>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-800">Ce service peut notamment aider pour :</p>
                <p className="mt-1 text-sm text-gray-600">épuisement et besoin de répit, difficultés financières ou administratives, maladie ou accident, séparation, deuil, accès aux droits et orientation vers le bon interlocuteur.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LienExterne href={contactSocial?.aidesUrl ?? msa?.url ?? LIENS.msa}>Voir les aides de ma MSA</LienExterne>
                  <LienExterne href={contactSocial?.sourceUrl ?? msa?.url ?? LIENS.msa}>Voir la source officielle</LienExterne>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Coordonnées vérifiées sur le site officiel de la caisse. {contactSocial?.ligneDirecte ? "Ligne directe du service social." : "Accueil officiel à utiliser pour demander le service social."} {contactActionSociale.actualiseDepuisMsa ? "Numéro recontrôlé automatiquement cette semaine." : ""}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-600">Accompagnement social, santé, répit et cellule de prévention du mal-être.</p>
                <div className="mt-3"><LienExterne href={msa?.url ?? LIENS.msa}>{msa ? "Contacter ma MSA" : "Trouver ma caisse"}</LienExterne></div>
                {msa && <p className="mt-2 text-xs text-gray-500">Le numéro direct du service social de cette caisse n’est pas encore vérifié dans CESAM.</p>}
              </>
            )}
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

