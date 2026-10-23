import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { comparerRotavecCryptium, rechercherActes, type ActeSanitaireReel, type RechercheActes } from "@/lib/carnet-actes";

type Tri = NonNullable<RechercheActes["tri"]>;

export default function RechercheActesCarnet({ actes, recherche, comparer, tequila }: {
  actes: ActeSanitaireReel[];
  recherche: RechercheActes;
  comparer: boolean;
  tequila: { id: string; nutrav: string; nobovi: string | null } | null;
}) {
  const lignes = rechercherActes(actes, recherche);
  const comparaison = comparer ? comparerRotavecCryptium(actes) : null;
  const filtres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries({ du: recherche.du, au: recherche.au, animal: recherche.animal, produit: recherche.produit })) {
    if (valeur) filtres.set(cle, valeur);
  }
  if (comparer) filtres.set("compare", "rotavec-cryptium");
  const lienTri = (tri: Tri) => {
    const params = new URLSearchParams(filtres);
    params.set("acteTri", tri);
    params.set("acteDirection", recherche.tri === tri && recherche.direction === "asc" ? "desc" : "asc");
    return `/sanitaire/carnet?${params}`;
  };
  const titreTri = (tri: Tri, titre: string) => `${titre}${recherche.tri === tri ? recherche.direction === "asc" ? " ↑" : " ↓" : ""}`;
  const enteteTri = (tri: Tri, titre: string) => <th scope="col" className="border-b px-3 py-2 text-left">
    <Link href={lienTri(tri)} className="inline-flex min-h-10 items-center font-semibold text-green-950 underline decoration-green-400 underline-offset-2"
      aria-label={`Trier par ${titre.toLowerCase()}`}>{titreTri(tri, titre)}</Link>
  </th>;

  return <section aria-labelledby="recherche-actes" className="mb-6 rounded-xl border border-green-200 bg-white p-3 shadow-sm sm:p-4 print:hidden">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id="recherche-actes" className="text-lg font-bold text-green-950">Rechercher des actes sanitaires</h2>
        <p className="text-xs text-gray-600">Vaccinations faites et traitements réels, même sans protocole. Une administration présente dans les deux sources n’apparaît qu’une fois.</p>
      </div>
      <Link href="/sanitaire/carnet?compare=rotavec-cryptium&du=2026-10-12&au=2026-10-12"
        className="rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">
        Comparer ROTAVEC / CRYPTIUM · 12/10/2026
      </Link>
    </div>

    <form action="/sanitaire/carnet" method="get" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto]">
      {comparer && <input type="hidden" name="compare" value="rotavec-cryptium" />}
      <label className="text-xs font-semibold text-gray-700">Du
        <input type="date" name="du" defaultValue={recherche.du ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-2 text-sm" />
      </label>
      <label className="text-xs font-semibold text-gray-700">Au
        <input type="date" name="au" defaultValue={recherche.au ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-2 text-sm" />
      </label>
      <label className="text-xs font-semibold text-gray-700">Médicament
        <input name="produit" type="search" defaultValue={recherche.produit ?? ""} placeholder="ROTAVEC CORONA…"
          className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" />
      </label>
      <label className="text-xs font-semibold text-gray-700">N° ou nom d’animal
        <input name="animal" type="search" defaultValue={recherche.animal ?? ""} placeholder="7926 ou TEQUILA"
          className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" />
      </label>
      <div className="flex items-end gap-2"><button type="submit" className="min-h-11 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white">Rechercher</button>
        <Link href="/sanitaire/carnet" className="flex min-h-11 items-center text-xs text-gray-600 underline">Effacer</Link></div>
    </form>

    {comparaison && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <h3 className="font-bold text-amber-950">12/10/2026 · ROTAVEC CORONA / BOVILIS CRYPTIUM</h3>
      <p className="mt-1 text-xs text-amber-950">Comparaison des administrations enregistrées, y compris sans rattachement au protocole. Un animal est compté une fois par produit.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <ListeComparaison titre="ROTAVEC seul" actes={comparaison.rotavecSeul} />
        <ListeComparaison titre="CRYPTIUM seul" actes={comparaison.cryptiumSeul} />
        <ListeComparaison titre="Les deux" actes={comparaison.deuxProduits} />
      </div>
      <p className="mt-3 font-semibold text-amber-950">7926 TEQUILA : {tequila
        ? comparaison.rotavec.has(tequila.id) && comparaison.cryptium.has(tequila.id) ? "dans les deux listes"
          : comparaison.rotavec.has(tequila.id) ? "ROTAVEC seulement"
            : comparaison.cryptium.has(tequila.id) ? "CRYPTIUM seulement" : "dans aucune des deux listes"
        : "animal introuvable dans la base"}.</p>
    </div>}

    <p role="status" className="mt-3 text-sm font-semibold text-gray-700">{lignes.length} acte{lignes.length > 1 ? "s" : ""} trouvé{lignes.length > 1 ? "s" : ""}</p>
    <div className="mt-2 max-h-[65vh] overflow-auto rounded-lg border border-gray-200">
      <table className="min-w-[860px] w-full border-collapse text-left text-xs sm:text-sm">
        <thead className="sticky top-0 z-10 bg-green-50">
          <tr>{enteteTri("date", "Date")}{enteteTri("animal", "Animal")}{enteteTri("produit", "Produit")}
            {enteteTri("executant", "Exécutant")}<th scope="col" className="px-3 py-2">Source</th><th scope="col" className="px-3 py-2">Protocole / étape</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {lignes.map((acte) => <tr key={acte.id} className="odd:bg-white even:bg-gray-50">
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(acte.date)}</td>
            <td className="px-3 py-2"><Link href={`/troupeau/${encodeURIComponent(acte.nutrav)}`} className="font-bold text-green-800 underline">{acte.nutrav}</Link>{acte.nom ? ` · ${acte.nom}` : ""}</td>
            <td className="px-3 py-2 font-semibold text-gray-900">{acte.produit}</td>
            <td className="px-3 py-2">{acte.executant ?? "—"}</td>
            <td className="px-3 py-2">{acte.source}</td>
            <td className="px-3 py-2">{acte.protocoleNom ? `${acte.protocoleNom}${acte.etapeNom ? ` · ${acte.etapeNom}` : " · étape non rattachée"}` : "Sans protocole"}</td>
          </tr>)}
          {lignes.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-600">Aucun acte trouvé pour ces filtres.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

function ListeComparaison({ titre, actes }: { titre: string; actes: ActeSanitaireReel[] }) {
  return <div className="rounded-lg bg-white p-2">
    <h4 className="font-bold">{titre} · {actes.length}</h4>
    {actes.length ? <ul className="mt-1 max-h-40 overflow-auto text-xs">{actes.map((acte) => <li key={acte.animalId}>
      <Link href={`/troupeau/${encodeURIComponent(acte.nutrav)}`} className="text-green-800 underline">{acte.nutrav}</Link>{acte.nom ? ` ${acte.nom}` : ""}
    </li>)}</ul> : <p className="text-xs text-gray-600">Aucun</p>}
  </div>;
}
