"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { nationalWithCountry, fullNational } from "@/lib/bull-identity";
import RecordActionsMenu from "@/components/RecordActionsMenu";

export type BullControlRow = {
  id: string; number: string; country: string; name: string | null; present: boolean;
  historical: number; duplicateCandidates: Array<{ id: string; number: string; name: string | null }>;
  direct: number; manual: number; calving: number; offspring: number;
  breeding: number; inseminations: number; childNumbers: string[];
};
export type FatherConflict = {
  nutrav: string; name: string | null; bull: string | null;
  manual: string | null; calving: string | null;
};
const displayNumber = (row: BullControlRow) => {
  const raw = row.number.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{2}[A-Z0-9]+$/.test(raw)) return raw;
  return /^\d{8,15}$/.test(raw) && /^[A-Z]{2}$/.test(row.country) ? row.country + raw : raw;
};
type SortKey = "number" | "name" | "offspring" | "breeding" | "inseminations" | "direct";
function csvCell(value: string | number) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

export default function FatherControlTable({ rows: initial, conflicts }: { rows: BullControlRow[]; conflicts: FatherConflict[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [descending, setDescending] = useState(false);
  const [filter, setFilter] = useState("tous");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showConflicts, setShowConflicts] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => rows.filter((row) => {
    const phrase = [row.number, displayNumber(row), row.name ?? "", ...row.childNumbers].join(" ").toLocaleLowerCase("fr");
    if (!phrase.includes(query.trim().toLocaleLowerCase("fr"))) return false;
    if (filter === "avec-liens") return row.offspring > 0 || row.breeding > 0;
    if (filter === "sans-liens") return row.offspring === 0 && row.breeding === 0;
    if (filter === "ia") return row.inseminations > 0;
    return true;
  }).sort((a, b) => {
    const left = a[sort], right = b[sort];
    const direction = descending ? -1 : 1;
    return direction * (typeof left === "number" && typeof right === "number"
      ? left - right : String(left ?? "").localeCompare(String(right ?? ""), "fr", { numeric: true }));
  }), [rows, query, filter, sort, descending]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDescending((old) => !old);
    else { setSort(key); setDescending(false); }
  }

  async function deleteBull(row: BullControlRow) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/taureaux", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Suppression refusée");
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(false); }
  }

  function exportCsv() {
    const header = ["Nom", "Numéro national ou référence", "Animaux liés", "Références manuelles", "Références vêlages", "Descendants identifiés", "Saillies", "IA identifiées"];
    const values = visible.map((r) => [r.name ?? "", displayNumber(r), r.direct, r.manual, r.calving, r.offspring, r.breeding, r.inseminations]);
    const csv = [header, ...values].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "cesam-controle-peres.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  const sortHeader = (key: SortKey, label: string) =>
    <button type="button" onClick={() => toggleSort(key)} className="whitespace-nowrap text-left hover:underline">
      {label}{sort === key ? (descending ? " ↓" : " ↑") : ""}
    </button>;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-gray-500">Fiches de pères</p><strong className="text-xl">{rows.length}</strong></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-gray-500">Avec descendance</p><strong className="text-xl">{rows.filter((x) => x.offspring).length}</strong></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-gray-500">Sans lien identifié</p><strong className="text-xl">{rows.filter((x) => !x.offspring && !x.breeding).length}</strong></div>
        <button type="button" onClick={() => setShowConflicts((v) => !v)} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left shadow-sm">
          <p className="text-xs text-amber-900">Filiations à vérifier</p><strong className="text-xl text-amber-900">{conflicts.length}</strong>
          <span className="ml-2 text-xs text-amber-800">{showConflicts ? "Masquer" : "Voir"}</span>
        </button>
      </section>

      <p className="text-sm text-amber-900">À contrôler : {rows.filter(r => !fullNational(r.number)).length} numéros incomplets · {rows.filter(r => r.duplicateCandidates.length > 0).length} fiches avec doublon possible. Ces alertes ne prouvent pas une erreur.</p>
      {showConflicts && (
        <section className="rounded-xl border border-amber-200 bg-white p-3">
          <h2 className="font-semibold text-gray-900">Pères différents selon les sources</h2>
          <p className="mb-2 text-xs text-gray-600">Numéros nationaux complets différents : vérifier avant toute correction. Le vêlage peut conserver une ancienne information.</p>
          {conflicts.length === 0 ? <p className="text-sm text-gray-500">Aucun conflit de numéros complets détecté.</p> :
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-amber-50"><tr><th className="p-2">Animal</th><th className="p-2">Père lié</th><th className="p-2">Saisie manuelle</th><th className="p-2">Vêlage</th><th className="p-2">Action</th></tr></thead>
                <tbody>{conflicts.map((c) => <tr key={c.nutrav} className="border-t">
                  <td className="p-2 font-semibold">{c.nutrav} · {c.name ?? "—"}</td>
                  <td className="p-2 font-mono">{c.bull ? nationalWithCountry(c.bull) : "—"}</td>
                  <td className="p-2 font-mono">{c.manual ? nationalWithCountry(c.manual) : "—"}</td>
                  <td className="p-2 font-mono">{c.calving ? nationalWithCountry(c.calving) : "—"}</td>
                  <td className="p-2"><Link href={`/troupeau/${encodeURIComponent(c.nutrav)}/arbre?edit=pere`} className="text-green-700 underline">Vérifier le père</Link></td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
      )}


      <div className="flex flex-wrap items-center gap-2">
        <input type="search" aria-label="Rechercher un taureau ou un veau" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher nom, numéro, veau…" className="min-h-11 min-w-[200px] flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm" />
        <select aria-label="Filtrer les pères" value={filter} onChange={(e) => setFilter(e.target.value)}
          className="min-h-11 rounded-lg border bg-white px-3 text-sm">
          <option value="tous">Tous les pères</option>
          <option value="avec-liens">Avec des liens</option>
          <option value="sans-liens">Sans lien identifié</option>
          <option value="ia">Avec IA identifiée</option>
        </select>
        <button type="button" onClick={exportCsv} className="min-h-11 rounded-lg border border-green-600 bg-white px-3 text-sm font-semibold text-green-800">Exporter CSV</button>
      </div>

      <p className="text-xs text-gray-500">{visible.length} ligne(s) affichée(s). Clique sur un en-tête pour trier. Une IA est comptée uniquement si la saillie est enregistrée comme telle.</p>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-green-800 text-white">
            <tr>
              <th className="px-3 py-3">{sortHeader("number", "Numéro / identité")}</th>
              <th className="px-3 py-3">{sortHeader("name", "Nom")}</th>
              <th className="px-3 py-3 text-center">{sortHeader("direct", "Animaux liés")}</th>
              <th className="px-3 py-3 text-center">Mentions manuelles</th>
              <th className="px-3 py-3 text-center">Vêlages</th>
              <th className="px-3 py-3 text-center">{sortHeader("offspring", "Veaux")}</th>
              <th className="px-3 py-3 text-center">{sortHeader("breeding", "Saillies")}</th>
              <th className="px-3 py-3 text-center">{sortHeader("inseminations", "IA")}</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>{visible.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 hover:bg-green-50/40">
              <td className="px-3 py-2"><strong className="block font-mono text-green-900">{displayNumber(row)}</strong>{!fullNational(row.number) && <span className="text-xs font-semibold text-amber-800">Référence courte · national à vérifier</span>}{row.duplicateCandidates.length > 0 && <span className="block text-xs text-amber-800">Doublon possible : {row.duplicateCandidates.map(x => x.name ?? x.number).join(", ")}</span>}</td>
              <td className="px-3 py-2">{row.name || "Sans nom"}</td>
              <td className="px-3 py-2 text-center">{row.direct}</td>
              <td className="px-3 py-2 text-center">{row.manual}{row.historical > 0 && <span className="block text-xs text-amber-800">+{row.historical} par nom</span>}</td>
              <td className="px-3 py-2 text-center">{row.calving}</td>
              <td className="px-3 py-2 text-center">
                <button type="button" aria-label={`Afficher les veaux du taureau ${row.number}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  className="font-semibold text-blue-700 underline">{row.offspring}</button>
              </td>
              <td className="px-3 py-2 text-center">{row.breeding}</td>
              <td className="px-3 py-2 text-center">{row.inseminations}</td>
              <td className="px-3 py-2">
                <RecordActionsMenu actions={[
                  { label: "Voir la fiche", onSelect: () => { window.location.href = `/taureaux/${row.id}`; } },
                  { label: "Supprimer", tone: "danger", disabled: busy,
                    confirmMessage: `Supprimer la fiche ${row.name ?? row.number} ? CESAM refusera si des filiations ou saillies sont liées.`,
                    onSelect: () => deleteBull(row) },
                ]} />
              </td>
            </tr>
          ))}</tbody>
        </table>
        {visible.length === 0 && <p className="p-6 text-center text-gray-500">Aucun père trouvé.</p>}
      </div>

      {expanded && (() => {
        const row = rows.find((r) => r.id === expanded);
        return row ? <section className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">{row.name ?? row.number} — veaux identifiés ({row.childNumbers.length})</h3>
          <div className="mt-2 flex flex-wrap gap-2">{row.childNumbers.length === 0 ? <span className="text-sm text-gray-500">Aucun animal identifié par ce numéro complet ou par lien direct.</span> :
            row.childNumbers.map((number) => <Link href={`/troupeau/${encodeURIComponent(number)}/arbre?edit=pere`} key={number} className="rounded-lg bg-green-50 px-2 py-1 text-sm font-semibold text-green-700 underline">{number}</Link>)}</div>
        </section> : null;
      })()}
      <p className="text-xs text-gray-500">
        Les numéros courts ne sont pas des numéros nationaux complets. Vérifier les doublons et les filiations avant toute fusion ou correction.
        La suppression est refusée par CESAM dès qu&apos;une filiation, saillie ou mention de vêlage utilise le père.
      </p>
    </div>
  );
}
