"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare, Square, Syringe, Pill, AlertTriangle,
  CheckCircle, CheckCircle2, X, List, LayoutGrid, RefreshCw,
  AlertCircle, Clock, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { differenceInDays } from "date-fns";
import { getVaccinProtocolSteps, formatDateShort, type ProtocoleVaccinConfig } from "@/lib/utils";
import VaccinationFormWrapper from "./VaccinationFormWrapper";
import VaccineQuickButton from "./VaccineQuickButton";
import EvenementsTab, { type TraitementItem } from "./EvenementsTab";
import RecordActionsMenu from "@/components/RecordActionsMenu";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface VeauItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  ageLabel: string;
  vaccinsManquants: { vaccin: string; urgent: boolean; raison: string }[];
}

export interface CryptoItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  joursAvantVelage: number;
  dateLabel: string;
  hasCrypto: boolean;
  hasRotavec: boolean;
}

export interface BolusItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  joursAvantVelage: number;
  dateLabel: string;
}

export interface RecentItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  vaccin: string;
  dateLabel: string;
}

export interface VeauProtocolItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  sexbov: string;
  ageLabel: string;
  vaccinations: { id: string; vaccin: string; date: string }[];
}

export interface VacheVaccinsItem {
  id: string;
  nutrav: string;
  nobovi: string | null;
  joursAvantVelage: number;
  dateVelage: string;
  etatGestation: string;
  hasCrypto: boolean;
  hasRotavec: boolean;
  hasBolus: boolean;
}

export interface EvenementItem {
  id: string;
  animalNutrav: string;
  animalNom: string | null;
  type: string;
  symptomes: string[];
  date: string;
  description: string | null;
  resolu: boolean;
}

interface Props {
  veauxAVacciner: VeauItem[];
  tousVeaux: VeauProtocolItem[];
  cryptoRotavec: CryptoItem[];
  bolus: BolusItem[];
  toutesVaches: VacheVaccinsItem[];
  vaccinationsRecentes: RecentItem[];
  protocoles: ProtocoleVaccinConfig[];
  evenements: EvenementItem[];
  traitements: TraitementItem[];
  affichageDelaiAttente?: string;
}

// â”€â”€ Statut vaccinal global pour un veau â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getStatutVaccinal(veau: VeauProtocolItem, protocoles: ProtocoleVaccinConfig[]): "complet" | "en_cours" | "a_faire" {
  const steps = getVaccinProtocolSteps(
    new Date(veau.danais),
    veau.vaccinations.map((v) => ({ vaccin: v.vaccin, date: new Date(v.date) })),
    protocoles
  );
  const done = steps.filter((s) => s.status === "done").length;
  const due = steps.filter((s) => s.status === "due").length;
  if (due === 0 && done > 0) return "complet";
  if (done > 0) return "en_cours";
  return "a_faire";
}

function StatutBadge({ statut }: { statut: "complet" | "en_cours" | "a_faire" }) {
  if (statut === "complet") return (
    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800">
      <ShieldCheck size={12} /> Complet
    </span>
  );
  if (statut === "en_cours") return (
    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-800">
      <Clock size={12} /> En cours
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-800">
      <AlertCircle size={12} /> Ã€ faire
    </span>
  );
}

// â”€â”€ Key format: "nutrav::vaccin" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function key(nutrav: string, vaccin: string) {
  return `${nutrav}::${vaccin}`;
}
function parseKey(k: string): { nutrav: string; vaccin: string } {
  const [nutrav, vaccin] = k.split("::");
  return { nutrav, vaccin };
}

const today = new Date().toISOString().slice(0, 10);

const VOIES = [
  { value: "IM", label: "IM â€” Intramusculaire" },
  { value: "SC", label: "SC â€” Sous-cutanÃ©" },
  { value: "IN", label: "IN â€” Intranasale" },
  { value: "PO", label: "PO â€” Oral (bolus)" },
];

// â”€â”€ Checkbox row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CheckRow({
  k, label, detail, urgent, selected, onToggle,
}: {
  k: string; label: string; detail?: string; urgent?: boolean;
  selected: boolean; onToggle: (k: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
        selected
          ? "bg-green-50 border-green-300"
          : urgent
          ? "bg-red-50 border-red-200 hover:bg-red-100"
          : "bg-white border-gray-100 hover:bg-gray-50"
      }`}
    >
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        selected ? "bg-green-600 border-green-600" : "border-gray-300"
      }`}>
        {selected && <span className="text-white text-xs font-bold">âœ“</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold">{label.split(" ")[0]}</span>
          <span className="text-sm text-gray-800">{label.split(" ").slice(1).join(" ")}</span>
          {urgent && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">URGENT</span>}
        </div>
        {detail && <div className="text-xs text-gray-400 mt-0.5">{detail}</div>}
      </div>
    </button>
  );
}

