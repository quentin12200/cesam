import Link from "next/link";
import { getCarnetSanitaireRows, getEvenementsCarnetRows } from "@/lib/carnet-sanitaire";
export const dynamic = "force-dynamic";

export default async function RegistrePage({ searchParams }: { searchParams: Promise<{ tri?: string; recherche?: string; type?: string }> }) {
  const p = await searchParams;
  const [soins, observations] = await Promise.all([getCarnetSanitaireRows(), getEvenementsCarnetRows()]);
  const actes = [
    ...soins.map(a => ({ key: a.sourceType + ":" + a.id, type: a.sourceType as string, date: a.date, animal: a.animalNutrav, produit: a.produit, executant: a.executant, detail: a.dose, evenementId: a.evenementId })),
    ...observations.map(a => ({ key: "EVENEMENT:" + a.id, type: "EVENEMENT", date: a.date, animal: a.animalNutrav, produit: a.type, executant: a.constatePar, detail: a.description ?? "", evenementId: null as string | null })),
  ];
  const query = (p.recherche ?? "").toLowerCase();
  const type = p.type ?? "tous";
  const tri = p.tri ?? "date";
  const visibles = actes.filter(a => (type === "tous" || a.type === type) && [a.animal,a.produit,a.executant].some(s => (s ?? "").toLowerCase().includes(query)));
  visibles.sort((a,b) => tri === "animal" ? a.animal.localeCompare(b.animal, "fr", {numeric:true}) : tri === "produit" ? a.produit.localeCompare(b.produit, "fr") : tri === "executant" ? (a.executant ?? "").localeCompare(b.executant ?? "", "fr") : b.date.getTime() - a.date.getTime());
  return <main className="mx-auto max-w-5xl space-y-4 p-4">
    <Link href="/sanitaire/carnet" className="text-green-800 underline">Retour au carnet</Link>
    <h1 className="text-2xl font-bold">Registre sanitaire unifié</h1>
    <p className="text-sm text-gray-600">Lecture individuelle des actes existants, sans regroupement ni modification des données.</p>
    <form className="flex flex-wrap gap-2" method="get">
      <input name="recherche" defaultValue={p.recherche} placeholder="Animal, produit, exécutant" className="min-h-11 rounded border px-3" />
      <select name="tri" defaultValue={tri} className="min-h-11 rounded border px-3"><option value="date">Date</option><option value="animal">Animal</option><option value="produit">Médicament / fait</option><option value="executant">Exécutant</option></select>
      <select name="type" defaultValue={type} className="min-h-11 rounded border px-3"><option value="tous">Tous</option><option value="VACCINATION">Vaccinations</option><option value="TRAITEMENT">Traitements</option><option value="EVENEMENT">Événements</option></select>
      <button className="min-h-11 rounded bg-green-800 px-4 font-bold text-white">Filtrer</button>
    </form>
    <p className="text-sm">{visibles.length} actes sur {actes.length} enregistrés</p>
    <div className="divide-y rounded border bg-white">{visibles.map(a => <article key={a.key} className="p-3">
      <div className="flex justify-between gap-2"><b>{a.animal} · {a.produit}</b><span className="text-xs">{a.date.toLocaleDateString("fr-FR")}</span></div>
      <div className="mt-1 text-xs text-gray-600">{a.type} · {a.executant || "Exécutant non renseigné"} · {a.detail || ""}</div>
      {a.evenementId && <p className="text-xs text-green-800">Événement lié : {a.evenementId}</p>}
      <div className="mt-1 font-mono text-[10px] text-gray-400">{a.key}</div>
    </article>)}</div>
  </main>;
}
