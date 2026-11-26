"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Check, Search, X } from "lucide-react";

import { ECHO_ACTIONS, ECHO_OBSERVATIONS, normEcho, toggleEchoEvent, type EchoEvent, type EchoAction } from "@/lib/echo-session-extras";
const DUREE_GESTATION = 285;

export interface EchoSessionCow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  saillieId: string | null;
  derniereSaillie: string | null;
  saillieType: string | null;
  taureauNom?: string | null;
}

type EchoResult = "PLEINE" | "VIDE";
type FollowUp = "CYCLEE" | "METRITE" | "METRABOL" | "BOLUS";

interface EchoDraft {
  resultat?: EchoResult;
  joursGestation?: number;
  suivis: FollowUp[];
  events?: EchoEvent[];
  actions?: EchoAction[];
  bullId?: string;
  breedingDate?: string;
  remarque: string;
}

interface Props {
  vaches: EchoSessionCow[];
  taureaux?: {id:string; nopere:string|null; nupere:string}[];
  fixture?: { catalogue: EchoEvent[]; save: (payload:unknown)=>Promise<{count:number;actionsCount:number}> };
  onClose: () => void;
  onDone: (count: number, actionsCount: number) => void;
}

const FOLLOW_UPS: Array<{ id: FollowUp; label: string; createsAction?: boolean }> = [
  { id: "CYCLEE", label: "Cyclée" },
  { id: "METRITE", label: "Métrite", createsAction: true },
  { id: "METRABOL", label: "Metrabol à prévoir", createsAction: true },
  { id: "BOLUS", label: "Bolus à prévoir", createsAction: true },
];

function localDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function safeDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function defaultGestationDays(vache: EchoSessionCow, sessionDate: string) {
  if (!vache.derniereSaillie) return 45;
  return Math.max(1, Math.min(284, differenceInDays(safeDate(sessionDate), new Date(vache.derniereSaillie))));
}

function updateDraft(
  drafts: Record<string, EchoDraft>,
  animalId: string,
  updater: (current: EchoDraft) => EchoDraft,
) {
  const current = drafts[animalId] ?? { suivis: [], remarque: "" };
  return { ...drafts, [animalId]: updater(current) };
}

