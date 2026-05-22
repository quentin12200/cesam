import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import { getEtatGestation, getVaccinsManquants } from "@/lib/utils";
import Link from "next/link";
import { Beef, Baby, Wifi, AlertTriangle, Syringe, RefreshCw } from "lucide-react";

async function getDashboardData() {
  const now = new Date();

  const [
    vachesActives,
    veauxActifs,
    capteurs,
    vachesAvecSaillies,
    veauxPourVaccins,
  ] = await Promise.all([
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "F", estGenisse: false } }),
    prisma.animal.count({ where: { statut: "ACTIF", sexbov: "M" } }),
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
  ]);

  // Comptage états gestation
  let vachesPleine = 0;
  let aEchographier = 0;

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
  }

  // Veaux à vacciner
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

  // Vélages prévus dans 30 jours
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const velagesPrevus = await prisma.gestation.count({
    where: {
      etat: { in: ["VERT", "ROSE"] },
      dateVelagePrevue: {
        gte: now,
        lte: thirtyDaysLater,
      },
    },
  });

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
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();
  const capteursActifs = data.capteurs.filter((c) => c.actif);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mt-2">Tableau de bord</h2>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-full p-2">
            <Beef size={24} className="text-green-700" />
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
            <div className="text-xs text-gray-500">Veaux actifs</div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(data.aEchographier > 0 || data.veauxAVacciner > 0) && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-500" />
            À faire aujourd&apos;hui
          </h3>
          <div className="space-y-2">
            {data.aEchographier > 0 && (
              <Link href="/reproduction" className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Vaches à échographier</span>
                </div>
                <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">{data.aEchographier}</span>
              </Link>
            )}
            {data.veauxAVacciner > 0 && (
              <Link href="/sanitaire" className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <Syringe size={16} className="text-red-600" />
                  <span className="text-sm font-medium text-red-800">Veaux à vacciner</span>
                </div>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{data.veauxAVacciner}</span>
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
            <div className="text-xs text-gray-400">{data.vachesPleine} / {data.vachesActives}</div>
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
              className={`p-3 rounded-lg border ${capteur.actif ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Capteur {capteur.numero}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${capteur.actif ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>
                  {capteur.actif ? "ACTIF" : "LIBRE"}
                </span>
              </div>
              {capteur.actif && capteur.animalNom && (
                <div className="text-xs text-gray-600 mt-1">{capteur.animalNom} - {capteur.animalNutrav}</div>
              )}
              {capteur.actif && capteur.dateAttribution && (
                <div className="text-xs text-gray-400">Depuis le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          {capteursActifs.length} capteur{capteursActifs.length > 1 ? "s" : ""} actif{capteursActifs.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
