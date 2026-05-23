import { prisma } from "@/lib/prisma";
import { getVaccinsManquants, formatDate, formatAge } from "@/lib/utils";
import { differenceInDays, subDays } from "date-fns";
import Link from "next/link";
import { Syringe, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import VaccinationFormWrapper from "./VaccinationFormWrapper";

async function getSanitaireData() {
  const now = new Date();

  const [animaux, vaccinationsRecentes, vachesPreVelage] = await Promise.all([
    // Animaux actifs pour calcul protocoles vaccins
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: {
        vaccinations: { select: { vaccin: true, date: true } },
      },
      orderBy: { danais: "asc" },
    }),
    // Vaccinations des 7 derniers jours
    prisma.vaccination.findMany({
      where: { date: { gte: subDays(now, 7) } },
      include: {
        animal: { select: { nutrav: true, nobovi: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    // Vaches avec vélage prévu dans 90 jours pour Crypto/Rotavec
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sexbov: "F",
        estGenisse: false,
      },
      include: {
        saillies: {
          orderBy: { date: "desc" },
          take: 1,
          include: { gestation: true },
        },
        vaccinations: { select: { vaccin: true, date: true } },
      },
    }),
  ]);

  // Calcul veaux à vacciner
  const veauxAVacciner = animaux
    .filter((a) => {
      const ageJours = differenceInDays(now, a.danais);
      return ageJours <= 365 * 2; // < 2 ans
    })
    .map((animal) => {
      const vaccinsManquants = getVaccinsManquants(
        animal.danais,
        animal.vaccinations.map((v) => ({ vaccin: v.vaccin, date: v.date }))
      );
      return { ...animal, vaccinsManquants };
    })
    .filter((a) => a.vaccinsManquants.length > 0)
    .sort((a, b) => {
      const urgentA = a.vaccinsManquants.some((v) => v.urgent);
      const urgentB = b.vaccinsManquants.some((v) => v.urgent);
      if (urgentA && !urgentB) return -1;
      if (!urgentA && urgentB) return 1;
      return 0;
    });

  // Vaches à vacciner pré-vélage (Crypto/Rotavec: J-90 à J-21)
  const vachesPreVelageFiltered = vachesPreVelage
    .map((vache) => {
      const gestation = vache.saillies[0]?.gestation;
      if (!gestation?.dateVelagePrevue || gestation.etat !== "VERT") return null;

      const joursAvantVelage = differenceInDays(new Date(gestation.dateVelagePrevue), now);
      if (joursAvantVelage < 21 || joursAvantVelage > 90) return null;

      const asCrypto = vache.vaccinations.some(
        (v) => v.vaccin === "CRYPTO" && differenceInDays(now, v.date) < 120
      );
      const asRotavec = vache.vaccinations.some(
        (v) => v.vaccin === "ROTAVEC" && differenceInDays(now, v.date) < 120
      );

      if (asCrypto && asRotavec) return null;

      return {
        ...vache,
        joursAvantVelage,
        dateVelagePrevue: gestation.dateVelagePrevue,
        asCrypto,
        asRotavec,
      };
    })
    .filter(Boolean) as (typeof vachesPreVelage[0] & {
      joursAvantVelage: number;
      dateVelagePrevue: Date;
      asCrypto: boolean;
      asRotavec: boolean;
    })[];

  return { veauxAVacciner, vachesPreVelageFiltered, vaccinationsRecentes };
}

export default async function SanitairePage() {
  const { veauxAVacciner, vachesPreVelageFiltered, vaccinationsRecentes } = await getSanitaireData();

  const urgents = veauxAVacciner.filter((a) => a.vaccinsManquants.some((v) => v.urgent));

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Sanitaire</h2>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{urgents.length}</div>
          <div className="text-xs text-gray-500 mt-1">Urgents</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{veauxAVacciner.length}</div>
          <div className="text-xs text-gray-500 mt-1">À vacciner</div>
        </div>
        <div className="bg-white rounded-xl shadow p-3 text-center">
          <div className="text-2xl font-bold text-pink-600">{vachesPreVelageFiltered.length}</div>
          <div className="text-xs text-gray-500 mt-1">Pré-vélage</div>
        </div>
      </div>

      {/* Formulaire vaccination */}
      <VaccinationFormWrapper />

      {/* Vaches pré-vélage */}
      {vachesPreVelageFiltered.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Syringe size={16} className="text-pink-500" />
            Vaches pré-vélage — Crypto/Rotavec ({vachesPreVelageFiltered.length})
          </h3>
          <div className="space-y-2">
            {vachesPreVelageFiltered.map((vache) => (
              <div key={vache.id} className="border border-pink-100 rounded-lg p-3 bg-pink-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/troupeau/${vache.nutrav}`} className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{vache.nutrav}</Link>
                      <span className="text-sm font-medium text-gray-800">{vache.nobovi ?? "Sans nom"}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Vélage dans {vache.joursAvantVelage}j — {formatDate(vache.dateVelagePrevue)}</div>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${vache.asCrypto ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {vache.asCrypto ? "✓" : "✗"} CRYPTO
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${vache.asRotavec ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {vache.asRotavec ? "✓" : "✗"} ROTAVEC
                      </span>
                    </div>
                  </div>
                  <span className="text-xs bg-pink-400 text-white px-2 py-1 rounded-full">J-{vache.joursAvantVelage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Veaux à vacciner */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-500" />
          Veaux à vacciner ({veauxAVacciner.length})
        </h3>
        {veauxAVacciner.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
            Tous les protocoles sont à jour !
          </div>
        ) : (
          <div className="space-y-2">
            {veauxAVacciner.map((animal) => {
              const estUrgent = animal.vaccinsManquants.some((v) => v.urgent);
              return (
                <div key={animal.id} className={`border rounded-lg p-3 ${estUrgent ? "border-red-200 bg-red-50" : "border-yellow-100 bg-yellow-50"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/troupeau/${animal.nutrav}`} className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">{animal.nutrav}</Link>
                        <span className="text-sm font-medium text-gray-800">{animal.nobovi ?? "Sans nom"}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatAge(animal.danais)}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {animal.vaccinsManquants.map((v) => (
                          <span
                            key={v.vaccin}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.urgent ? "bg-red-500 text-white" : "bg-yellow-400 text-black"}`}
                          >
                            {v.vaccin}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {animal.vaccinsManquants.map((v) => v.raison).join(" • ")}
                      </div>
                    </div>
                    {estUrgent && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">URGENT</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vaccinations récentes */}
      {vaccinationsRecentes.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            Vaccinations récentes (7 derniers jours)
          </h3>
          <div className="space-y-1">
            {vaccinationsRecentes.map((vacc) => (
              <div key={vacc.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{vacc.animal.nutrav}</span>
                  <span className="text-gray-700">{vacc.animal.nobovi ?? "Sans nom"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{vacc.vaccin}</span>
                  <span className="text-xs text-gray-400">{formatDate(vacc.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
