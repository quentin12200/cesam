"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Check, Search, X } from "lucide-react";

import { ECHO_ACTIONS, ECHO_OBSERVATIONS, actionKey, validActionName, mergeActionNames, normEcho, toggleEchoEvent, type EchoEvent, type EchoAction } from "@/lib/echo-session-extras";
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
  fixture?: { catalogue: EchoEvent[]; actions?: EchoEvent[]; save: (payload:unknown)=>Promise<{count:number;actionsCount:number}> };
  onClose: () => void;
  onDone: (count: number, actionsCount: number) => void;
}


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
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [bullPicker,setBullPicker]=useState<string|null>(null);
  const [bullQuery,setBullQuery]=useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogue,setCatalogue]=useState<EchoEvent[]>(fixture?.catalogue??[]);
  const [catalogueError,setCatalogueError]=useState("");
  const [actionNames,setActionNames]=useState(()=>mergeActionNames([...ECHO_ACTIONS,...(fixture?.actions??[]).map(a=>a.nom)]));
  const [actionPicker,setActionPicker]=useState<Record<string,boolean>>({});
  const [actionQuery,setActionQuery]=useState<Record<string,string>>({});
  const [actionError,setActionError]=useState("");
  useEffect(()=>{if(fixture)return;let active=true;fetch("/api/event-types?kind=actions").then(r=>{if(!r.ok)throw Error();return r.json();}).then((items:EchoEvent[])=>{if(active)setActionNames(old=>mergeActionNames([...old,...items.map(a=>a.nom)]));}).catch(()=>{if(active)setActionError("Catalogue des actions indisponible");});return()=>{active=false;};},[fixture]);
  const [eventPickerOpen,setEventPickerOpen]=useState<Record<string,boolean>>({});
  const [eventQuery,setEventQuery]=useState<Record<string,string>>({});
  const inFlight=useRef(false);
  const sessionId=useRef<string>("");
  useEffect(()=>{if(fixture)return;let active=true;fetch("/api/event-types").then(r=>{if(!r.ok)throw Error("Catalogue indisponible");return r.json();}).then(data=>{if(active)setCatalogue(Array.isArray(data)?data:[]);}).catch(()=>{if(active)setCatalogueError("Catalogue sanitaire indisponible");});return()=>{active=false;};},[fixture]);
  function change(id:string,patch:Partial<EchoDraft>){setDrafts(old=>updateDraft(old,id,d=>({...d,...patch})));}
  function selectEvent(id:string,event:EchoEvent){setDrafts(old=>updateDraft(old,id,d=>({...d,events:toggleEchoEvent(d.events??[],event)})));}
  function addEvent(id:string){const nom=(eventQuery[id]??"").trim();if(!nom)return;const found=catalogue.find(e=>normEcho(e.nom)===normEcho(nom));const entry=found??{nom};if(!found)setCatalogue(old=>[...old,entry]);setDrafts(old=>updateDraft(old,id,d=>({...d,events:(d.events??[]).some(e=>normEcho(e.nom)===normEcho(entry.nom))?d.events:toggleEchoEvent(d.events??[],entry)})));setEventQuery(old=>({...old,[id]:""}));}
  function toggleAction(id:string,type:EchoAction["type"]){setDrafts(old=>updateDraft(old,id,d=>({...d,actions:(d.actions??[]).some(a=>actionKey(a.type)===actionKey(type))?(d.actions??[]).filter(a=>actionKey(a.type)!==actionKey(type)):[...(d.actions??[]),{type,due:date}]})));}

  function addAction(id:string,name:string){if(!validActionName(name))return;const type=actionNames.find(n=>actionKey(n)===actionKey(name))??name.trim().replace(/\s+/g," ");setActionNames(old=>mergeActionNames([...old,type]));setDrafts(old=>updateDraft(old,id,d=>({...d,actions:(d.actions??[]).some(a=>actionKey(a.type)===actionKey(type))?d.actions:[...(d.actions??[]),{type,due:date}]})));setActionPicker(old=>({...old,[id]:false}));setActionQuery(old=>({...old,[id]:""}));}

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
      <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-gray-50 sm:h-[min(94vh,900px)] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl">
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

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
              <Search size={17} className="shrink-0 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numéro ou nom" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <label className="relative flex min-w-0 min-h-12 items-center rounded-xl border border-amber-300 bg-amber-50 px-3">
              <CalendarDays size={17} className="pointer-events-none absolute left-3 text-amber-700" />
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Date de la séance"
                className="w-full min-w-0 max-w-full bg-transparent pl-6 text-sm font-bold text-amber-950 outline-none"
              />
            </label>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
          {displayedCows.map((vache) => {
            const draft = drafts[vache.id] ?? { suivis: [], remarque: "" };
            const joursGestation = draft.joursGestation ?? defaultGestationDays(vache, date);
            const conception = addDays(safeDate(date || today), -joursGestation);
            const terme = addDays(safeDate(date || today), DUREE_GESTATION - joursGestation);
            return (
              <article key={vache.id} className={`min-w-0 max-w-full rounded-xl border bg-white p-2 shadow-sm ${draft.resultat === "PLEINE" ? "border-green-400" : draft.resultat === "VIDE" ? "border-red-400" : "border-gray-200"}`}>
                <div className="flex min-w-0 items-baseline gap-2">
                  <strong className="shrink-0 font-mono text-lg text-green-900">{vache.nutrav}</strong>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">{vache.nobovi ?? "Sans nom"}</span>
                  {draft.resultat && <Check size={18} className={draft.resultat === "PLEINE" ? "text-green-600" : "text-red-600"} />}
                </div>
                <p className="mb-1 mt-0.5 text-[11px] text-gray-500">
                  {vache.derniereSaillie
                    ? `${vache.saillieType === "IA" ? "IA" : "Saillie"} du ${format(new Date(vache.derniereSaillie), "d MMM yyyy", { locale: fr })}`
                    : "Aucune saillie enregistrée"}
                  {vache.derniereSaillie && ` · Père : ${vache.taureauNom ?? "non renseigné"}`}
                </p>

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
                    <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-green-950">
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

                {draft.resultat==="PLEINE" && (!vache.saillieId && <div className="mt-2 min-w-0 space-y-1"><button type="button" className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2 text-left text-xs font-semibold" onClick={()=>{setBullQuery("");setBullPicker(vache.id);}}><span>Taureau</span><span className="min-w-0 truncate">{taureaux.find(t=>t.id===draft.bullId)?.nopere || taureaux.find(t=>t.id===draft.bullId)?.nupere || "Choisir"}</span></button>{draft.bullId&&draft.resultat!=="PLEINE"&&<label className="block text-xs">Date de saillie connue (obligatoire hors diagnostic pleine)<input type="date" max={date} className="block min-h-11 w-full min-w-0 rounded border" value={draft.breedingDate??""} onChange={e=>change(vache.id,{breedingDate:e.target.value})}/></label>}</div>)}
                <button type="button" aria-expanded={!!expanded[vache.id]} onClick={()=>setExpanded(old=>({...old,[vache.id]:!old[vache.id]}))} className="mt-1 flex min-h-11 w-full min-w-0 items-center justify-between gap-1 text-left text-xs text-gray-600"><span className="min-w-0 break-words">{[...(draft.events??[]).map(e=>e.nom),...(draft.actions??[]).map(a=>a.type),draft.remarque?"Note":""].filter(Boolean).join(" · ")||"Événements · Actions · Note"}</span><span aria-hidden="true">{expanded[vache.id]?"−":"+"}</span></button>
                <div hidden={!expanded[vache.id]} className="min-w-0 space-y-2">
                {draft.resultat!=="PLEINE" && (!vache.saillieId && <div className="mt-2 min-w-0 space-y-1"><button type="button" className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2 text-left text-xs font-semibold" onClick={()=>{setBullQuery("");setBullPicker(vache.id);}}><span>Taureau</span><span className="min-w-0 truncate">{taureaux.find(t=>t.id===draft.bullId)?.nopere || taureaux.find(t=>t.id===draft.bullId)?.nupere || "Choisir"}</span></button>{draft.bullId&&draft.resultat!=="PLEINE"&&<label className="block text-xs">Date de saillie connue (obligatoire hors diagnostic pleine)<input type="date" max={date} className="block min-h-11 w-full min-w-0 rounded border" value={draft.breedingDate??""} onChange={e=>change(vache.id,{breedingDate:e.target.value})}/></label>}</div>)}
                  <p className="text-xs font-bold text-gray-600">Événements sanitaires</p>
                  {catalogueError&&<p role="alert" className="text-xs text-red-700">{catalogueError}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {ECHO_OBSERVATIONS.map(nom=>{const event=catalogue.find(e=>normEcho(e.nom)===normEcho(nom))??{nom};return <button type="button" key={nom} aria-pressed={(draft.events??[]).some(e=>normEcho(e.nom)===normEcho(nom))} disabled={saving} onClick={()=>selectEvent(vache.id,event)} className="min-h-11 rounded-xl border border-gray-200 px-2.5 text-xs font-bold aria-pressed:border-blue-500 aria-pressed:bg-blue-100 aria-pressed:text-blue-900">{nom}</button>;})}
                    <button type="button" disabled={saving} aria-expanded={!!eventPickerOpen[vache.id]} onClick={()=>setEventPickerOpen(old=>({...old,[vache.id]:!old[vache.id]}))} className="min-h-11 rounded-xl border border-dashed border-blue-400 px-2.5 text-xs font-bold text-blue-800">+ Ajouter un événement</button>
                    {(draft.events??[]).filter(e=>!ECHO_OBSERVATIONS.some(nom=>normEcho(nom)===normEcho(e.nom))).map(e=><button type="button" key={e.nom} disabled={saving} onClick={()=>selectEvent(vache.id,e)} className="min-h-11 rounded-xl border border-blue-500 bg-blue-100 px-2.5 text-xs font-bold text-blue-900">{e.nom} ×</button>)}
                  </div>
                  {eventPickerOpen[vache.id]&&<div className="space-y-2 rounded-xl border bg-gray-50 p-2">
                    <label className="block text-xs">Rechercher ou créer un événement<input className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-2" value={eventQuery[vache.id]??""} onChange={e=>setEventQuery(old=>({...old,[vache.id]:e.target.value}))}/></label>
                    <div className="max-h-40 space-y-1 overflow-y-auto">{catalogue.filter(e=>normEcho(e.nom).includes(normEcho(eventQuery[vache.id]??""))).slice(0,10).map(e=><button type="button" key={e.id??e.nom} disabled={saving} aria-pressed={(draft.events??[]).some(item=>normEcho(item.nom)===normEcho(e.nom))} className="block min-h-11 w-full rounded-lg border bg-white px-2 text-left text-sm aria-pressed:bg-blue-100" onClick={()=>{selectEvent(vache.id,e);setEventPickerOpen(old=>({...old,[vache.id]:false}));setEventQuery(old=>({...old,[vache.id]:""}));}}>{e.nom}</button>)}</div>
                    <button type="button" disabled={saving||!(eventQuery[vache.id]??"").trim()} className="min-h-11 w-full rounded-lg bg-blue-600 px-2 text-sm font-bold text-white disabled:opacity-40" onClick={()=>{addEvent(vache.id);setEventPickerOpen(old=>({...old,[vache.id]:false}));}}>Créer et sélectionner</button>
                  </div>}
                  <p className="pt-1 text-xs font-bold text-gray-600">Actions à prévoir</p>
                  <div className="flex flex-wrap gap-1.5">{mergeActionNames([...ECHO_ACTIONS,...(draft.actions??[]).map(a=>a.type)]).map(type=>{const action=draft.actions?.find(a=>a.type===type);return <label key={type} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold ${action?"border-orange-500 bg-orange-100 text-orange-900":"border-gray-200 text-gray-700"}`}><input type="checkbox" checked={!!action} disabled={saving} onChange={()=>toggleAction(vache.id,type)}/>{type}</label>;})}<button type="button" disabled={saving} aria-expanded={!!actionPicker[vache.id]} onClick={()=>setActionPicker(old=>({...old,[vache.id]:!old[vache.id]}))} className="min-h-11 rounded-xl border border-dashed border-orange-400 px-2.5 text-xs font-bold text-orange-900">+ Ajouter une action</button></div>
                  {actionPicker[vache.id]&&<div className="space-y-2 rounded-xl border bg-orange-50 p-2">{actionError&&<p role="alert" className="text-xs">{actionError}</p>}<label className="block text-xs">Rechercher ou créer une action<input maxLength={100} className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-2" value={actionQuery[vache.id]??""} onChange={e=>setActionQuery(old=>({...old,[vache.id]:e.target.value}))}/></label><div className="max-h-40 space-y-1 overflow-y-auto">{actionNames.filter(n=>actionKey(n).includes(actionKey(actionQuery[vache.id]??""))).slice(0,12).map(n=><button key={n} type="button" disabled={saving} className="block min-h-11 w-full rounded-lg border bg-white px-2 text-left text-sm" onClick={()=>addAction(vache.id,n)}>{n}</button>)}</div><button type="button" disabled={saving||!validActionName(actionQuery[vache.id])} className="min-h-11 w-full rounded-lg bg-orange-700 px-2 text-sm font-bold text-white disabled:opacity-40" onClick={()=>addAction(vache.id,actionQuery[vache.id])}>Créer et sélectionner l’action</button></div>}
                  {(draft.actions??[]).map(action=><label key={action.type} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-950">Échéance {action.type}<input type="date" min={date} value={action.due} disabled={saving} className="min-h-11 max-w-full rounded border bg-white px-2" onChange={e=>change(vache.id,{actions:(draft.actions??[]).map(a=>a.type===action.type?{...a,due:e.target.value}:a)})}/></label>)}
                {(
                  <input
                    value={draft.remarque}
                    onChange={(event) => setDrafts((current) => updateDraft(current, vache.id, (item) => ({ ...item, remarque: event.target.value })))}
                    placeholder="Note facultative"
                    className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-green-500"
                  />
                )}
                </div>
              </article>
            );
          })}
          {displayedCows.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Aucune vache trouvée</p>}
        </main>

        {bullPicker && <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label="Choisir un taureau"><div className="flex max-h-[80%] w-full min-w-0 max-w-md flex-col rounded-t-xl bg-white p-3 sm:rounded-xl"><div className="flex items-center justify-between"><h3 className="font-bold">Choisir un taureau</h3><button type="button" className="min-h-11 min-w-11" aria-label="Fermer le choix du taureau" onClick={()=>setBullPicker(null)}>×</button></div><input autoFocus value={bullQuery} onChange={e=>setBullQuery(e.target.value)} placeholder="Nom ou numéro du taureau" className="min-h-11 w-full min-w-0 rounded-lg border px-2"/><div className="min-h-0 overflow-y-auto"><button type="button" className="block min-h-11 w-full text-left" onClick={()=>{change(bullPicker,{bullId:"",breedingDate:""});setBullPicker(null);}}>Non renseigné</button>{taureaux.filter(t=>normEcho((t.nopere??"")+" "+t.nupere+" "+t.nupere.slice(-4)).includes(normEcho(bullQuery))).sort((a,b)=>(a.nopere||a.nupere).localeCompare(b.nopere||b.nupere,"fr")).map(t=><button type="button" key={t.id} className="block min-h-11 w-full border-t py-2 text-left" onClick={()=>{change(bullPicker,{bullId:t.id});setBullPicker(null);}}><strong className="block break-all">{t.nopere||t.nupere}</strong>{t.nopere&&t.nopere!==t.nupere&&<span className="text-xs text-gray-500">{t.nupere}</span>}</button>)}</div></div></div>}
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
