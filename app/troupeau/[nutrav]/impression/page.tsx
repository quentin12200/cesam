export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { formatAge, formatDate, isMheVendable, getVaccinProtocolSteps, DEFAULT_PROTOCOLES, type ProtocoleVaccinConfig } from "@/lib/utils";
import PrintButton from "@/app/components/PrintButton";

interface PageProps {
  params: Promise<{ nutrav: string }>;
}

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

async function getAnimal(nutrav: string) {
  return prisma.animal.findUnique({
    where: { nutrav },
    include: {
      mere: { select: { nutrav: true, nobovi: true } },
      taureau: { select: { nupere: true, nopere: true } },
      groupe: { select: { nom: true } },
      vaccinations: { orderBy: { date: "asc" } },
      evenements: { orderBy: { date: "desc" } },
      traitements: {
        orderBy: { dateDebut: "desc" },
        include: { medicament: { select: { delaiAttenteViandeJ: true } } },
      },
      pesees: { orderBy: { date: "asc" } },
      velagesVache: {
        orderBy: { date: "desc" },
        include: { veau: { select: { nutrav: true, sexbov: true } } },
      },
      saillies: {
        orderBy: { date: "desc" },
        take: 3,
        include: { gestation: true, taureau: { select: { nopere: true, nupere: true } } },
      },
    },
  });
}

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch { /* fallback */ }
  return DEFAULT_PROTOCOLES;
}

