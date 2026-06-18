import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "leyrat.quentin@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendUnauthorizedAccessEmail(email: string, displayName: string | null) {
  await transporter.sendMail({
    from: '"CESAM Sécurité" <leyrat.quentin@gmail.com>',
    to: "leyrat.quentin@gmail.com",
    subject: "⚠️ Tentative d'accès non autorisé — CESAM",
    text: `Tentative de connexion refusée.\n\nEmail : ${email}\nNom : ${displayName ?? "inconnu"}\nDate : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
    html: `
      <h2>⚠️ Tentative d'accès non autorisé</h2>
      <table style="font-family:sans-serif;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><strong>${email}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Nom</td><td>${displayName ?? "inconnu"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td>${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</td></tr>
      </table>
      <p style="margin-top:16px;color:#888;font-size:13px">Application GAEC CESAM</p>
    `,
  });
}
