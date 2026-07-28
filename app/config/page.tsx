import Link from "next/link";
import {
  Bell,
  Building2,
  ChevronRight,
  HeartPulse,
  Stethoscope,
  Tags,
  UserRound,
} from "lucide-react";
import BackButton from "@/app/components/BackButton";

const sections = [
  {
    title: "Profil et personnalisation",
    description: "Profil actif, disposition des écrans et actions rapides.",
    icon: UserRound,
    href: "/config/profil",
  },
  {
    title: "Exploitation",
    description: "Coordonnées, vétérinaire et informations de l’exploitation.",
    icon: Building2,
    href: "/config/exploitation",
  },
  {
    title: "Troupeau et identification",
    description: "Lots de boucles et numérotation des animaux.",
    icon: Tags,
    href: "/config/troupeau",
  },
  {
    title: "Reproduction",
    description: "Cycle reproductif, échographies, alertes et retour en chaleur.",
    icon: HeartPulse,
    href: "/config/reproduction",
  },
  {
    title: "Santé et traitements",
    description: "Protocoles de vaccination et réglages sanitaires.",
    icon: Stethoscope,
    href: "/config/protocoles",
  },
  {
    title: "Notifications",
    description: "Alertes reçues sur cet appareil.",
    icon: Bell,
    href: "/config/notifications",
  },
] as const;

function SectionContent({
  section,
}: {
  section: (typeof sections)[number];
}) {
  const Icon = section.icon;

  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">
          {section.title}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {section.description}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
    </>
  );
}

export default function ConfigPage() {
  return (
    <div className="mx-auto min-h-full w-full max-w-4xl px-3 py-4 pb-24 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <BackButton
          className="rounded-lg bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50"
          iconSize={18}
        />
        <div>
          <h1 className="text-xl font-black text-slate-900">Paramètres</h1>
          <p className="text-sm text-slate-500">Réglages de CESAM</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {sections.map((section) => {
          const className =
            "flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm";

          return (
            <Link
              key={section.title}
              href={section.href}
              className={`${className} transition hover:border-green-300 hover:bg-green-50/40 active:scale-[0.99]`}
            >
              <SectionContent section={section} />
            </Link>
          );
        })}
      </div>

      <aside className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Portée des réglages
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            Cet appareil
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            Profil Céline ou Samuel
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            Toute l’exploitation
          </span>
        </div>
      </aside>
    </div>
  );
}
