export type ContactReagir = {
  departements: string[];
  nom: string;
  telephone: string;
  email?: string;
  precision?: string;
  sourceUrl: string;
};

export const CONTACTS_REAGIR: ContactReagir[] = [
  { departements: ["82"], nom: "Point d’accueil des agriculteurs fragilisés", telephone: "05 63 63 93 62", email: "accueil82@agri82.fr", precision: "Chambre d’agriculture de Tarn-et-Garonne", sourceUrl: "https://www.tarn-et-garonne.gouv.fr/Actions-de-l-Etat/Agriculture/Accompagnement-des-agriculteurs-en-difficulte" },
  { departements: ["12"], nom: "Agriculteurs fragilisés", telephone: "05 65 73 78 20", precision: "Secrétariat conseil d’entreprise de l’Aveyron", sourceUrl: "https://www.aveyron.gouv.fr/Actions-de-l-Etat/Agriculture-et-foret/Aides-conjoncturelles-Calamites-agricoles-et-Agriculteurs-fragilises/IDENTIFICATION-ET-ACCOMPAGNEMENT-DES-EXPLOITANTS-AGRICOLES-EN-DIFFICULTE" },
  { departements: ["22"], nom: "Cellule RÉAGIR 22", telephone: "07 60 42 23 69", email: "Reagir22@bretagne.chambagri.fr", sourceUrl: "https://bretagne.chambres-agriculture.fr/detail-actu/temoignage-dun-agriculteur-face-a-ladversite-soutenu-par-le-dispositif-reagir" },
  { departements: ["29"], nom: "Cellule RÉAGIR 29", telephone: "06 73 66 55 79", email: "Reagir29@bretagne.chambagri.fr", sourceUrl: "https://bretagne.chambres-agriculture.fr/detail-actu/temoignage-dun-agriculteur-face-a-ladversite-soutenu-par-le-dispositif-reagir" },
  { departements: ["35"], nom: "Cellule RÉAGIR 35", telephone: "07 88 40 77 85", email: "Reagir35@bretagne.chambagri.fr", sourceUrl: "https://bretagne.chambres-agriculture.fr/detail-actu/temoignage-dun-agriculteur-face-a-ladversite-soutenu-par-le-dispositif-reagir" },
  { departements: ["56"], nom: "Cellule RÉAGIR 56", telephone: "06 30 98 17 40", email: "Reagir56@bretagne.chambagri.fr", sourceUrl: "https://bretagne.chambres-agriculture.fr/detail-actu/temoignage-dun-agriculteur-face-a-ladversite-soutenu-par-le-dispositif-reagir" },
  { departements: ["04"], nom: "Agriculteurs fragilisés", telephone: "06 33 40 55 09", email: "sbougerol@ahp.chambagri.fr", precision: "Sébastien Bougerol", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["05"], nom: "Agriculteurs fragilisés", telephone: "07 89 20 47 06", email: "sophie.simiand@hautes-alpes.chambagri.fr", precision: "Sophie Simiand", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["06"], nom: "Agriculteurs fragilisés", telephone: "06 28 79 67 65", email: "pperrot@alpes-maritimes.chambagri.fr", precision: "Philippe Perrot", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["13"], nom: "Agriculteurs fragilisés", telephone: "06 89 07 20 05", email: "e.colliot@bouches-du-rhone.chambagri.fr", precision: "Étienne Colliot", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["83"], nom: "Agriculteurs fragilisés", telephone: "06 14 52 08 76", email: "marc.hofmann@var.chambagri.fr", precision: "Marc Hofmann", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["84"], nom: "Agriculteurs fragilisés", telephone: "06 58 44 25 87", email: "pascal.invernon@vaucluse.chambagri.fr", precision: "Pascal Invernon", sourceUrl: "https://paca.chambres-agriculture.fr/nos-services/vous-etes-agriculteur/agriculteurs-fragilises/" },
  { departements: ["30"], nom: "Cellule RÉAGIR du Gard", telephone: "08 00 10 03 62", email: "reagir@languedoc.msa.fr", precision: "Contact confidentiel", sourceUrl: "https://gard.chambres-agriculture.fr/fileadmin/user_upload/235_chambre_dagriculture_du_gard/Images/INSTALLATION_TRANSMISSION/PAI_PAT_RELANCE/REAGIR_Fiche_signalement_AED_janvier_2024.pdf" },
  { departements: ["66"], nom: "Cellule agriculteurs en difficulté", telephone: "04 68 35 87 82", precision: "Stéphane Africano", sourceUrl: "https://po.chambres-agriculture.fr/les-dossiers/detail-du-dossier/procedure-calamite-agricole" },
  { departements: ["75", "77", "78", "91", "92", "93", "94", "95"], nom: "Pôle RÉAGIR – Solidarité & Accompagnement", telephone: "01 39 23 42 00", precision: "Chambre d’agriculture de région Île-de-France", sourceUrl: "https://idf.chambres-agriculture.fr/etre-accompagne/je-suis-agriculteur/sinstaller-en-agriculture" },
];

