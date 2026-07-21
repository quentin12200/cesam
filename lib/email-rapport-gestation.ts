import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import nodemailer from "nodemailer";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: "leyrat.quentin@gmail.com", pass: process.env.GMAIL_APP_PASSWORD },
});

type VacheGestante = {
  nobovi: string | null;
  nutrav: string;
  dateVelagePrevue: Date;
  joursRestants: number;
  etat: string; // VERT | ROSE | GRIS
  pereNom: string | null;
  dateSaillie: Date;
};

export async function sendRapportGestation(vaches: VacheGestante[], to: string[]) {
  const now = new Date();
  const dateStr = format(now, "EEEE d MMMM yyyy", { locale: fr });

  const imminentes = vaches.filter((v) => v.joursRestants <= 21).sort((a, b) => a.joursRestants - b.joursRestants);
  const enCours = vaches.filter((v) => v.joursRestants > 21).sort((a, b) => a.joursRestants - b.joursRestants);

  function etatBadge(etat: string) {
    if (etat === "VERT") return `<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Confirmée</span>`;
    if (etat === "ROSE") return `<span style="background:${VELAGE_IMMINENT_COLORS.hex};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Imminente</span>`;
    return `<span style="background:#9ca3af;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Non confirmée</span>`;
  }

  function tableauVaches(list: VacheGestante[], titre: string, couleur: string) {
    if (list.length === 0) return "";
    const rows = list.map((v) => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-weight:600">${v.nobovi ?? "—"}</td>
        <td style="padding:8px 12px;color:#6b7280">${v.nutrav}</td>
        <td style="padding:8px 12px">${format(v.dateVelagePrevue, "dd/MM/yyyy")}</td>
        <td style="padding:8px 12px;font-weight:700;color:${v.joursRestants <= 7 ? "#dc2626" : v.joursRestants <= 21 ? "#d97706" : "#374151"}">${v.joursRestants}j</td>
        <td style="padding:8px 12px">${etatBadge(v.etat)}</td>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px">${v.pereNom ?? "—"}</td>
      </tr>`).join("");

    return `
      <h2 style="margin:24px 0 8px;color:${couleur};font-size:16px">${titre} (${list.length})</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <thead>
          <tr style="background:#f3f4f6;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
            <th style="padding:8px 12px;text-align:left">Nom</th>
            <th style="padding:8px 12px;text-align:left">Nutrav</th>
            <th style="padding:8px 12px;text-align:left">Vêlage prévu</th>
            <th style="padding:8px 12px;text-align:left">Restant</th>
            <th style="padding:8px 12px;text-align:left">État</th>
            <th style="padding:8px 12px;text-align:left">Père</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;background:#f9fafb;padding:24px">
      <div style="background:#15803d;color:#fff;border-radius:10px 10px 0 0;padding:20px 24px;display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">🐄</span>
        <div>
          <h1 style="margin:0;font-size:20px">Rapport Gestation — GAEC CESAM</h1>
          <p style="margin:4px 0 0;opacity:.8;font-size:13px">${dateStr}</p>
        </div>
      </div>
      <div style="background:#fff;border-radius:0 0 10px 10px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
          <div style="flex:1;min-width:120px;background:#fef3c7;border-radius:8px;padding:12px 16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#d97706">${imminentes.length}</div>
            <div style="font-size:12px;color:#92400e">Vêlages imminents<br/>(≤ 21 jours)</div>
          </div>
          <div style="flex:1;min-width:120px;background:#dcfce7;border-radius:8px;padding:12px 16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#16a34a">${enCours.length}</div>
            <div style="font-size:12px;color:#166534">Vaches gestantes<br/>(> 21 jours)</div>
          </div>
          <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:8px;padding:12px 16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#1d4ed8">${vaches.length}</div>
            <div style="font-size:12px;color:#1e3a8a">Total gestantes</div>
          </div>
        </div>
        ${tableauVaches(imminentes, "🔔 Vêlages imminents (≤ 21 jours)", "#d97706")}
        ${tableauVaches(enCours, "✅ Vaches gestantes", "#15803d")}
        ${vaches.length === 0 ? '<p style="color:#6b7280;text-align:center;padding:24px">Aucune vache gestante en cours.</p>' : ""}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">GAEC CESAM • Généré automatiquement</p>
    </div>`;

  await transporter.sendMail({
    from: '"CESAM Élevage" <leyrat.quentin@gmail.com>',
    to: to.join(", "),
    subject: `🐄 Rapport gestation${imminentes.length > 0 ? ` — ⚠️ ${imminentes.length} vêlage${imminentes.length > 1 ? "s" : ""} imminent${imminentes.length > 1 ? "s" : ""}` : ""} — ${format(now, "dd/MM/yyyy")}`,
    html,
  });
}