// â”€â”€ Section wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Section({
  title, icon, count, color, children, sectionKeys, selected, onToggleAll,
  sessionMode,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  children: React.ReactNode;
  sectionKeys: string[];
  selected: Set<string>;
  onToggleAll: (keys: string[], select: boolean) => void;
  sessionMode: boolean;
}) {
  if (count === 0) return null;
  const allSelected = sectionKeys.length > 0 && sectionKeys.every((k) => selected.has(k));
  const someSelected = sectionKeys.some((k) => selected.has(k));

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold flex items-center gap-2 ${color}`}>
          {icon}
          {title}
          <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
        </h3>
        {sessionMode && sectionKeys.length > 0 && (
          <button
            onClick={() => onToggleAll(sectionKeys, !allSelected)}
            className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
              allSelected
                ? "bg-green-600 text-white border-green-600"
                : "border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
            }`}
          >
            {allSelected ? "Tout dÃ©sÃ©lectionner" : someSelected ? "Tout sÃ©lectionner" : "Tout sÃ©lectionner"}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// â”€â”€ Recent row with delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecentRow({ vacc, onDeleted }: { vacc: RecentItem; onDeleted: () => void }) {
  async function handleDelete() {
    await fetch(`/api/vaccinations/${vacc.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{vacc.nutrav}</span>
        <span className="text-gray-700 truncate">{vacc.nobovi ?? "Sans nom"}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{vacc.vaccin}</span>
        <span className="text-xs text-gray-400">{vacc.dateLabel}</span>
        <RecordActionsMenu actions={[{
          label: "Annuler cette vaccination",
          tone: "danger",
          confirmMessage: `Annuler la vaccination ${vacc.vaccin} de l'animal ${vacc.nutrav} ?`,
          onSelect: handleDelete,
        }]} />
      </div>
    </div>
  );
}

