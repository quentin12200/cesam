export const dynamic = "force-dynamic";

import NouvelEvenementForm from "./NouvelEvenementForm";

import BackButton from "@/app/components/BackButton";
interface PageProps {
  searchParams: Promise<{ animal?: string; animaux?: string; medicament?: string }>;
}

export default async function NouvelEvenementPage({ searchParams }: PageProps) {
  const { animal, animaux, medicament } = await searchParams;
  const presetNutravs = animaux?.split(",").map((nutrav) => nutrav.trim()).filter(Boolean);

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <h2 className="text-xl font-bold text-gray-800">Nouvel événement sanitaire</h2>
      </div>

      <NouvelEvenementForm presetNutrav={animal} presetNutravs={presetNutravs} presetMedicamentId={medicament} />
    </div>
  );
}
