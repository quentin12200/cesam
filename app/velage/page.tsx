import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { Wifi, Baby, WifiOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import VelageFormWrapper from "./VelageFormWrapper";

async function getVelageData() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [capteurs, gestationsPrevues, velagesRecents] = await Promise.all([
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE"] },
        dateVelagePrevue: {
          gte: now,
          lte: in30Days,
        },
        velage: null, // pas encore vêlé
      },
      include: {
        saillie: {
          include: {
            animal: { select: { id: true, nutrav: true, nobovi: true, danais: true } },
          },
        },
      },
      orderBy: { dateVelagePrevue: "asc" },
    }),
    prisma.velage.findMany({
      where: {
        date: {
          gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        vache: { select: { nutrav: true, nobovi: true } },
        veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  return { capteurs, gestationsPrevues, velagesRecents };
}

export default async function VelagePage() {
  const { capteurs, gestationsPrevues, velagesRecents } = await getVelageData();
  const now = new Date();

  const capteursActifs = capteurs.filter((c) => c.actif);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Vélage</h2>
      </div>

      {/* Capteurs */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Wifi size={16} className="text-green-700" />
          Capteurs vélage
          <span className="text-xs text-gray-400 ml-auto">{capteursActifs.length}/4 actifs</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {capteurs.map((capteur) => (
            <div
              key={capteur.id}
              className={`p-3 rounded-xl border-2 ${capteur.actif ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-700">Capteur {capteur.numero}</span>
                {capteur.actif ? (
                  <Wifi size={16} className="text-green-600" />
                ) : (
                  <WifiOff size={16} className="text-gray-400" />
                )}
              </div>
              {capteur.actif ? (
                <>
                  <div className="text-sm font-medium text-green-800">{capteur.animalNom ?? capteur.animalNutrav ?? "Animal inconnu"}</div>
                  {capteur.animalNutrav && capteur.animalNom && (
                    <div className="text-xs text-green-600 font-mono">{capteur.animalNutrav}</div>
                  )}
                  {capteur.dateAttribution && (
                    <div className="text-xs text-gray-400 mt-1">Depuis le {formatDate(capteur.dateAttribution)}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-400">Disponible</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Formulaire vélage rapide */}
      <VelageFormWrapper />

      {/* Vélages prévus dans 30 jours */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Baby size={16} className="text-pink-500" />
          Vélages prévus ({gestationsPrevues.length})
        </h3>
        {gestationsPrevues.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">Aucun vélage prévu dans les 30 prochains jours</div>
        ) : (
          <div className="space-y-2">
            {gestationsPrevues.map((gestation) => {
              const animal = gestation.saillie.animal;
              const jours = gestation.dateVelagePrevue
                ? differenceInDays(new Date(gestation.dateVelagePrevue), now)
                : null;
              const urgent = jours !== null && jours <= 7;
              const tres_urgent = jours !== null && jours <= 2;

              return (
                <div
                  key={gestation.id}
                  className={`rounded-lg p-3 border ${tres_urgent ? "bg-red-50 border-red-300" : urgent ? "bg-orange-50 border-orange-200" : "bg-pink-50 border-pink-100"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{animal.nutrav}</span>
                        <span className="text-sm font-medium text-gray-800">{animal.nobovi ?? "Sans nom"}</span>
                      </div>
                      {gestation.dateVelagePrevue && (
                        <div className="text-sm font-semibold mt-1 text-gray-700">
                          {formatDate(gestation.dateVelagePrevue)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {jours !== null && (
                        <div className={`text-lg font-bold ${tres_urgent ? "text-red-600" : urgent ? "text-orange-600" : "text-pink-600"}`}>
                          J-{jours}
                        </div>
                      )}
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${tres_urgent ? "bg-red-500 text-white" : urgent ? "bg-orange-400 text-white" : "bg-pink-400 text-white"}`}>
                        {tres_urgent ? "IMMINENT" : urgent ? "BIENTÔT" : "PRÉVU"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vélages récents */}
      {velagesRecents.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Vélages récents (14 derniers jours)</h3>
          <div className="space-y-2">
            {velagesRecents.map((velage) => (
              <div key={velage.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{velage.vache.nutrav}</span>
                    <span className="font-medium text-gray-800">{velage.vache.nobovi ?? "Sans nom"}</span>
                  </div>
                  {velage.veau && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Veau: {velage.veau.nobovi ?? velage.veau.nutrav} ({velage.veau.sexbov})
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{formatDate(velage.date)}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${velage.qualificatif === "NORMAL" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {velage.qualificatif}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
