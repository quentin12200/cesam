"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import RecordActionsMenu from "@/components/RecordActionsMenu";

interface Note {
  id: string;
  texte: string;
  traitee: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function NoteCard({ note, onDone, onDelete }: { note: Note; onDone: (id: string) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [savedTexte, setSavedTexte] = useState(note.texte);
  const [texte, setTexte] = useState(note.texte);

  async function markDone() {
    await fetch(`/api/notes-terrain/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traitee: true }),
    });
    onDone(note.id);
  }

  async function deleteNote() {
    await fetch(`/api/notes-terrain/${note.id}`, { method: "DELETE" });
    onDelete(note.id);
  }

  async function saveNote() {
    const next = texte.trim();
    if (!next) return;
    await fetch(`/api/notes-terrain/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte: next }),
    });
    setSavedTexte(next);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <input value={texte} onChange={(event) => setTexte(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-2 text-sm" autoFocus />
            <button type="button" onClick={() => void saveNote()} className="rounded-lg bg-green-700 px-3 text-xs font-semibold text-white">Enregistrer</button>
            <button type="button" onClick={() => { setTexte(savedTexte); setEditing(false); }} className="rounded-lg border border-gray-300 px-2 text-xs text-gray-600">Annuler</button>
          </div>
        ) : (
          <p className="text-sm text-gray-800 leading-snug">« {savedTexte} »</p>
        )}
        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
          <Clock size={11} />
          {timeAgo(note.createdAt)}
        </div>
      </div>
      <RecordActionsMenu
        onEdit={() => setEditing(true)}
        actions={[
          { label: "Marquer comme traitée", onSelect: markDone },
          { label: "Supprimer la saisie", tone: "danger", confirmMessage: "Supprimer cette note ?", onSelect: deleteNote },
        ]}
      />
    </div>
  );
}

export default function NotesTerrain({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);

  function handleDone(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (notes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2 text-sm">
        🎙️ Notes terrain à traiter
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
          {notes.length}
        </span>
      </h3>
      <div className="space-y-2">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onDone={handleDone}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