// â”€â”€ Recent section with bulk delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecentSection({ items, onRefresh }: { items: RecentItem[]; onRefresh: () => void }) {
  const [loadingAll, setLoadingAll] = useState(false);

  async function handleDeleteAll() {
    setLoadingAll(true);
    try {
      await Promise.all(items.map((v) => fetch(`/api/vaccinations/${v.id}`, { method: "DELETE" })));
      onRefresh();
    } finally {
      setLoadingAll(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          Vaccinations rÃ©centes (7 derniers jours)
        </h3>
        <RecordActionsMenu actions={[{
          label: `Supprimer les ${items.length} saisies`,
          tone: "danger",
          disabled: loadingAll,
          confirmMessage: `Supprimer les ${items.length} vaccinations rÃ©centes ?`,
          onSelect: handleDeleteAll,
        }]} />
      </div>
      <p className="text-xs text-gray-400 mb-3">Appuyer sur âœ• pour annuler une erreur de saisie</p>
      <div className="space-y-1">
        {items.map((vacc) => (
          <RecentRow key={vacc.id} vacc={vacc} onDeleted={onRefresh} />
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Onglet Vaccins Veaux â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function VaccinsVeauxTab({ tousVeaux, protocoles, onRefresh }: { tousVeaux: VeauProtocolItem[]; protocoles: ProtocoleVaccinConfig[]; onRefresh: () => void }) {
  const [filtre, setFiltre] = useState<"tous" | "a_faire" | "en_cours" | "complet">("tous");

  const veauxAvecStatut = tousVeaux.map((v) => ({
    ...v,
    statut: getStatutVaccinal(v, protocoles),
  }));

  const filtered = filtre === "tous" ? veauxAvecStatut : veauxAvecStatut.filter((v) => v.statut === filtre);
  const counts = {
    a_faire: veauxAvecStatut.filter((v) => v.statut === "a_faire").length,
    en_cours: veauxAvecStatut.filter((v) => v.statut === "en_cours").length,
    complet: veauxAvecStatut.filter((v) => v.statut === "complet").length,
  };

  return (
    <div className="space-y-4">
      {/* Filtres visuels */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: "tous", label: "Tous", count: tousVeaux.length, cls: "bg-gray-100 text-gray-700 border-gray-200" },
          { value: "a_faire", label: "ðŸ”´ Ã€ faire", count: counts.a_faire, cls: "bg-red-50 text-red-700 border-red-200" },
          { value: "en_cours", label: "ðŸŸ  En cours", count: counts.en_cours, cls: "bg-orange-50 text-orange-700 border-orange-200" },
          { value: "complet", label: "ðŸŸ¢ Complet", count: counts.complet, cls: "bg-green-50 text-green-700 border-green-200" },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFiltre(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filtre === opt.value ? "ring-2 ring-offset-1 ring-gray-400 " + opt.cls : opt.cls
            }`}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-green-500" />
          <div className="text-sm">Aucun animal dans cette catÃ©gorie</div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((veau) => {
          const steps = getVaccinProtocolSteps(
            new Date(veau.danais),
            veau.vaccinations.map((v) => ({ vaccin: v.vaccin, date: new Date(v.date) })),
            protocoles
          );
          const urgentSteps = steps.filter((s) => s.status === "due" && s.isUrgent);
          const dueSteps = steps.filter((s) => s.status === "due");

          return (
            <div
              key={veau.id}
              className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                veau.statut === "complet" ? "border-green-400"
                : veau.statut === "en_cours" ? "border-orange-400"
                : urgentSteps.length > 0 ? "border-red-500" : "border-red-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/troupeau/${veau.nutrav}`} className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-green-100 transition-colors">
                      {veau.nutrav}
                    </Link>
                    <span className="text-sm font-semibold text-gray-800">{veau.nobovi ?? "Sans nom"}</span>
                    <span className="text-xs text-gray-400">{veau.ageLabel}</span>
                    <span className="text-xs text-gray-400">{veau.sexbov === "M" ? "â™‚" : "â™€"}</span>
               ÷M»¶‰žËkºwµç@€€€€€€ô¥ô4(€€€€€€€€€€ð½M•Ñ¥½¸ø4(4(€€€€€€€€€ì¼¨Y•…Õàƒ€Ù…¥¹•È€¨½ô4(€€€€€€€€€€ñM•Ñ¥½¸4(€€€€€€€€€€€Ñ¥Ñ±”ô‰Y•…Õàƒ€Ù…¥¹•Èˆ4(€€€€€€€€€€€¥½¸õìñ±•ÉÑQÉ¥…¹±”Í¥é”õìÄÙô±…ÍÍ9…µ”ô‰Ñ•áÐµå•±±½Ü´ÔÀÀˆ€¼ùô4(€€€€€€€€€€€½Õ¹ÐõíÙ•…ÕáY…¥¹•È¹±•¹Ñ¡ô4(€€€€€€€€€€€½±½Èô‰Ñ•áÐµå•±±½Ü´àÀÀˆ4(€€€€€€€€€€€Í•Ñ¥½¹-•åÌõíÙ•…Õá-•åÍô4(€€€€€€€€€€€Í•±•Ñ•õíÍ•±•Ñ•‘ô4(€€€€€€€€€€€½¹Q½±•±°õíÑ½±•±±ô4(€€€€€€€€€€€Í•ÍÍ¥½¹5½‘”õíÍ•ÍÍ¥½¹5½‘•ô4(€€€€€€€€€€ø4(€€€€€€€€€€€íÙ•…ÕáY…¥¹•È¹±•¹Ñ €ôôô€À€ü€ 4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµ•¹Ñ•ÈÑ•áÐµÉ…ä´ÐÀÀÁä´Øˆø4(€€€€€€€€€€€€€€€€ñ¡•­¥É±”Í¥é”õìÈÑô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼µˆ´ÈÑ•áÐµÉ••¸´ÔÀÀˆ€¼ø4(€€€€€€€€€€€€€€€Q½ÕÌ±•ÌÁÉ½Ñ½½±•ÌÍ½¹Ðƒ€©½ÕÈ€„4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€Ù•…ÕáY…¥¹•È¹µ…À ¡…¹¥µ…°¤€ôøì4(€€€€€€€€€€€€€€€½¹ÍÐ•ÍÑUÉ•¹Ð€ô…¹¥µ…°¹Ù…¥¹Í5…¹ÅÕ…¹ÑÌ¹Í½µ” ¡Ø¤€ôøØ¹ÕÉ•¹Ð¤ì4(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•ÍÍ¥½¹5½‘”€ü€ 4(€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí…¹¥µ…°¹¥‘ô±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø4(€€€€€€€€€€€€€€€€€€€í…¹¥µ…°¹Ù…¥¹Í5…¹ÅÕ…¹ÑÌ¹µ…À ¡Ø¤€ôøì4(€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¬€ô­•ä¡…¹¥µ…°¹¹ÕÑÉ…Ø°Ø¹Ù…¥¸¤ì4(€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ 4(€€€€€€€€€€€€€€€€€€€€€€€€ñ¡•­I½Ü­•äõí­ô¬õí­ô4(€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°õí€‘í…¹¥µ…°¹¹ÕÑÉ…Ùô€‘í…¹¥µ…°¹¹½‰½Ù¤€üü€‰M…¹Ì¹½´‰ôƒŠP€‘íØ¹Ù…¥¹õô4(€€€€€€€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°õí€‘í…¹¥µ…°¹…•1…‰•±ôƒ
Ü€‘íØ¹É…¥Í½¹õô4(€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉ•¹ÐõíØ¹ÕÉ•¹Ñô4(€€€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•õíÍ•±•Ñ•¹¡…Ì¡¬¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õíÑ½±•ô4(€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€€€€€€€€€ô¥ô4(€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí…¹¥µ…°¹¥‘ô±…ÍÍ9…µ”õí‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´Ì€‘í•ÍÑUÉ•¹Ð€ü€‰‰½É‘•ÈµÉ•´ÈÀÀ‰œµÉ•´ÔÀˆ€è€‰‰½É‘•Èµå•±±½Ü´ÄÀÀ‰œµå•±±½Ü´ÔÀ‰õôø4(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉÐ©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µÜ´Àˆø4(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ1¥¹¬¡É•˜õí€½ÑÉ½ÕÁ•…Ô¼‘í…¹¥µ…°¹¹ÕÑÉ…Ùõô±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµáÌ‰œµÝ¡¥Ñ”Áà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀˆùí…¹¥µ…°¹¹ÕÑÉ…Ùôð½1¥¹¬ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹Ðµµ•‘¥Õ´Ñ•áÐµÉ…ä´àÀÀˆùí…¹¥µ…°¹¹½‰½Ù¤€üü€‰M…¹Ì¹½´‰ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµÉ…ä´ÔÀÀµÐ´Äˆùí…¹¥µ…°¹…•1…‰•±ôð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à™±•àµÝÉ…À…À´ÄµÐ´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€€€€í…¹¥µ…°¹Ù…¥¹Í5…¹ÅÕ…¹ÑÌ¹µ…À ¡Ø¤€ôø€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸­•äõíØ¹Ù…¥¹ô±…ÍÍ9…µ”õíÑ•áÐµáÌÁà´ÈÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°™½¹Ðµµ•‘¥Õ´€‘íØ¹ÕÉ•¹Ð€ü€‰‰œµÉ•´ÔÀÀÑ•áÐµÝ¡¥Ñ”ˆ€è€‰‰œµå•±±½Ü´ÐÀÀÑ•áÐµ‰±…¬‰õôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€íØ¹Ù…¥¹ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµÉ…ä´ÐÀÀµÐ´Äˆùí…¹¥µ…°¹Ù…¥¹Í5…¹ÅÕ…¹ÑÌ¹µ…À ¡Ø¤€ôøØ¹É…¥Í½¸¤¹©½¥¸ ˆƒŠˆ€ˆ¥ôð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à™±•àµ½°¥Ñ•µÌµ•¹…À´Ä¸Ô™±•àµÍ¡É¥¹¬´Àˆø4(€€€€€€€€€€€€€€€€€€€€€€€í•ÍÑUÉ•¹Ð€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµáÌ‰œµÉ•´ÔÀÀÑ•áÐµÝ¡¥Ñ”Áà´ÈÁä´ÄÉ½Õ¹‘•µ™Õ±°ˆùUI9Pð½ÍÁ…¸ùô4(€€€€€€€€€€€€€€€€€€€€€€€í…¹¥µ…°¹Ù…¥¹Í5…¹ÅÕ…¹ÑÌ¹Í±¥” À°€È¤¹µ…À ¡Ø¤€ôø€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€ñY…¥¹•EÕ¥­	ÕÑÑ½¸­•äõíØ¹Ù…¥¹ô¹ÕÑÉ…Øõí…¹¥µ…°¹¹ÕÑÉ…ÙôÙ…¥¸õíØ¹Ù…¥¹ô±…‰•°õí€¬€‘íØ¹Ù…¥¹õô€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€€€ô¤4(€€€€€€€€€€€€¥ô4(€€€€€€€€€€ð½M•Ñ¥½¸ø4(4(€€€€€€€€€ì¼¨µÁÑäÍÑ…Ñ”€¨½ô4(€€€€€€€€€íÑ½Ñ…±A•¹‘¥¹œ€ôôô€À€˜˜€ 4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”É½Õ¹‘•µá°Í¡…‘½ÜÀ´àÑ•áÐµ•¹Ñ•Èˆø4(€€€€€€€€€€€€€€ñ¡•­¥É±”ÈÍ¥é”õìÌÙô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼µˆ´ÌÑ•áÐµÉ••¸´ÔÀÀˆ€¼ø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÉ…ä´ÜÀÀˆùQ½ÕÐ•ÍÐƒ€©½ÕÈ€„ð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµÉ…ä´ÐÀÀµÐ´ÄˆùÕÕ¸ÑÉ…¥Ñ•µ•¹Ð•¸…ÑÑ•¹Ñ”ð½‘¥Øø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€¥ô4(€€€€€€€€ð¼ø4(€€€€€€¥ô4(4(€€€€€ì¼¨ƒŠRŠR YUAHY%8ƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR €¨½ô4(€€€€€íÙ¥•Ý5½‘”€ôôô€‰ÑÉ…¥Ñ•µ•¹Ðˆ€˜˜€ 4(€€€€€€€€ðø4(€€€€€€€€€íÉ½ÕÁÍ	åY…¥¸¹Í¥é”€ôôô€À€ü€ 4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”É½Õ¹‘•µá°Í¡…‘½ÜÀ´àÑ•áÐµ•¹Ñ•Èˆø4(€€€€€€€€€€€€€€ñ¡•­¥É±”ÈÍ¥é”õìÌÙô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼µˆ´ÌÑ•áÐµÉ••¸´ÔÀÀˆ€¼ø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÉ…ä´ÜÀÀˆùQ½ÕÐ•ÍÐƒ€©½ÕÈ€„ð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµÉ…ä´ÐÀÀµÐ´ÄˆùÕÕ¸ÑÉ…¥Ñ•µ•¹Ð•¸…ÑÑ•¹Ñ”ð½‘¥Øø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€l¸¸¹É½ÕÁÍ	åY…¥¸¹•¹ÑÉ¥•Ì ¥t¹µ…À ¡mÙ…¥¸°…¹¥µ…±Ít¤€ôøì4(€€€€€€€€€€€€€½¹ÍÐÉ½ÕÁ-•åÌ€ô…¹¥µ…±Ì¹µ…À ¡„¤€ôø­•ä¡„¹¹ÕÑÉ…Ø°Ù…¥¸¤¤ì4(€€€€€€€€€€€€€½¹ÍÐ…±±M•°€ôÉ½ÕÁ-•åÌ¹•Ù•Éä ¡¬¤€ôøÍ•±•Ñ•¹¡…Ì¡¬¤¤ì4(€€€€€€€€€€€€€½¹ÍÐ¥ÍUÉ•¹ÑÉ½ÕÀ€ô…¹¥µ…±Ì¹Í½µ” ¡„¤€ôø„¹ÕÉ•¹Ð¤ì4(€€€€€€€€€€€€€½¹ÍÐ‰!•…‘•È€ô¥ÍUÉ•¹ÑÉ½ÕÀ€ü€‰‰œµÉ•´ÔÀ‰½É‘•ÈµÉ•´ÈÀÀˆ€è€‰‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÈÀÀˆì4(€€€€€€€€€€€€€É•ÑÕÉ¸€ 4(€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÙ…¥¹ô±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”É½Õ¹‘•µá°Í¡…‘½Ü½Ù•É™±½Üµ¡¥‘‘•¸ˆø4(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸Áà´ÐÁä´Ì‰½É‘•Èµˆ€‘í‰!•…‘•Éõôø4(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÑ•áÐµÍ´™½¹Ðµ‰½±Áà´È¸ÔÁä´ÄÉ½Õ¹‘•µ±œ€‘ì4(€€€€€€€€€€€€€€€€€€€€€€€¥ÍUÉ•¹ÑÉ½ÕÀ€ü€‰‰œµÉ•´ÔÀÀÑ•áÐµÝ¡¥Ñ”ˆ€è4(€€€€€€€€€€€€€€€€€€€€€€€Ù…¥¸€ôôô€‰IeAQ<ˆñðÙ…¥¸€ôôô€‰I=QYˆ€ü€‰‰œµÁ¥¹¬´ÔÀÀÑ•áÐµÝ¡¥Ñ”ˆ€è4(€€€€€€€€€€€€€€€€€€€€€€€Ù…¥¸€ôôô€‰	=1ULˆñðÙ…¥¸€ôôô€‰5QI	=0ˆ€ü€‰‰œµ…µ‰•È´ÔÀÀÑ•áÐµÝ¡¥Ñ”ˆ€è4(€€€€€€€€€€€€€€€€€€€€€€€€‰‰œµÁÕÉÁ±”´ØÀÀÑ•áÐµÝ¡¥Ñ”ˆ4(€€€€€€€€€€€€€€€€€€€€€õôùíÙ…¥¹ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµÉ…ä´ØÀÀˆùí…¹¥µ…±Ì¹±•¹Ñ €ø€Ä€ü€‘í…¹¥µ…±Ì¹±•¹Ñ¡ô…¹¥µ…Õá€€è€‘í…¹¥µ…±Ì¹±•¹Ñ¡ô…¹¥µ…±ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€íÍ•ÍÍ¥½¹5½‘”€˜˜€ 4(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÑ½±•±°¡É½ÕÁ-•åÌ°€……±±M•°¥ô4(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áÐµáÌ™½¹Ðµµ•‘¥Õ´Áà´ÌÁä´ÄÉ½Õ¹‘•µ±œ‰½É‘•ÈÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌ€‘ì4(€€€€€€€€€€€€€€€€€€€€€€€€€…±±M•°€ü€‰‰œµÉ••¸´ØÀÀÑ•áÐµÝ¡¥Ñ”‰½É‘•ÈµÉ••¸´ØÀÀˆ€è€‰‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áÐµÉ…ä´ØÀÀ¡½Ù•Èé‰½É‘•ÈµÉ••¸´ÐÀÀˆ4(€€€€€€€€€€€€€€€€€€€€€€€õô4(€€€€€€€€€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€€€€€€€€í…±±M•°€ü€‰Q½ÕÐ“¥Ï¥°¸ˆ€è€‰Q½ÕÐÏ¥°¸‰ô4(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€€€€€€€€€¥ô4(€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀÁà´ÈÁä´ÈÍÁ…”µä´Äˆø4(€€€€€€€€€€€€€€€€€€€í…¹¥µ…±Ì¹µ…À ¡„¤€ôøì4(€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¬€ô­•ä¡„¹¹ÕÑÉ…Ø°Ù…¥¸¤ì4(€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•ÍÍ¥½¹5½‘”€ü€ 4(€€€€€€€€€€€€€€€€€€€€€€€€ñ¡•­I½Ü­•äõí­ô¬õí­ô4(€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°õí€‘í„¹¹ÕÑÉ…Ùô€‘í„¹¹½‰½Ù¤€üü€‰M…¹Ì¹½´‰õô4(€€€€€€€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°õí„¹‘•Ñ…¥±ô4(€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉ•¹Ðõí„¹ÕÉ•¹Ñô4(€€€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•õíÍ•±•Ñ•¹¡…Ì¡¬¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õíÑ½±•ô4(€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí­ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸Áä´ÈÁà´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ1¥¹¬¡É•˜õí€½ÑÉ½ÕÁ•…Ô¼‘í„¹¹ÕÑÉ…Ùõô±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµáÌ‰œµÉ…ä´ÄÀÀÁà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•™½¹Ðµ‰½±ˆø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í„¹¹ÕÑÉ…Ùô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½1¥¹¬ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµÉ…ä´àÀÀˆùí„¹¹½‰½Ù¤€üü€‰M…¹Ì¹½´‰ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í„¹ÕÉ•¹Ð€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµáÌ‰œµÉ•´ÔÀÀÑ•áÐµÝ¡¥Ñ”Áà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•ˆùUI9Pð½ÍÁ…¸ùô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµÉ…ä´ÐÀÀµÐ´À¸Ôµ°´À¸Ôˆùí„¹‘•Ñ…¥±ôð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€€€ñY…¥¹•EÕ¥­	ÕÑÑ½¸¹ÕÑÉ…Øõí„¹¹ÕÑÉ…ÙôÙ…¥¸õíÙ…¥¹ô±…‰•°ôˆ¬Y…±¥‘•Èˆ€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€€€€€€€€€ô¥ô4(€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€ô¤4(€€€€€€€€€€¥ô4(4(€€€€€€€€€ì¼¨Q½ÕÐÏ¥±•Ñ¥½¹¹•È±½‰…°€¨½ô4(€€€€€€€€€íÍ•ÍÍ¥½¹5½‘”€˜˜É½ÕÁÍ	åY…¥¸¹Í¥é”€ø€À€˜˜€ 4(€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÑ½±•±°¡…±±QÉ…¥Ñ•µ•¹Ñ-•åÌ°…±±QÉ…¥Ñ•µ•¹Ñ-•åÌ¹•Ù•Éä ¡¬¤€ôøÍ•±•Ñ•¹¡…Ì¡¬¤¤€ü™…±Í”€èÑÉÕ”¥ô4(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°Áä´È¸Ô‰½É‘•È´È‰½É‘•Èµ‘…Í¡•‰½É‘•ÈµÉ…ä´ÌÀÀÉ½Õ¹‘•µá°Ñ•áÐµÍ´Ñ•áÐµÉ…ä´ÔÀÀ¡½Ù•Èé‰½É‘•ÈµÉ••¸´ÐÀÀ¡½Ù•ÈéÑ•áÐµÉ••¸´ÜÀÀÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌˆ4(€€€€€€€€€€€€ø4(€€€€€€€€€€€€€í…±±QÉ…¥Ñ•µ•¹Ñ-•åÌ¹•Ù•Éä ¡¬¤€ôøÍ•±•Ñ•¹¡…Ì¡¬¤¤€ü€‰Q½ÕÐ“¥Ï¥±•Ñ¥½¹¹•Èˆ€è€‰Q½ÕÐÏ¥±•Ñ¥½¹¹•È‰ô4(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€¥ô4(€€€€€€€€ð¼ø4(€€€€€€¥ô4(4(€€€€€ì¼¨Y…¥¹…Ñ¥½¹ÌË¥•¹Ñ•ÌƒŠPÙ¥Í¥‰±”ÍÕÈÑ½ÕÌ±•Ì½¹±•ÑÌ€¨½ô4(€€€€€íÙ…¥¹…Ñ¥½¹ÍI••¹Ñ•Ì¹±•¹Ñ €ø€À€˜˜€ 4(€€€€€€€€ñI••¹ÑM•Ñ¥½¸¥Ñ•µÌõíÙ…¥¹…Ñ¥½¹ÍI••¹Ñ•Íô½¹I•™É•Í õì ¤€ôøÉ½ÕÑ•È¹É•™É•Í  ¥ô€¼ø4(€€€€€€¥ô4(4(€€€€€ì¼¨¥¸½¹±•ÐÕÉ•¹Ð€¨½ô4(€€€€€€ð¼ø4(€€€€€€¥ô4(4(€€€€€ì¼¨ƒŠRŠR ±½…Ñ¥¹œÍ•±•Ñ¥½¸‰…ÈƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR €¨½ô4(€€€€€íÍ•ÍÍ¥½¹5½‘”€˜˜Í•±•Ñ•¹Í¥é”€ø€À€˜˜€ 4(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•‰½ÑÑ½´´ÈÀ±•™Ð´ÀÉ¥¡Ð´Àè´ÐÀÁà´Ðˆø4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÉ••¸´ÜÀÀÑ•áÐµÝ¡¥Ñ”É½Õ¹‘•´Éá°Í¡…‘½Ü´Éá°Áà´ÐÁä´Ì™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸ˆø4(€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‰½±Ñ•áÐµ‰…Í”ˆùíÍ•±•Ñ•¹Í¥é•ôÑÉ…¥Ñ•µ•¹ÑíÍ•±•Ñ•¹Í¥é”€ø€Ä€ü€‰Ìˆ€è€ˆ‰ôÏ¥±•Ñ¥½¹»¥íÍ•±•Ñ•¹Í¥é”€ø€Ä€ü€‰Ìˆ€è€ˆ‰ôð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµÉ••¸´ÈÀÀµÐ´À¸Ôˆø4(€€€€€€€€€€€€€€€íl¸¸¹¹•ÜM•Ð¡l¸¸¹Í•±•Ñ•‘t¹µ…À ¡¬¤€ôøÁ…ÉÍ•-•ä¡¬¤¹Ù…¥¸¤¥t¹©½¥¸ ˆ°€ˆ¥ô4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•¡¹•ÜM•Ð ¤¥ô4(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÁà´ÌÁä´È‰œµÉ••¸´ØÀÀÉ½Õ¹‘•µá°Ñ•áÐµÍ´™½¹Ðµµ•‘¥Õ´¡½Ù•Èé‰œµÉ••¸´ÔÀÀÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌˆ4(€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€ñ`Í¥é”õìÄÕô€¼øQ½ÕÐ“¥½¡•È4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøìÍ•Ñ	…Ñ¡…Ñ”¡Ñ½‘…ä¤ìÍ•ÑM¡½Ý5½‘…°¡ÑÉÕ”¤ìõô4(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”Ñ•áÐµÉ••¸´ÜÀÀ™½¹Ðµ‰½±Áà´ÐÁä´ÈÉ½Õ¹‘•µá°Ñ•áÐµÍ´¡½Ù•Èé‰œµÉ••¸´ÔÀ…Ñ¥Ù”éÍ…±”´äÔÑÉ…¹Í¥Ñ¥½¸µ…±°ˆ4(€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€Y…±¥‘•ÈƒŠrL4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€ð½‘¥Øø4(€€€€€€¥ô4(4(€€€€€ì¼¨ƒŠRŠR 	…Ñ µ½‘…°ƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR €¨½ô4(€€€€€íÍ¡½Ý5½‘…°€˜˜€ 4(€€€€€€€€ñ‘¥Ø4(€€€€€€€€€±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ð´À‰œµ‰±…¬¼ÔÀè´ÔÀ™±•à¥Ñ•µÌµ•¹Í´é¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•Èˆ4(€€€€€€€€€½¹±¥¬õì¡”¤€ôøì¥˜€¡”¹ÕÉÉ•¹ÑQ…É•Ð€ôôô”¹Ñ…É•Ð¤Í•ÑM¡½Ý5½‘…°¡™…±Í”¤ìõô4(€€€€€€€€ø4(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”Üµ™Õ±°Í´éµ…àµÜµÍ´É½Õ¹‘•µÐ´Éá°Í´éÉ½Õ¹‘•´Éá°Í¡…‘½Üµá°À´Ôˆø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸µˆ´Ðˆø4(€€€€€€€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰™½¹Ðµ‰½±Ñ•áÐµÉ…ä´äÀÀÑ•áÐµ±œˆù½¹™¥Éµ•È±„Í•ÍÍ¥½¸ð½ Ìø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑM¡½Ý5½‘…°¡™…±Í”¥ô±…ÍÍ9…µ”ô‰Ñ•áÐµÉ…ä´ÐÀÀ¡½Ù•ÈéÑ•áÐµÉ…ä´ØÀÀˆøñ`Í¥é”õìÈÁô€¼øð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€€€ì¼¨K¥ÍÕ·¤€¨½ô4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÉ••¸´ÔÀ‰½É‘•È‰½É‘•ÈµÉ••¸´ÈÀÀÉ½Õ¹‘•µá°À´Ìµˆ´Ðˆø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÉ••¸´àÀÀµˆ´Èˆø4(€€€€€€€€€€€€€€€íÍ•±•Ñ•¹Í¥é•ôÑÉ…¥Ñ•µ•¹ÑíÍ•±•Ñ•¹Í¥é”€ø€Ä€ü€‰Ìˆ€è€ˆ‰ôƒ€•¹É•¥ÍÑÉ•È4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø4(€€€€€€€€€€€€€€€íl¸¸¹É½ÕÁÍ	åY…¥¸¹•¹ÑÉ¥•Ì ¥t4(€€€€€€€€€€€€€€€€€€¹µ…À ¡mÙ…¥¸°…¹¥µ…±Ít¤€ôøì4(€€€€€€€€€€€€€€€€€€€½¹ÍÐ½Õ¹Ð€ô…¹¥µ…±Ì¹™¥±Ñ•È ¡„¤€ôøÍ•±•Ñ•¹¡…Ì¡­•ä¡„¹¹ÕÑÉ…Ø°Ù…¥¸¤¤¤¹±•¹Ñ ì4(€€€€€€€€€€€€€€€€€€€¥˜€¡½Õ¹Ð€ôôô€À¤É•ÑÕÉ¸¹Õ±°ì4(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ 4(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÙ…¥¹ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸Ñ•áÐµáÌÑ•áÐµÉ••¸´ÜÀÀˆø4(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ðµµ•‘¥Õ´ˆùíÙ…¥¹ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí½Õ¹Ð€ø€Ä€ü€‘í½Õ¹Ñô…¹¥µ…Õá€€è€‘í½Õ¹Ñô…¹¥µ…±ôð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€€€€€€€ô¤4(€€€€€€€€€€€€€€€€€€¹™¥±Ñ•È¡	½½±•…¸¥ô4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€ð½‘¥Øø4(4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø4(€€€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµáÌ™½¹Ðµµ•‘¥Õ´Ñ•áÐµÉ…ä´ÔÀÀµˆ´Äˆù…Ñ”‘”ÑÉ…¥Ñ•µ•¹Ðð½±…‰•°ø4(€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ4(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‘…Ñ”ˆ4(€€€€€€€€€€€€€€€€€Ù…±Õ”õí‰…Ñ¡…Ñ•ô4(€€€€€€€€€€€€€€€€€µ…àõíÑ½‘…åô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ	…Ñ¡…Ñ”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÌÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áÐµÍ´™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµÉ••¸´ÐÀÀˆ4(€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€í‰…Ñ¡…Ñ”€˜˜€  ¤€ôøì4(€€€€€€€€€€€€€€€€€½¹ÍÐ‘…åÍ¼€ô5…Ñ ¹™±½½È ¡…Ñ”¹¹½Ü ¤€´¹•Ü…Ñ”¡‰…Ñ¡…Ñ”¤¹•ÑQ¥µ” ¤¤€¼€àØÐÀÀÀÀÀ¤ì4(€€€€€€€€€€€€€€€€€¥˜€¡‘…åÍ¼€ø€ÌÀ¤É•ÑÕÉ¸€ 4(€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµ…µ‰•È´ØÀÀµÐ´Ä¸Ô™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø4(€€€€€€€€€€€€€€€€€€€€€ƒŠjƒ¾â<…Ñ”…¹¥•¹¹”€¡í‘…åÍ½ô©½ÕÉÌ¤ƒŠP±•Ì…¹¥µ…Õà‘¥ÍÁ…É‡¹ÑÉ½¹Ð‰¥•¸‘”±„±¥ÍÑ”…ÁË¡Ì•¹É•¥ÍÑÉ•µ•¹Ð¸4(€€€€€€€€€€€€€€€€€€€€ð½Àø4(€€€€€€€€€€€€€€€€€€¤ì4(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì4(€€€€€€€€€€€€€€€ô¤ ¥ô4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€ñ‘¥Øø4(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµáÌ™½¹Ðµµ•‘¥Õ´Ñ•áÐµÉ…ä´ÔÀÀµˆ´ÄˆùY½¥”™…Á½Ìí…‘µ¥¹¥ÍÑÉ…Ñ¥½¸ð½±…‰•°ø4(€€€€€€€€€€€€€€€€ñÍ•±•Ð4(€€€€€€€€€€€€€€€€€Ù…±Õ”õí‰…Ñ¡Y½¥•ô4(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ	…Ñ¡Y½¥”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ô4(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÌÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áÐµÍ´‰œµÝ¡¥Ñ”™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµÉ••¸´ÐÀÀˆ4(€€€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€€íY=%L¹µ…À ¡Ø¤€ôø€ñ½ÁÑ¥½¸­•äõíØ¹Ù…±Õ•ôÙ…±Õ”õíØ¹Ù…±Õ•ôùíØ¹±…‰•±ôð½½ÁÑ¥½¸ø¥ô4(€€€€€€€€€€€€€€€€ð½Í•±•Ðø4(€€€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸4(€€€€€€€€€€€€€€€½¹±¥¬õí¡…¹‘±•	…Ñ¡MÕ‰µ¥Ñô4(€€€€€€€€€€€€€€€‘¥Í…‰±•õíÍ…Ù¥¹œñð€…‰…Ñ¡…Ñ•ô4(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°Áä´Ì‰œµÉ••¸´ÜÀÀÑ•áÐµÝ¡¥Ñ”É½Õ¹‘•µá°™½¹Ðµ‰½±Ñ•áÐµÍ´‘¥Í…‰±•é½Á…¥Ñä´ÔÀ…Ñ¥Ù”éÍ…±”´äàÑÉ…¹Í¥Ñ¥½¸µ…±°ˆ4(€€€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€íÍ…Ù¥¹œ€ü€ 4(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´ÈˆøñI•™É•Í¡ÜÍ¥é”õìÄÙô±…ÍÍ9…µ”ô‰…¹¥µ…Ñ”µÍÁ¥¸ˆ€¼ø¹É•¥ÍÑÉ•µ•¹ÓŠ˜ð½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€€€€€¹É•¥ÍÑÉ•È€‘íÍ•±•Ñ•¹Í¥é•ôÑÉ…¥Ñ•µ•¹Ð‘íÍ•±•Ñ•¹Í¥é”€ø€Ä€ü€‰Ìˆ€è€ˆ‰õ€4(€€€€€€€€€€€€€€€€¥ô4(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø4(€€€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€€€ð½‘¥Øø4(€€€€€€€€ð½‘¥Øø4(€€€€€€¥ô4(€€€€ð¼ø4(€€¤ì4)ô4(