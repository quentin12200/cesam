import { notFound } from "next/navigation";
import SortieForm from "@/app/finances/SortieForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GroupedSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, activeAnimals] = await Promise.all([
    prisma.weighingSession.findUnique({
      where: { id },
      select: {
        pesees: {
          orderBy: { createdAt: "asc" },
          select: { animalId: true, poids: true },
        },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      orderBy: { nutrav: "asc" },
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        sexbov: true,
        categorie: true,
        pesees: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { poids: true },
        },
      },
    }),
  ]);

  if (!session) notFound();

  const sessionWeights = new Map(session.pesees.map((pesee) => [pesee.animalId, pesee.poids]));
  const initialAnimalIds = session.pesees
    .map((pesee) => pesee.animalId)
    .filter((animalId) => activeAnimals.some((animal) => animal.id === animalId));
  const initialSet = new Set(initialAnimalIds);
  const animals = activeAnimals
    .map((animal) => ({
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      sexbov: animal.sexbov,
      categorie: animal.categorie,
      poidsVif: sessionWeights.get(animal.id) ?? animal.pesees[0]?.poids ?? null,
    }))
    .sort((left, right) => Number(initialSet.has(right.id)) - Number(initialSet.has(left.id)) || left.nutrav.localeCompare(right.nutrav));

  return (
    <SortieForm
      animaux={animals}
      annee={new Date().getFullYear()}
      initialAnimalIds={initialAnimalIds}
      returnTo={`/troupeau/pesee/sessions/${id}`}
    />
  );
}
