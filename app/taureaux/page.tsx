export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TaureauxClient from "./TaureauxClient";

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
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/reproduction" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Taureaux</h2>
      </div>
      <TaureauxClient initialTaureaux={taureaux} />
    </div>
  );
}
