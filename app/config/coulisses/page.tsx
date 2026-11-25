import Link from "next/link";
import { ChevronRight, Wrench, ShieldCheck, FlaskConical, ArrowLeft } from "lucide-react";

const groups = [
  {
    title: "Filiations et reproducteurs",
    description: "Contrôler les liens entre les animaux et leurs reproducteurs.",
    tools: [
      { href: "/taureaux/controle", title: "Contrôle des pères", description: "Consulter les filiations et les contradictions existantes." },
      { href: "/taureaux/controle/anciens-velages", title: "Anciens pères de vêlage", description: "Diagnostic en lecture seule des anciennes saisies." },
      { href: "/taureaux/doublons", title: "Doublons des reproducteurs", description: "Vérifier les rapprochements et accéder aux corrections existantes." },
    ],
  },
  {
    title: "Identification",
    description: "Retrouver les outils de vérification des animaux.",
    tools: [
      { href: "/troupeau/identification", title: "Identification des bovins", description: "Contrôler les boucles et accéder aux corrections de sexe existantes." },
    ],
  },
  {
    title: "Sanitaire",
    description: "Vérifier les documents et leurs informations.",
    tools: [
      { href: "/ordonnances", title: "Ordonnances à vérifier", description: "Ouvrir les ordonnances et retrouver les extractions à vérifier." },
    ],
  },
] as const;

export default function CoulissesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 pb-24 sm:px-5">
      <Link href="/config" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-700 focus-visible:ring-2 focus-visible:ring-green-700">
        <ArrowLeft size={18} aria-hidden="true" /> Paramètres
      </Link>
      <header className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
        <div className="flex items-center gap-3">
          <Wrench size={26} className="shrink-0 text-amber-800" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Les Coulisses</h1>
            <p className="mt-1 text-sm">Centre de contrôle CESAM</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6">Retrouve les outils de diagnostic et de correction déjà disponibles, sans changer tes parcours habituels.</p>
      </header>
      <aside className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-amber-800" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Données réelles de l’exploitation</h2>
          <p className="mt-1 text-sm leading-5 text-slate-700">Cette page n’effectue aucune correction. Les outils ouverts peuvent modifier les données : vérifie les informations avant de valider une action.</p>
        </div>
      </aside>
      {groups.map(group => (
        <section key={group.title} className="min-w-0 space-y-2">
          <h2 className="text-lg font-bold text-slate-900">{group.title}</h2>
          <p className="text-sm text-slate-600">{group.description}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.tools.map(tool => (
              <Link key={tool.href} href={tool.href} prefetch={false} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-green-400 focus-visible:ring-2 focus-visible:ring-green-700">
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-bold text-slate-900">{tool.title}</span>
                  <span className="mt-1 block break-words text-sm leading-5 text-slate-600">{tool.description}</span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-slate-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="text-lg font-bold text-slate-900">À venir</h2>
        <p className="text-sm text-slate-600">Contrôles transversaux de la reproduction, des pesées, du sanitaire et des effectifs ; historique centralisé des corrections. Ces diagnostics ne sont pas encore disponibles ici.</p>
      </section>
      <Link href="/lab" prefetch={false} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 focus-visible:ring-2 focus-visible:ring-green-700">
        <FlaskConical size={24} className="shrink-0 text-blue-700" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-base font-bold text-slate-900">CESAM Lab actuel</span><span className="block text-sm text-slate-600">Prototypes existants : données réelles, pas encore isolés.</span></span>
        <ChevronRight size={20} className="shrink-0 text-slate-500" aria-hidden="true" />
      </Link>
    </div>
  );
}
