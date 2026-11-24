type Identity = { national?: string | null; name?: string | null };
const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
export function conflictingFatherIdentity(sources: Identity[]): boolean {
  for (let i = 0; i < sources.length; i++) for (let j = i + 1; j < sources.length; j++) {
    const a = sources[i], b = sources[j];
    const an = norm(a.national).replace(/\s/g, ""), bn = norm(b.national).replace(/\s/g, "");
    if (an && bn && !an.startsWith("A_COMPLETER_") && !bn.startsWith("A_COMPLETER_")) {
      if (an !== bn) return true;
    } else if (norm(a.name) && norm(b.name) && norm(a.name) !== norm(b.name)) return true;
  }
  return false;
}
