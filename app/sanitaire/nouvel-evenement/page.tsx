export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NouvelEvenementForm from "./NouvelEvenementForm";

interface PageProps {
  searchParams: Promise<{ animal?: string; medicament?: string }>;
}

export default async function NouvelEvenementPage({ searchParams }: PageProps) {
  const { animal, medicament } = await searchParams;

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sanitaire" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Nouvel événement sanitaire</h2>
      </div>

      <NouvelEvenementForm presetNutrav={animal} presetMedicamentId={medicament} />
    </div>
  );
}
