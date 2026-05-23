export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";
import Link from "next/link";
import {
  Cow,
  Baby,
  Wifi,
  AlertTriangle,
  Syringe,
  RefreshCw,
  Tag,
  Scissors,
  Activity,
  CalendarCheck,
  Search,
} from "lucide-react";

async function getDashboardData() {
  const now = new Date();
  const sevenDaysLater = addDays(now, 7);
  const thirtyDaysLater = addDays(now, 30);
  const ninetyDaysLater = addDays(now, 90);
  const twentyOneDaysLater = addDays(now, 21);
  const sixMonthsAgo = addDays(now, -180);

  const [
    vachesActives,
    veauxActifs,
    capteurs,
    vachesAvecSaillies,
    veauxPourVaccins,
    veauxNonBoucles,
    evenementsSanitairesUrgents,
    velagesSemaine,
    velagesPrevus,
    vaccinationPreVelage,
    veauxASevrer,
  ] = await Promise.all([
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", velageVeau: { is: null } } }),
    prisma.animal.count({ where: { statut: "ACTIF", OR: [{ sexbov: "M" }, { estGenisse: true }] } }),
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    prisma.animal.findMany({
      where: { statut: "ACTIF", sexbov: "F", estGenisse: false },
      include: {
        saillies: {
          orderBy: { date: "desc" },
          take: 1,
          include: { gestation: true },
        },
        velagesVache: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: {
        vaccinations: { select: { vaccin: true, date: true } },
      },
    }),
    prisma.animal.count({
      where: {
        statut: "ACTIF",
        boucleFaite: false,
        velageVeau: { isNot: null },
      },
    }),
    prisma.evenementSanitaire.count({ where: { resolu: false } }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: now, lte: sevenDaysLater },
      },
    }),
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: now, lte: thirtyDaysLater },
      },
    }),
    // Gestations dans la fenêtre vaccins pré-vélage (J-21 à J-90)
    prisma.gestation.count({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: { gte: twentyOneDaysLater, lte: ninetyDaysLater },
      },
    }),
    // Veaux ≥6 mois encore actifs (à sevrer)
    prisma.animal.count({
      where: {
        statut: "ACTIF",
        velageVeau: { isNot: null },
        danais: { lte: sixMonthsAgo },
      },
    }),
  ]);

  let vachesPleine = 0;
  let aEchographier = 0;
  let vachesVidesEnRetard = 0;

  for (const vache of vachesAvecSaillies) {
    const derniereSaillie = vache.saillies[0]?.date ?? null;
    const gestation = vache.saillies[0]?.gestation ?? null;
    const dateVelagePrevue = gestation?.dateVelagePrevue ?? null;
    const etatGestation = gestation?.etat ?? null;
    const dernierVelage = vache.velagesVache[0]?.date ?? null;

    const etat = getEtatGestation(
      derniereSaillie,
      etatGestation,
      dateVelagePrevue,
      dernierVelage
    );

    if (etat === "VERT" || etat === "ROSE") vachesPleine++;
    if (etat === "JAUNE") aEchographier++;
    if (etat === "ROUGE") vachesVidesEnRetard++;
  }

  let veauxAVacciner = 0;
  for (const animal of veauxPourVaccins) {
    const ageJours = differenceInDays(now, animal.danais);
    if (ageJours <= 365 * 2) {
      const vaccinsManquants = getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
      );
      if (vaccinsManquants.length > 0) veauxAVacciner++;
    }
  }

  const pctPleine = vachesActives > 0 ? Math.round((vachesPleine / vachesActives) * 100) : 0;

  return {
    vachesActives,
    veauxActifs,
    capteurs,
    vachesPleine,
    pctPleine,
    aEchographier,
    veauxAVacciner,
    velagesPrevus,
    velagesSemaine,
    vachesVidesEnRetard,
    veauxNonBoucles,
    veauxASevrer,
    evenementsSanitairesUrgents,
    vaccinationPreVelage,
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();
  const capteursActifs = data.capteurs.filter((c) => c.actif);

  const hasAlertesJour =
    data.vachesVidesEnRetard > 0 ||
    data.evenementsSanitairesUrgents > 0 ||
    data.veauxNonBoucles > 0 ||
    data.vaccinationPreVelage > 0 ||
    data.aEchographier > 0 ||
    data.veauxAVacciner > 0;

  const hasAlertesHebdo = data.velagesSemaine > 0 || data.veauxASevrer > 0;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Recherche rapide */}
      <form action="/troupeau" method="GET" className="relative mt-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          name="q"
          placeholder="Trouver un animal (N° ou nom)..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </form>
      <h2 className="text-xl font-bold text-gray-800 mt-2">Tableau de bord</h2>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-full p-2">
            <Cow size={24} className="text-green-700" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{data.vachesActives}</div>
            <div className="text-xs text-gray-500">Vaches actives</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
          <div className="bg-blue-100 rounded-full p-2">
            <Baby size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{data.veauxActifs}</div>
            <div className="text-xs text-gray-500">Veaux & génisses</div>
          </div>
        </div>
      </div>

      {/* CE QUE JE DOIS FAIRE AUJOURD'HUI */}
      {hasAlertesJour && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Ce que je dois faire aujourd&apos;hui
          </h3>
          <div className="space-y-2">
            {data.vachesVidesEnRetard > 0 && (
              <Link
                href="/reproduction?filtre=ROUGE"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Vaches vides en retard</span>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.vachesVidesEnRetard}
                </span>
              </Link>
            )}
            {data.evenementsSanitairesUrgents > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Interventions sanitaires urgentes</span>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.evenementsSanitairesUrgents}
                </span>
              </Link>
            )}
            {data.veauxNonBoucles > 0 && (
              <Link
                href="/animaux"
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  data.veauxNonBoucles >= 15
                    ? "bg-red-50 border-red-200"
                    : "bg-orange-50 border-orange-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Tag
                    size={16}
                    className={data.veauxNonBoucles >= 15 ? "text-red-600" : "text-orange-600"}
                  />
                  <span
                    className={`text-sm font-medium ${
                      data.veauxNonBoucles >= 15 ? "text-red-800" : "text-orange-800"
                    }`}
                  >
                    Veaux non bouclés
                  </span>
                </div>
                <span
                  className={`text-white text-xs font-bold px-2 py-1 rounded-full ${
                    data.veauxNonBoucles >= 15 ? "bg-red-600" : "bg-orange-500"
                  }`}
                >
                  {data.veauxNonBoucles}
                </span>
              </Link>
            )}
            {data.vaccinationPreVelage > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center gap-2">
                  <Syringe size={16} className="text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    Vaccins pré-vélage (Crypto / Rotavec)
                  </span>
                </div>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.vaccinationPreVelage}
                </span>
              </Link>
            )}
            {data.aEchographier > 0 && (
              <Link
                href="/reproduction"
                className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Vaches à échographier</span>
                </div>
                <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                  {data.aEchographier}
                </span>
              </Link>
            )}
            {data.veauxAVacciner > 0 && (
              <Link
                href="/sanitaire"
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <Syringe size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Veaux à vacciner</span>
                </div>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.veauxAVacciner}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Focus hebdomadaire J+7 */}
      {hasAlertesHebdo && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarCheck size={18} className="text-blue-500" />
            Cette semaine (J+7)
          </h3>
          <div className="space-y-2">
            {data.velagesSemaine > 0 && (
              <Link
                href="/velage"
                className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200"
              >
                <div className="flex items-center gap-2">
                  <Baby size={16} className="text-pink-600" />
                  <span className="text-sm font-medium text-pink-800">Vélages prévus cette semaine</span>
                </div>
                <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.velagesSemaine}
                </span>
              </Link>
            )}
            {data.veauxASevrer > 0 && (
              <Link
                href="/animaux"
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
              >
                <div className="flex items-center gap-2">
                  <Scissors size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Veaux à sevrer (≥ 6 mois)</span>
                </div>
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.veauxASevrer}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats rapides */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Stats rapides</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{data.pctPleine}%</div>
            <div className="text-xs text-gray-600 mt-1">Vaches pleines</div>
            <div className="text-xs text-gray-400">
              {data.vachesPleine} / {data.vachesActives}
            </div>
          </div>
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <div className="text-2xl font-bold text-pink-600">{data.velagesPrevus}</div>
            <div className="text-xs text-gray-600 mt-1">Vélages prévus</div>
            <div className="text-xs text-gray-400">30 prochains jours</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{data.aEchographier}</div>
            <div className="text-xs text-gray-600 mt-1">À échographier</div>
            <div className="text-xs text-gray-400">Saillies 35-45j</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.veauxAVacciner}</div>
            <div className="text-xs text-gray-600 mt-1">Vaccins en retard</div>
            <div className="text-xs text-gray-400">Protocoles</div>
          </div>
        </div>
      </div>

      {/* Capteurs */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Wifi size={18} className="text-green-700" />
          Capteurs vélage
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {data.capteurs.map((capteur) => (
            <div
              key={capteur.id}
              className={`p-3 rounded-lg border ${
                capteur.actif ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Capteur {capteur.numero}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    capteur.actif ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                  }`}
                >
                  {capteur.actif ? "ACTIF" : "LIBRE"}
                </span>
              </div>
              {capteur.actif && capteur.animalNom && (
                <div className="text-xs text-gray-600 mt-1">
                  {capteur.animalNom} - {capteur.animalNutrav}
                </div>
              )}
              {capteur.actif && capteur.dateAttribution && (
                <div className="text-xs text-gray-400">
                  Depuis le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          {capteursActifs.length} capteur{capteursActifs.length > 1 ? "s" : ""} actif
          {capteursActifs.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
