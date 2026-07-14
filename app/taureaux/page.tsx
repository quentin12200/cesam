export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import TaureauxClient from "./TaureauxClient";

import BackButton from "@/app/components/BackButton";
export default async function TaureauxPage() {
  const taureaux = await prisma.taureau.findMany({
    select: {
      id: true,
      nupere: true,
      nopere: true,
      present: true,
      _count: { select: { saillies: true } },
    },
    orderBy: { nopere: "asc" },
  });

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <h2 className="text-xl font-bold text-gray-800">Taureaux</h2>
      </div>
      <TaureauxClient initialTaureaux={taureaux} />
    </div>
  );
}
