export const dynamic = "force-dynamic";

import { getPreparationsVaccinales } from "@/lib/vaccine-preparation-data";
import PrintButton from "./PrintButton";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

export default async function ImpressionVaccinsPage({ searchParams }: { searchParams: Promise<{ protocole?: string }> }) {
  const { protocole } = await searchParams;
  const groupes = (await getPreparationsVaccinales()).filter((groupe) => !protocole || groupe.protocoleId === protocole);

  return (
    <main className="print-root mx-auto max-w-[1120px] bg-white p-5 text-black">
      <style>{`@page{size:A4 landscape;margin:8mm}.print-table{width:100%;border-collapse:collapse}.print-table th,.print-table td{border:1px solid #555;padding:4px 5px;text-align:left}.print-table th{font-size:9px;text-transform:uppercase}.print-table td{font-size:10px;height:26px}.print-table tr{break-inside:avoid}.print-table thead{display:table-header-group}@media print{body{background:#fff}.no-print,nav,footer{display:none!important}.print-root{max-width:none;padding:0}.vaccine-sheet{break-after:page}.vaccine-sheet:last-child{break-after:auto}}`}</style>
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      {groupes.map((groupe) => {
        const lignes = groupe.lignes.filter((ligne) => ["A_FAIRE", "A_PREVOIR", "EN_RETARD"].includes(ligne.statut));
        return (
          <section key={groupe.protocoleId} className="vaccine-sheet">
            <header className="mb-3 flex items-end justify-between border-b-2 border-black pb-2">
              <div><h1 className="text-2xl font-black uppercase">Préparation vaccination — {groupe.vaccin}</h1><p className="text-sm">Date préparation : {dateLongue.format(new Date())}</p></div>
              <div className="text-right text-sm"><b>{lignes.length} animal(aux)</b><br />{groupe.dosesNecessaires} dose(s) nécessaire(s)</div>
            </header>
            {lignes.length === 0 ? <p className="border p-8 text-center">Aucun animal à préparer.</p> : (
              <table className="print-table">
                <thead><tr><th className="w-8">☐</th><th>Animal</th><th>Injection</th><th>Repère</th><th>Fenêtre</th><th>Groupe / localisation</th><th>Dose</th><th className="w-40">Notes</th></tr></thead>
                <tbody>{lignes.map((ligne) => <tr key={`${ligne.animalId}-${ligne.injection}`}><td className="text-lg">☐</td><td><b className="font-mono text-sm">{ligne.nutrav}</b>{ligne.nom ? ` ${ligne.nom}` : ""}</td><td>{ligne.injection}</td><td>{ligne.repere}</td><td>{dateCourte.format(ligne.dateMin)} → {dateCourte.format(ligne.dateMax)}</td><td>{ligne.groupe}</td><td>{ligne.dose} · {ligne.voie}</td><td /></tr>)}</tbody>
              </table>
            )}
            <p className="mt-2 text-xs">Flacons : {!groupe.conditionnementRenseigne ? "Impossible de calculer — conditionnement non renseigné" : <>{groupe.flacons.reliquatUtilise > 0 ? `reliquat valide ${groupe.flacons.reliquatUtilise} dose(s) + ` : ""}{groupe.flacons.dosesParConditionnement ? `${groupe.flacons.nombre} × ${groupe.flacons.dosesParConditionnement} doses` : "Conditionnement insuffisant"}</>}</p>
          </section>
        );
      })}
    </main>
  );
}