export const DEPARTEMENTS = [
  ["01", "Ain"], ["02", "Aisne"], ["03", "Allier"], ["04", "Alpes-de-Haute-Provence"], ["05", "Hautes-Alpes"], ["06", "Alpes-Maritimes"], ["07", "Ardèche"], ["08", "Ardennes"], ["09", "Ariège"], ["10", "Aube"], ["11", "Aude"], ["12", "Aveyron"], ["13", "Bouches-du-Rhône"], ["14", "Calvados"], ["15", "Cantal"], ["16", "Charente"], ["17", "Charente-Maritime"], ["18", "Cher"], ["19", "Corrèze"], ["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"], ["21", "Côte-d’Or"], ["22", "Côtes-d’Armor"], ["23", "Creuse"], ["24", "Dordogne"], ["25", "Doubs"], ["26", "Drôme"], ["27", "Eure"], ["28", "Eure-et-Loir"], ["29", "Finistère"], ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"], ["33", "Gironde"], ["34", "Hérault"], ["35", "Ille-et-Vilaine"], ["36", "Indre"], ["37", "Indre-et-Loire"], ["38", "Isère"], ["39", "Jura"], ["40", "Landes"], ["41", "Loir-et-Cher"], ["42", "Loire"], ["43", "Haute-Loire"], ["44", "Loire-Atlantique"], ["45", "Loiret"], ["46", "Lot"], ["47", "Lot-et-Garonne"], ["48", "Lozère"], ["49", "Maine-et-Loire"], ["50", "Manche"], ["51", "Marne"], ["52", "Haute-Marne"], ["53", "Mayenne"], ["54", "Meurthe-et-Moselle"], ["55", "Meuse"], ["56", "Morbihan"], ["57", "Moselle"], ["58", "Nièvre"], ["59", "Nord"], ["60", "Oise"], ["61", "Orne"], ["62", "Pas-de-Calais"], ["63", "Puy-de-Dôme"], ["64", "Pyrénées-Atlantiques"], ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"], ["67", "Bas-Rhin"], ["68", "Haut-Rhin"], ["69", "Rhône"], ["70", "Haute-Saône"], ["71", "Saône-et-Loire"], ["72", "Sarthe"], ["73", "Savoie"], ["74", "Haute-Savoie"], ["75", "Paris"], ["76", "Seine-Maritime"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["79", "Deux-Sèvres"], ["80", "Somme"], ["81", "Tarn"], ["82", "Tarn-et-Garonne"], ["83", "Var"], ["84", "Vaucluse"], ["85", "Vendée"], ["86", "Vienne"], ["87", "Haute-Vienne"], ["88", "Vosges"], ["89", "Yonne"], ["90", "Territoire de Belfort"], ["91", "Essonne"], ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"], ["95", "Val-d’Oise"], ["971", "Guadeloupe"], ["972", "Martinique"], ["973", "Guyane"], ["974", "La Réunion"], ["976", "Mayotte"],
] as const;

export const ANNUAIRE_CHAMBRES = "https://chambres-agriculture.fr/le-reseau-chambres/qui-sommes-nous/annuaire-des-chambres";

export function trouverContactReagir(departement: string) {
  return CONTACTS_REAGIR.find((contact) => contact.departements.includes(departement)) ?? null;
}
