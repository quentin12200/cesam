import LabTraitement from "./LabTraitement";
import { LabReproductionModalProvider } from "../components/ReproductionModalProvider";
import QuickActionsBar from "../troupeau/[nutrav]/QuickActionsBar";
import LabBouclage from "./LabBouclage";
import EchoShortcut from "@/app/components/EchoShortcut";
import LabEchoSession from "./LabEchoSession";
import LabFatherAudit from "./LabFatherAudit";
import LabCalvingPanel from "./LabCalvingPanel";
import Link from "next/link";
import LabExplorer from "./LabExplorer";
import { DEMO_WORKSPACE_ANIMALS } from "@/app/prototype-espace-travail/demo-data";

export default function CesamLabPage() {
  const animaux = DEMO_WORKSPACE_ANIMALS.map(a => ({
    id: a.id, nutrav: a.nutrav, nobovi: a.name, sexbov: a.sex,
    danais: a.birthDate, aEchographier: a.echoDue,
    reproduction: a.reproductionStatus === "PREGNANT" ? "VERT" as const : a.reproductionStatus === "EMPTY" ? "ROUGE" as const : a.reproductionStatus === "TO_CHECK" ? "JAUNE" as const : null,
  }));
  const echeances = DEMO_WORKSPACE_ANIMALS.filter(a => a.reproductionStatus === "PREGNANT").map((a, i) => ({
    id: a.id, nutrav: a.nutrav, nom: a.name, date: new Date(Date.UTC(2026, 11, 1 + i * 3)).toISOString(),
  }));
  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-28">
    <header className="rounded-2xl bg-blue-800 p-4 text-white">
      <span className="text-xs font-bold">PROTOTYPES · DONNÉES FICTIVES</span>
      <h1 className="mt-2 text-2xl font-black">CESAM LAB</h1>
      <p className="mt-1 text-sm">Les simulations de cette page utilisent uniquement des exemples fictifs.</p>
    </header>
    <nav className="grid gap-2 sm:grid-cols-2" aria-label="Autres prototypes">
      <Link href="/prototype-espace-travail" prefetch={false} className="min-h-11 rounded-xl border bg-white p-3 text-sm font-bold">Prototype espace de travail</Link>
      <Link href="/prototype-accueil-v3" prefetch={false} className="min-h-11 rounded-xl border bg-white p-3 text-sm font-bold">Prototype accueil V3</Link>
    </nav>
    <LabExplorer animaux={animaux} echeances={echeances} />
    <LabCalvingPanel />
    <LabFatherAudit />
    <div aria-label="Raccourci échographie fictif" role="region" className="grid grid-cols-3 gap-1.5"><EchoShortcut echoCount={animaux.filter(a => a.aEchographier).length} /></div>
    <LabEchoSession />
    <LabBouclage />
    <LabTraitement />
    <section aria-label="Actions rapides fictives" className="rounded-xl border p-3"><h2>Actions rapides fictives</h2><LabReproductionModalProvider><QuickActionsBar animalId="DEMO-ACTIONS" nutrav="DEMO-ACTIONS" isFemelle={true} isActif={true} /></LabReproductionModalProvider></section>
    <Link href="/config" prefetch={false} className="inline-flex min-h-11 items-center font-bold underline">Quitter le Lab — paramètres réels</Link>
  </div>;
}
