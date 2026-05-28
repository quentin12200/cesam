"use client";

import { useState } from "react";
import { X, CheckCircle2, Clock } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function markDone() {
    setLoading(true);
    await fetch(`/api/notes-terrain/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traitee: true }),
    });
    onDone(note.id);
  }

  async function deleteNote() {
    setDeleting(true);
    await fetch(`/api/notes-terrain/${note.id}`, { method: "DELETE" });
    onDelete(note.id);
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">« {note.texte} »</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
          <Clock size={11} />
          {timeAgo(note.createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={markDone}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-colors disabled:opacity-50"
          title="Marquer comme traitée"
        >
          <CheckCircle2 size={13} />
          {loading ? "…" : "Traité"}
        </button>
        <button
          onClick={deleteNote}
          disabled={deleting}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Supprimer"
        >
          <X size={14} />
        </button>
      </div>
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