export default function EchoFieldSessionModal({ vaches, taureaux = [], fixture, onClose, onDone }: Props) {
  const today = localDateValue();
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, EchoDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogue,setCatalogue]=useState<EchoEvent[]>(fixture?.catalogue??[]);
  const [catalogueError,setCatalogueError]=useState("");
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [eventQuery,setEventQuery]=useState<Record<string,string>>({});
  const inFlight=useRef(false);
  const sessionId=useRef<string>("");
  useEffect(()=>{if(fixture)return;let active=true;fetch("/api/event-types").then(r=>{if(!r.ok)throw Error("Catalogue indisponible");return r.json();}).then(data=>{if(active)setCatalogue(Array.isArray(data)?data:[]);}).catch(()=>{if(active)setCatalogueError("Catalogue sanitaire indisponible");});return()=>{active=false;};},[fixture]);
  function change(id:string,patch:Partial<EchoDraft>){setDrafts(old=>updateDraft(old,id,d=>({...d,...patch})));}
  function selectEvent(id:string,event:EchoEvent){setDrafts(old=>updateDraft(old,id,d=>({...d,events:toggleEchoEvent(d.events??[],event)})));}
  function addEvent(id:string){const nom=(eventQuery[id]??"").trim();if(!nom)return;const found=catalogue.find(e=>normEcho(e.nom)===normEcho(nom));const entry=found??{nom};if(!found)setCatalogue(old=>[...old,entry]);setDrafts(old=>updateDraft(old,id,d=>({...d,events:(d.events??[]).some(e=>normEcho(e.nom)===normEcho(entry.nom))?d.events:toggleEchoEvent(d.events??[],entry)})));setEventQuery(old=>({...old,[id]:""}));}
  function toggleAction(id:string,type:EchoAction["type"]){setDrafts(old=>updateDraft(old,id,d=>({...d,actions:(d.actions??[]).some(a=>a.type===type)?(d.actions??[]).filter(a=>a.type!==type):[...(d.actions??[]),{type,due:date}]})));}

  const sortedCows = useMemo(() => [...vaches].sort((left, right) =>
    left.nutrav.localeCompare(right.nutrav, "fr", { numeric: true })
  ), [vaches]);
  const displayedCows = sortedCows.filter((vache) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return !normalizedQuery
      || vache.nutrav.toLocaleLowerCase("fr").includes(normalizedQuery)
      || (vache.nobovi ?? "").toLocaleLowerCase("fr").includes(normalizedQuery);
  });
  const completedCows = sortedCows.filter((vache) => {const d=drafts[vache.id];return d&&(d.resultat||d.events?.length||d.actions?.length||d.bullId);});
  const actionCount = completedCows.reduce((total, vache) =>
    total + (drafts[vache.id]?.actions ?? []).length, 0
  );

  function chooseResult(vache: EchoSessionCow, resultat: EchoResult) {
    setDrafts((current) => updateDraft(current, vache.id, (draft) => ({
      ...draft,
      resultat,
      joursGestation: resultat === "PLEINE"
        ? draft.joursGestation ?? defaultGestationDays(vache, date)
        : undefined,
      suivis: draft.suivis,
    })));
  }

  function toggleFollowUp(animalId: string, suivi: FollowUp) {
    setDrafts((current) => updateDraft(current, animalId, (draft) => ({
      ...draft,
      suivis: draft.suivis.includes(suivi)
        ? draft.suivis.filter((item) => item !== suivi)
        : [...draft.suivis, suivi],
    })));
  }

  async function saveSession() {
    if (completedCows.length === 0 || inFlight.current) return;
    inFlight.current=true;
    if(!sessionId.current)sessionId.current=crypto.randomUUID();
    setSaving(true);
    setError("");
    try {
      const payload = {
          sessionId:sessionId.current,
          date,
          resultats: completedCows.map(vache=>({animalId:vache.id,saillieId:vache.saillieId,...drafts[vache.id],remarque:drafts[vache.id].remarque.trim()||undefined})),
      };
      if(fixture){const data=await fixture.save(payload);onDone(data.count,data.actionsCount);return;}
      const response = await fetch("/api/echographies/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "L’enregistrement a échoué");
      onDone(data.count ?? completedCows.length, data.actionsCount ?? actionCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’enregistrement a échoué");
    } finally {
      inFlight.current=false;
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Saisie d’une séance d’échographies">
      <div className="flex h-full w-full flex-col bg-gray-50 sm:h-[min(94vh,900px)] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl">
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:rounded-t-2xl sm:pt-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-gray-950">Séance d’échographies</h2>
              <p className="text-xs text-gray-500">{completedCows.length}/{vaches.length} résultat{completedCows.length > 1 ? "s" : ""} saisi{completedCows.length > 1 ? "s" : ""}</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Fermer">
              <X size={22} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_9.5rem] gap-2">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
              <Search size={17} className="shrink-0 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numéro ou nom" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <label className="relative flex min-h-12 items-center rounded-xl border border-amber-300 bg-amber-50 px-3">
              <CalendarDays size={17} className="pointer-events-none absolute left-3 text-amber-700" />
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Date de la séance"
                className="w-full bg-transparent pl-6 text-sm font-bold text-amber-950 outline-none"
              />
            </label>
          </div>
        </header>

        <main className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
          {displayedCows.map((vache) => {
            const draft = drafts[vache.id] ?? { suivis: [], remarque: "" };
            const joursGestation = draft.joursGestation ?? defaultGestationDays(vache, date);
            const conception = addDays(safeDate(date), -joursGestation);
            const terme = addDays(safeDate(date), DUREE_GESTATION - joursGestation);
            return (
              <article key={vache.id} className={`rounded-2xl border bg-white p-3 shadow-sm ${draft.resultat === "PLEINE" ? "border-green-400" : draft.resultat === "VIDE" ? "border-red-400" : "border-gray-200"}`}>
                <div className="flex min-w-0 items-baseline gap-2">
                  <strong className="shrink-0 font-mono text-lg text-green-900">{vache.nutrav}</strong>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">{vache.nobovi ?? "Sans nom"}</span>
                  {draft.resultat && <Check size={18} className={draft.resultat === "PLEINE" ? "text-green-600" : "text-red-600"} />}
                </div>
                <p className="mb-3 mt-0.5 text-[11px] text-gray-500">
                  {vache.derniereSaillie
                    ? `${vache.saillieType === "IA" ? "IA" : "Saillie"} du ${format(new Date(vache.derniereSaillie), "d MMM yyyy", { locale: fr })}`
                    : "Aucune saillie enregistrée"}
                  {vache.derniereSaillie && ` · Père : ${vache.taureauNom ?? "non renseigné"}`}
                </p>

                {!vache.saillieId && <div className="mb-3 space-y-2"><label className="block text-xs font-semibold">Enregistrer un taureau ?<select className="mt-1 min-h-11 w-full rounded-xl border px-2" value={draft.bullId??""} onChange={e=>change(vache.id,{bullId:e.target.value})}><option value="">Non renseigné</option>{taureaux.map(t=><option key={t.id} value={t.id}>{t.nopere??t.nupere} · {t.nupere}</option>)}</select></label>{draft.bullId&&draft.resultat!=="PLEINE"&&<label className="block text-xs">Date de saillie connue (obligatoire hors diagnostic pleine)<input type="date" max={date} className="block min-h-11 w-full rounded border" value={draft.breedingDate??""} onChange={e=>change(vache.id,{breedingDate:e.target.value})}/></label>}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => chooseResult(vache, "PLEINE")} className={`min-h-12 rounded-xl border-2 text-sm font-black ${draft.resultat === "PLEINE" ? "border-green-600 bg-green-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                    Pleine
                  </button>
                  <button type="button" onClick={() => chooseResult(vache, "VIDE")} className={`min-h-12 rounded-xl border-2 text-sm font-black ${draft.resultat === "VIDE" ? "border-red-500 bg-red-500 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                    Vide
                  </button>
                </div>

                {draft.resultat === "PLEINE" && (
                  <div className="mt-3 rounded-xl bg-green-50 p-3">
                    <label className="flex items-center justify-between gap-3 text-sm text-green-950">
                      <span className="font-semibold">Stade de gestation</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={284}
                          value={joursGestation}
                          onChange={(event) => setDrafts((current) => updateDraft(current, vache.id, (item) => ({ ...item, joursGestation: Math.max(1, Math.min(284, Number(event.target.value) || 1)) })))}
                          className="h-11 w-20 rounded-lg border border-green-300 bg-white px-2 text-center text-base font-black"
                        />
                        jours
                      </span>
                    </label>
                    <p className="mt-2 text-xs text-green-800">Début estimé : <strong>{format(conception, "d MMM yyyy", { locale: fr })}</strong> · Terme : <strong>{format(terme, "d MMM yyyy", { locale: fr })}</strong></p>
                    {!vache.saillieId && <p className="mt-1 text-[11px] font-semibold text-violet-700">Cette date de début sera enregistrée comme saillie probable.</p>}
                  </div>
                )}

                <button type="button" aria-expanded={!!expanded[vache.id]} onClick={()=>setExpanded(old=>({...old,[vache.id]:!old[vache.id]}))} className="mt-3 min-h-11 w-full rounded-xl border text-sm font-bold">Événements et actions{(draft.events?.length??0)+(draft.actions?.length??0)>0?" · "+((draft.events?.length??0)+(draft.actions?.length??0)):""}</button>
                {expanded[vache.id]&&<div className="mt-2 space-y-3 rounded-xl border p-3">
                  <p className="text-xs font-bold">Événements sanitaires</p>
                  {catalogueError&&<p role="alert">{catalogueError}</p>}
                  <div className="flex flex-wrap gap-2">{ECHO_OBSERVATIONS.map(nom=>{const event=catalogue.find(e=>normEcho(e.nom)===normEcho(nom))??{nom};return <button type="button" key={nom} aria-pressed={(draft.events??[]).some(e=>normEcho(e.nom)===normEcho(nom))} onClick={()=>selectEvent(vache.id,event)} className="min-h-11 rounded-xl border px-3 aria-pressed:bg-blue-100">{nom}</button>;})}</div>
                  <label className="block text-xs">Rechercher ou créer un événement<input className="block min-h-11 w-full rounded border px-2" value={eventQuery[vache.id]??""} onChange={e=>setEventQuery(old=>({...old,[vache.id]:e.target.value}))}/></label>
                  {(eventQuery[vache.id]??"").trim()&&<div className="space-y-1">{catalogue.filter(e=>normEcho(e.nom).includes(normEcho(eventQuery[vache.id]))).slice(0,10).map(e=><button type="button" key={e.id??e.nom} className="block min-h-11 w-full rounded border text-left px-2" onClick={()=>selectEvent(vache.id,e)}>{e.nom}</button>)}<button type="button" className="min-h-11 w-full rounded border font-bold" onClick={()=>addEvent(vache.id)}>+ Ajouter un événement</button></div>}
                  {(draft.events??[]).map(e=><button type="button" key={e.nom} onClick={()=>selectEvent(vache.id,e)} className="mr-1 rounded bg-blue-100 p-2">{e.nom} ×</button>)}
                  <p className="text-xs font-bold">Actions à prévoir</p>
                  {ECHO_ACTIONS.map(type=>{const action=draft.actions?.find(a=>a.type===type);return <div key={type}><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!action} onChange={()=>toggleAction(vache.id,type)}/>{type}</label>{action&&<label className="block text-xs">Échéance {type}<input type="date" min={date} value={action.due} className="block min-h-11 w-full rounded border" onChange={e=>change(vache.id,{actions:(draft.actions??[]).map(a=>a.type===type?{...a,due:e.target.value}:a)})}/></label>}</div>;})}
                </div>}
                {(draft.resultat || expanded[vache.id]) && (
                  <input
                    value={draft.remarque}
                    onChange={(event) => setDrafts((current) => updateDraft(current, vache.id, (item) => ({ ...item, remarque: event.target.value })))}
                    placeholder="Note facultative"
                    className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-green-500"
                  />
                )}
              </article>
            );
          })}
          {displayedCows.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Aucune vache trouvée</p>}
        </main>

        <footer className="shrink-0 border-t border-gray-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">
          {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          {actionCount > 0 && <p className="mb-2 text-center text-xs font-semibold text-orange-700">{actionCount} action{actionCount > 1 ? "s" : ""} à faire {actionCount > 1 ? "seront ajoutées" : "sera ajoutée"} aux actualités</p>}
          <button
            type="button"
            onClick={saveSession}
            disabled={saving || completedCows.length === 0 || !date}
            className="min-h-12 w-full rounded-xl bg-blue-600 px-4 text-base font-black text-white disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : completedCows.length === 0 ? "Saisissez au moins un résultat" : `Enregistrer ${completedCows.length} résultat${completedCows.length > 1 ? "s" : ""}`}
          </button>
          {completedCows.length < vaches.length && completedCows.length > 0 && <p className="mt-1.5 text-center text-[11px] text-gray-500">Les {vaches.length - completedCows.length} vache{vaches.length - completedCows.length > 1 ? "s" : ""} non renseignée{vaches.length - completedCows.length > 1 ? "s" : ""} resteront dans « À écho ».</p>}
        </footer>
      </div>
    </div>
  );
}
