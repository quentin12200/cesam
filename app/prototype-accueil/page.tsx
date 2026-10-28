"use client";

import AccueilRadialMenu, { type ActionId } from "@/app/components/AccueilRadialMenu";
import { useState } from "react";

export default function PrototypeAccueilPage() {
  const [action, setAction] = useState<ActionId | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  return (
    <main className="mx-auto max-w-md space-y-5 p-5">
      <h1 className="text-2xl font-bold">CESAM · Nouvel accueil (test)</h1>
      <p className="text-sm text-slate-600">Prototype sans enregistrement dans l'élevage.</p>
      <AccueilRadialMenu onAction={setAction} onSaveNote={async (content) => { setNotes((prev) => [content, ...prev]); }} />
      {action && <p role="status">Action sélectionnée : {action}</p>}
      {notes.map((note, index) => <p key={index}>{note}</p>)}
    </main>
  );
}
