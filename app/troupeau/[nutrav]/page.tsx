import { prisma } from "@/lib/prisma";
import { formatAge, formatDate, getEtatGestation, getBadgeClass, getEtatLabel } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Beef, Syringe, Scale, Baby, AlertCircle } from "lucide-react";
import { differenceInDays } from "date-fns";

interface PageProps {
  params: Promise<{ nutrav: string }>;
}

async function getAnimal(nutrav: string) {
  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    include: {
      mere: { select: { id: true, nutrav: true, nobovi: true } },
      taureau: { select: { id: true, nupere: true, nopere: true, traper: true } },
      veaux: {
        select: { id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true },
        orderBy: { danais: "desc" },
      },
      vaccinations: { orderBy: { date: "desc" } },
      evenements: { orderBy: { date: "desc" } },
      pesees: { orderBy: { date: "desc" } },
      velagesVache: {
        orderBy: { date: "desc" },
        include: {
          veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
        },
      },
      velageVeau: {
        include: {
          vache: { select: { nutrav: true, nobovi: true } },
        },
      },
      saillies: {
        orderBy: { date: "desc" },
        include: { gestation: true, taureau: true },
      },
    },
  });
  return animal;
}

export default async function FicheAnimal({ params }: PageProps) {
  const { nutrav } = await params;
  const animal = await getAnimal(nutrav);

  if (!animal) notFound();

  const derniereSaillie = animal.saillies[0]?.date ?? null;
  const derniereGestation = animal.saillies[0]?.gestation ?? null;
  const etat = animal.sexbov === "F" && !animal.estGenisse
    ? getEtatGestation(
        derniereSaillie,
        derniereGestation?.etat ?? null,
        derniereGestation?.dateVelagePrevue ?? null,
        animal.velagesVache[0]?.date ?? null
      )
    : null;

  // GMQ (gain moyen quotidien)
  let gmq: number | null = null;
  if (animal.pesees.length >= 2) {
    const dernier = animal.pesees[0];
    const premier = animal.pesees[animal.pesees.length - 1];
    const jours = differenceInDays(dernier.date, premier.date);
    if (jours > 0) {
      gmq = Math.round(((dernier.poids - premier.poids) / jours) * 1000);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mt-2">
        <Link href="/troupeau" className="p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-green-700 text-white text-sm font-bold px-2 py-1 rounded-lg font-mono">{animal.nutrav}</span>
            {etat && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${getBadgeClass(etat)}`}>{getEtatLabel(etat)}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-800 mt-1">{animal.nobovi ?? "Sans nom"}</h2>
        </div>
      </div>

      {/* Identité */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Beef size={16} className="text-green-700" />
          Identité
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500">NUTRAV</div>
          <div className="font-mono font-medium">{animal.nutrav}</div>
          <div className="text-gray-500">NUNATI</div>
          <div className="font-mono text-xs">{animal.nunati}</div>
          <div className="text-gray-500">Nom</div>
          <div>{animal.nobovi ?? "-"}</div>
          <div className="text-gray-500">Naissance</div>
          <div>{formatDate(animal.danais)}</div>
          <div className="text-gray-500">Âge</div>
          <div className="font-medium">{formatAge(animal.danais)}</div>
          <div className="text-gray-500">Sexe</div>
          <div>{animal.sexbov === "F" ? (animal.estGenisse ? "Génisse" : "Vache") : "Mâle"}</div>
          <div className="text-gray-500">Statut</div>
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${animal.statut === "ACTIF" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
              {animal.statut}
            </span>
          </div>
          <div className="text-gray-500">Race</div>
          <div className="text-xs">{animal.race.replace("_", " ")}</div>
        </div>
      </div>

      {/* Généalogie */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Généalogie</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Mère</span>
            {animal.mere ? (
              <Link href={`/troupeau/${animal.mere.nutrav}`} className="text-green-700 font-medium hover:underline">
                {animal.mere.nobovi ?? animal.mere.nutrav}
              </Link>
            ) : (
              <span className="text-gray-400">{animal.nomeip ?? "-"}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Père</span>
            <span className="text-gray-700">{animal.taureau?.nopere ?? animal.taureau?.nupere ?? "-"}</span>
          </div>
          {animal.taureau?.traper && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Race père</span>
              <span className="text-gray-700">{animal.taureau.traper}</span>
            </div>
          )}
        </div>

        {/* Veaux */}
        {animal.veaux.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-2">Veaux ({animal.veaux.length})</div>
            <div className="space-y-1">
              {animal.veaux.map((veau) => (
                <Link key={veau.id} href={`/troupeau/${veau.nutrav}`} className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{veau.nutrav}</span>
                    <span className="text-sm text-gray-700">{veau.nobovi ?? "Sans nom"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatAge(veau.danais)}</span>
                    <span className="text-xs">{veau.sexbov === "M" ? "M" : "F"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reproduction (vaches seulement) */}
      {animal.sexbov === "F" && !animal.estGenisse && animal.saillies.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Reproduction</h3>
          <div className="space-y-2">
            {animal.saillies.slice(0, 5).map((saillie) => (
              <div key={saillie.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatDate(saillie.date)}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{saillie.type}</span>
                </div>
                {saillie.taureau && (
                  <div className="text-xs text-gray-500 mt-1">Taureau: {saillie.taureau.nopere ?? saillie.taureau.nupere}</div>
                )}
                {saillie.gestation && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(saillie.gestation.etat as "VERT" | "JAUNE" | "ROUGE" | "ROSE" | "GRIS")}`}>
                      {getEtatLabel(saillie.gestation.etat as "VERT" | "JAUNE" | "ROUGE" | "ROSE" | "GRIS")}
                    </span>
                    {saillie.gestation.dateVelagePrevue && (
                      <span className="text-xs text-gray-500">Vélage prévu: {formatDate(saillie.gestation.dateVelagePrevue)}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vélages */}
      {animal.velagesVache.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Baby size={16} className="text-pink-500" />
            Historique vélages ({animal.velagesVache.length})
          </h3>
          <div className="space-y-2">
            {animal.velagesVache.map((velage) => (
              <div key={velage.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatDate(velage.date)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${velage.qualificatif === "NORMAL" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{velage.qualificatif}</span>
                </div>
                {velage.veau && (
                  <Link href={`/troupeau/${velage.veau.nutrav}`} className="text-xs text-green-700 mt-1 block hover:underline">
                    Veau: {velage.veau.nobovi ?? velage.veau.nutrav} ({velage.veau.sexbov})
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vélage veau */}
      {animal.velageVeau && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Baby size={16} className="text-pink-500" />
            Naissance
          </h3>
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{formatDate(animal.velageVeau.date)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">Mère</span>
              <Link href={`/troupeau/${animal.velageVeau.vache.nutrav}`} className="text-green-700 hover:underline">
                {animal.velageVeau.vache.nobovi ?? animal.velageVeau.vache.nutrav}
              </Link>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">Qualificatif</span>
              <span>{animal.velageVeau.qualificatif}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pesées */}
      {animal.pesees.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Scale size={16} className="text-blue-600" />
            Pesées
          </h3>
          {gmq !== null && (
            <div className="mb-3 bg-blue-50 rounded-lg p-2 text-center">
              <span className="text-xs text-gray-500">GMQ</span>
              <span className="text-lg font-bold text-blue-700 ml-2">{gmq} g/j</span>
            </div>
          )}
          <div className="space-y-1">
            {animal.pesees.map((pesee) => (
              <div key={pesee.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-500">{formatDate(pesee.date)}</span>
                <span className="font-bold text-gray-800">{pesee.poids} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vaccinations */}
      {animal.vaccinations.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Syringe size={16} className="text-purple-600" />
            Vaccinations ({animal.vaccinations.length})
          </h3>
          <div className="space-y-1">
            {animal.vaccinations.map((vacc) => (
              <div key={vacc.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                <div>
                  <span className="font-medium text-gray-800">{vacc.vaccin}</span>
                  {vacc.voie && <span className="text-xs text-gray-400 ml-2">({vacc.voie})</span>}
                </div>
                <span className="text-gray-500 text-xs">{formatDate(vacc.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Événements sanitaires */}
      {animal.evenements.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            Événements sanitaires ({animal.evenements.length})
          </h3>
          <div className="space-y-2">
            {animal.evenements.map((evt) => (
              <div key={evt.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{evt.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDate(evt.date)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${evt.resolu ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {evt.resolu ? "Résolu" : "En cours"}
                    </span>
                  </div>
                </div>
                {evt.description && <div className="text-xs text-gray-500 mt-1">{evt.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
