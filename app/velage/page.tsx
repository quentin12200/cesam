export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import VelageFormWrapper from "./VelageFormWrapper";
import CapteurManager from "./CapteurManager";
import { getGestationCalendar } from "@/lib/gestation-calendar";
import GestationCalendarSection from "@/app/components/GestationCalendarSection";
import TroupeauTabs from "@/components/TroupeauTabs";
import { normaliserNutrav, propositionLot } from "@/lib/identification";

async function getVelageData() {
  const now = new Date();

  const [capteurs, gestationCalendar, velagesRecents, dernierVeauDetail, dernierVeauHistorique, numerosAnimaux, numerosVeaux, identificationConfig, lotActif] = await Promise.all([
    prisma.capteurVelage.findMany({ orderBy: { numero: "asc" } }),
    getGestationCalendar(),
    prisma.velage.findMany({
      where: {
        date: {
          gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        vache: { select: { nutrav: true, nobovi: true } },
        veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
        veauxDetails: { include: { animal: { select: { nutrav: true, nobovi: true, sexbov: true } } } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.veauVelage.findFirst({
      where: { nutrav: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { nutrav: true, createdAt: true },
    }),
    prisma.velage.findFirst({
      where: { veauId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, veau: { select: { nutrav: true } } },
    }),
    prisma.animal.findMany({ select: { nutrav: true, numeroNational: true } }),
    prisma.veauVelage.findMany({ select: { nutrav: true, nunati: true } }),
    prisma.exploitationConfig.findUnique({ where: { id: "singleton" } }),
    prisma.lotBoucles.findFirst({ where: { actif: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const numerosUtilises = [...new Set([...numerosAnimaux.map((animal) => animal.nutrav), ...numerosVeaux.flatMap((veau) => veau.nutrav ? [veau.nutrav] : [])])];
  const numerosNationauxUtilises = [...new Set([...numerosAnimaux.flatMap((animal) => animal.numeroNational ? [animal.numeroNational] : []), ...numerosVeaux.flatMap((veau) => veau.nunati ? [veau.nunati] : [])])];
  const config = identificationConfig ?? { identificationMode: "TRAVAIL_ET_NATIONAL", nutravNbChiffres: 4, nutravZerosGauche: true, propositionAutoNumero: true, serieCommuneSexes: true, serviceDeclaration: "AUCUN" };
  const detailRecent = dernierVeauDetail && (!dernierVeauHistorique || dernierVeauDetail.createdAt >= dernierVeauHistorique.createdAt);
  const candidat = detailRecent ? dernierVeauDetail?.nutrav : dernierVeauHistorique?.veau?.nutrav;
  const dernierNumero = candidat && /^\d+$/.test(candidat) ? candidat : undefined;
  let suivant = dernierNumero ? Number(dernierNumero) + 1 : 1;
  const longueur = config.nutravNbChiffres;
  const dejaUtilises = new Set(numerosUtilises);
  while (dejaUtilises.has(normaliserNutrav(String(suivant), longueur, config.nutravZerosGauche))) suivant += 1;

  let proposition = { nutrav: normaliserNutrav(String(suivant), longueur, config.nutravZerosGauche), nunati: "" };
  if (lotActif && lotActif.prochainIndex < lotActif.quantite && config.propositionAutoNumero) {
    let decalage = 0;
    proposition = propositionLot(lotActif, longueur, config.nutravZerosGauche, decalage);
    while ((dejaUtilises.has(proposition.nutrav) || numerosNationauxUtilises.includes(proposition.nunati)) && lotActif.prochainIndex + decalage < lotActif.quantite) {
      decalage += 1;
      proposition = propositionLot(lotActif, longueur, config.nutravZerosGauche, decalage);
    }
    if (lotActif.prochainIndex + decalage >= lotActif.quantite) proposition = { nutrav: normaliserNutrav(String(suivant), longueur, config.nutravZerosGauche), nunati: "" };
  }

  return { capteurs, gestationCalendar, velagesRecents, numerosUtilises, numerosNationauxUtilises, proposition, config };
}

export default async function VelagePage({ searchParams }: { searchParams: Promise<{ nouveau?: string; mere?: string; date?: string; sexe?: string }> }) {
  const params = await searchParams;
  const { capteurs, gestationCalendar, velagesRecents, numerosUtilises, numerosNationauxUtilises, proposition, config } = await getVelageData();
  const now = new Date();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <TroupeauTabs />
      <div className="mt-2">
        <h2 className="text-xl font-bold text-gray-800">Vêlages</h2>
        <p className="text-xs text-gray-500">Préparer, suivre et enregistrer les vêlages</p>
      </div>

      {/* Action principale */}
      <VelageFormWrapper
        initialOpen={params.nouveau === "1"}
        initialMere={params.mere ?? ""}
        initialDate={params.date}
        initialSexe={params.sexe === "M" || params.sexe === "F" ? params.sexe : ""}
        capteurs={capteurs.map((c) => ({ numero: c.numero, actif: c.actif, animalNutrav: c.animalNutrav }))}
        numeroVeauPropose={config.propositionAutoNumero ? proposition.nutrav : ""}
        numeroNationalPropose={config.identificationMode === "TRAVAIL_SEUL" ? "" : proposition.nunati}
        numerosUtilises={numerosUtilises}
        numerosNationauxUtilises={numerosNationauxUtilises}
        identification={{ mode: config.identificationMode, chiffres: config.nutravNbChiffres, zerosGauche: config.nutravZerosGauche }}
      />

      {/* Calendrier de gestation */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <CalendarDays size={18} className="text-green-700" />
          <h3 className="font-semibold text-gray-800">
            Calendrier de gestation ({gestationCalendar.length})
          </h3>
        </div>
        <GestationCalendarSection rows={gestationCalendar} now={now} />
      </div>

      {/* Capteurs */}
      <CapteurManager
        capteurs={capteurs.map((c) => ({
          ...c,
          dateAttribution: c.dateAttribution?.toISOString() ?? null,
        }))}
      />

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
                  <div className="text-xs text-gray-500 mt-0.5">
                    {velage.qualificatif === "AVORTEMENT" ? "Aucun veau" : velage.veauxDetails.length > 0
                      ? velage.veauxDetails.map((v, i) => <span key={v.id} className="block">Veau {i + 1}: {v.animal?.nobovi ?? v.nutrav ?? v.nom ?? "sans numéro"} ({v.sexe ?? "sexe inconnu"}) — {v.statut === "MORT_NE" ? "mort-né" : "vivant"}</span>)
                      : velage.veau ? `Veau: ${velage.veau.nobovi ?? velage.veau.nutrav} (${velage.veau.sexbov})` : "Veau non renseigné"}
                    {velage.capteur && <span className="block">Capteur utilisé : {velage.capteur}</span>}
                  </div>
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
