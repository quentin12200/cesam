export const dynamic = "force-dynamic";

import NouvelEvenementForm from "./NouvelEvenementForm";
import { getPreparationsVaccinales } from "@/lib/vaccine-preparation-data";
import type { VaccinationSessionPreset } from "@/lib/vaccination-session";

import BackButton from "@/app/components/BackButton";
interface PageProps {
  searchParams: Promise<{ animal?: string; animaux?: string; medicament?: string; protocole?: string; vaccination?: string }>;
}

export default async function NouvelEvenementPage({ searchParams }: PageProps) {
  const { animal, animaux, medicament, protocole, vaccination } = await searchParams;
  const presetNutravs = animaux?.split(",").map((nutrav) => nutrav.trim()).filter(Boolean);
  let presetVaccination: VaccinationSessionPreset | undefined;
  if (vaccination === "1" && protocole && presetNutravs?.length) {
    const groupe = (await getPreparationsVaccinales()).find((item) => item.protocoleId === protocole);
    const demandes = new Set(presetNutravs);
    const lignes = groupe?.lignes.filter((ligne) => demandes.has(ligne.nutrav)) ?? [];
    const medicamentId = groupe?.medicamentId || medicament;
    if (groupe && medicamentId && lignes.length === demandes.size) {
      presetVaccination = {
        protocoleId: groupe.protocoleId,
        vaccin: groupe.vaccin,
        medicamentId,
        voie: lignes[0]?.voie === "À renseigner" ? "" : lignes[0]?.voie ?? "",
        dose: lignes[0]?.doseValeur ?? null,
        uniteDosage: lignes[0]?.doseUnite ?? null,
        animaux: lignes.map((ligne) => ({
          animalId: ligne.animalId,
          nutrav: ligne.nutrav,
          etapeProtocoleId: ligne.etapeProtocoleId,
          gestationId: ligne.gestationId,
          typeInjection: ligne.typeInjection,
        })),
      };
    }
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <h2 className="text-xl font-bold text-gray-800">Nouvel événement sanitaire</h2>
      </div>

      <NouvelEvenementForm presetNutrav={animal} presetNutravs={presetNutravs} presetMedicamentId={medicament} presetVaccination={presetVaccination} />
    </div>
  );
}