export default async function ImpressionAnimalPage({ params }: PageProps) {
  const { nutrav } = await params;
  const [animal, protocoles] = await Promise.all([getAnimal(nutrav), getProtocoles()]);
  if (!animal) notFound();

  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const ageLabel = formatAge(animal.danais);

  const protocolSteps = getVaccinProtocolSteps(animal.danais, animal.vaccinations, protocoles);
  const mheStatus = isMheVendable(animal.vaccinations);

  const lastPesee = animal.pesees.at(-1);
  let gmqGlobal: number | null = null;
  if (animal.pesees.length >= 2) {
    const first = animal.pesees[0];
    const last = animal.pesees[animal.pesees.length - 1];
    const jours = differenceInDays(last.date, first.date);
    if (jours > 0) gmqGlobal = Math.round(((last.poids - first.poids) / jours) * 1000);
  }

  const traitementsActifs = animal.traitements.filter((t) => {
    const dateFin = addDays(new Date(t.dateDebut), t.dureeJours);
    const dateFinAttente = t.medicament?.delaiAttenteViandeJ
      ? addDays(dateFin, t.medicament.delaiAttenteViandeJ)
      : dateFin;
    return now < dateFinAttente;
  });

  return (
    <>
      {/* Screen nav */}
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href={`/troupeau/${nutrav}`} className="text-sm text-gray-600 hover:text-gray-800">
          ← Retour fiche animal
        </Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">GAEC Samuel &amp; Céline</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Fiche individuelle</h1>
          <p className="text-xs text-gray-400 mt-1">Imprimée le {printDate}</p>
        </div>

        {/* Identity block */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-5 text-sm">
          <Row label="N° de travail" value={animal.nutrav} bold />
          <Row label="Nom" value={animal.nobovi ?? "—"} bold />
          <Row label="Date de naissance" value={fmt(animal.danais)} />
          <Row label="Âge" value={ageLabel} />
          <Row label="Sexe" value={animal.sexbov === "F" ? "Femelle" : "Mâle"} />
          <Row label="Race" value={animal.race} />
          {animal.groupe && <Row label="Groupe / Lot" value={animal.groupe.nom} />}
          {animal.mere && <Row label="Mère" value={`${animal.mere.nutrav}${animal.mere.nobovi ? ` (${animal.mere.nobovi})` : ""}`} />}
          {animal.taureau && <Row label="Père" value={`${animal.taureau.nopere ?? animal.taureau.nupere}`} />}
          {lastPesee && <Row label="Dernier poids" value={`${lastPesee.poids} kg — ${fmt(lastPesee.date)}`} />}
          {gmqGlobal !== null && <Row label="GMQ global" value={`${gmqGlobal} g/j`} />}
        </div>

        {/* MHE status */}
        <div className={`mb-5 px-3 py-2 rounded border text-sm font-medium ${mheStatus.vendable ? "bg-green-50 border-green-300 text-green-800" : "bg-orange-50 border-orange-300 text-orange-800"}`}>
          Vendabilité MHE : {mheStatus.vendable ? "✓ Conforme" : `✗ ${mheStatus.reason}`}
        </div>

        {/* Protocole vaccinal */}
        {protocolSteps.length > 0 && (
          <Section title="Protocole vaccinal">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Vaccin</Th>
                  <Th>Statut</Th>
                  <Th>Date réalisé</Th>
                  <Th>Obligatoire vente</Th>
                </tr>
              </thead>
              <tbody>
                {protocolSteps.map((step) => (
                  <tr key={step.vaccin} className={step.isUrgent ? "bg-red-50" : step.status === "done" ? "bg-white" : "bg-yellow-50"}>
                    <Td>{step.label}</Td>
                    <Td>{step.status === "done" ? "✓ Fait" : step.status === "due" ? (step.isUrgent ? "⚠ Urgent" : "À faire") : "Pas encore éligible"}</Td>
                    <Td>{step.doneDate ? fmt(step.doneDate) : "—"}</Td>
                    <Td>{step.isMandatory ? "Oui" : "Non"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Vaccinations historique */}
        {animal.vaccinations.length > 0 && (
          <Section title="Historique vaccinations">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date</Th><Th>Vaccin</Th><Th>Voie</Th><Th>Dose</Th>
                </tr>
              </thead>
              <tbody>
                {animal.vaccinations.map((v) => (
                  <tr key={v.id} className="odd:bg-white even:bg-gray-50">
                    <Td>{fmt(v.date)}</Td>
                    <Td>{v.vaccin}</Td>
                    <Td>{v.voie ?? "—"}</Td>
                    <Td>{v.dose != null ? `${v.dose} ml` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Traitements actifs */}
        {traitementsActifs.length > 0 && (
          <Section title="Traitements en cours / délai d'attente">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Médicament</Th><Th>Début</Th><Th>Durée</Th><Th>Fin traitement</Th><Th>Fin attente viande</Th>
                </tr>
              </thead>
              <tbody>
                {traitementsActifs.map((t) => {
                  const dateFin = addDays(new Date(t.dateDebut), t.dureeJours);
                  const dateFinAttente = t.medicament?.delaiAttenteViandeJ
                    ? addDays(dateFin, t.medicament.delaiAttenteViandeJ)
                    : null;
                  return (
                    <tr key={t.id} className="odd:bg-white even:bg-gray-50">
                      <Td>{t.medicamentNom}</Td>
                      <Td>{fmt(t.dateDebut)}</Td>
                      <Td>{t.dureeJours}j</Td>
                      <Td>{fmt(dateFin)}</Td>
                      <Td className={dateFinAttente && now < dateFinAttente ? "font-bold text-orange-700" : ""}>
                        {dateFinAttente ? fmt(dateFinAttente) : "Aucune"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        {/* Historique traitements */}
        {animal.traitements.length > traitementsActifs.length && (
          <Section title="Historique traitements">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date</Th><Th>Médicament</Th><Th>Durée</Th><Th>Motif</Th>
                </tr>
              </thead>
              <tbody>
                {animal.traitements
                  .filter((t) => {
                    const dateFin = addDays(new Date(t.dateDebut), t.dureeJours);
                    const dateFinAttente = t.medicament?.delaiAttenteViandeJ
                      ? addDays(dateFin, t.medicament.delaiAttenteViandeJ)
                      : dateFin;
                    return now >= dateFinAttente;
                  })
                  .map((t) => (
                    <tr key={t.id} className="odd:bg-white even:bg-gray-50">
                      <Td>{fmt(t.dateDebut)}</Td>
                      <Td>{t.medicamentNom}</Td>
                      <Td>{t.dureeJours}j</Td>
                      <Td>{t.motif ?? "—"}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Pesées */}
        {animal.pesees.length > 0 && (
          <Section title="Historique pesées">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date</Th><Th>Poids (kg)</Th><Th>GMQ depuis précédente (g/j)</Th>
                </tr>
              </thead>
              <tbody>
                {animal.pesees.map((p, i) => {
                  const prev = i > 0 ? animal.pesees[i - 1] : null;
                  let gmq: number | null = null;
                  if (prev) {
                    const j = differenceInDays(p.date, prev.date);
                    if (j > 0) gmq = Math.round(((p.poids - prev.poids) / j) * 1000);
                  }
                  return (
                    <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                      <Td>{fmt(p.date)}</Td>
                      <Td>{p.poids}</Td>
                      <Td>{gmq !== null ? `${gmq} g/j` : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        {/* Reproduction (femelles) */}
        {animal.sexbov === "F" && animal.saillies.length > 0 && (
          <Section title="Suivi reproduction">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date saillie</Th><Th>Type</Th><Th>Père</Th><Th>Résultat écho</Th><Th>Date vélage</Th>
                </tr>
              </thead>
              <tbody>
                {animal.saillies.map((s) => {
                  const velage = animal.velagesVache.find((v) =>
                    s.gestation?.id ? v.gestationId === s.gestation?.id : false
                  );
                  return (
                    <tr key={s.id} className="odd:bg-white even:bg-gray-50">
                      <Td>{fmt(s.date)}</Td>
                      <Td>{s.type}</Td>
                      <Td>{s.taureau?.nopere ?? s.taureau?.nupere ?? "IA"}</Td>
                      <Td>{s.gestation?.resultatEcho ?? "—"}</Td>
                      <Td>{velage ? fmt(velage.date) : s.gestation?.dateVelagePrevue ? `Prévu ${fmt(s.gestation.dateVelagePrevue)}` : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        {/* Vélages (femelles) */}
        {animal.sexbov === "F" && animal.velagesVache.length > 0 && (
          <Section title="Historique vélages">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date</Th><Th>Qualificatif</Th><Th>Veau</Th><Th>Sexe</Th>
                </tr>
              </thead>
              <tbody>
                {animal.velagesVache.map((v) => (
                  <tr key={v.id} className="odd:bg-white even:bg-gray-50">
                    <Td>{fmt(v.date)}</Td>
                    <Td>{v.qualificatif}</Td>
                    <Td>{v.veau?.nutrav ?? "—"}</Td>
                    <Td>{v.veau?.sexbov ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Événements sanitaires */}
        {animal.evenements.length > 0 && (
          <Section title="Événements sanitaires">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <Th>Date</Th><Th>Type</Th><Th>Description</Th><Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {animal.evenements.map((e) => (
                  <tr key={e.id} className="odd:bg-white even:bg-gray-50">
                    <Td>{fmt(e.date)}</Td>
                    <Td>{e.type}</Td>
                    <Td>{e.description ?? "—"}</Td>
                    <Td>{e.resolu ? "Résolu" : "En cours"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <p className="text-xs text-gray-300 mt-6 text-center print:block hidden">
          Document généré le {printDate} · CESAM TroupeauPro
        </p>
      </div>

      <style>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 10px; color: #111; }
          @page { size: A4 portrait; margin: 1.5cm; }
          table { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
          .bg-green-50 { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-orange-50 { background-color: #fff7ed !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-red-50 { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-yellow-50 { background-color: #fefce8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 min-w-[140px] shrink-0">{label} :</span>
      <span className={bold ? "font-bold text-gray-900" : "text-gray-800"}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-xs">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-gray-300 px-2 py-1 ${className}`}>{children}</td>;
}
