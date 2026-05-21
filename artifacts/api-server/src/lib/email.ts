/**
 * Envoi d'emails — détection automatique d'intégration disponible.
 *
 * Stratégie :
 * 1) Si SENDGRID_API_KEY ou RESEND_API_KEY présents → utiliser le provider correspondant.
 * 2) Sinon → mode "preview" : on log l'email en console et on garde l'enveloppe en
 *    mémoire pour qu'un admin puisse récupérer le lien depuis le panneau "Invitations".
 *
 * Les routes d'invitation renvoient toujours l'URL d'acceptation dans la réponse
 * pour faciliter le copier-coller, indépendamment de l'envoi effectif.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  provider: "sendgrid" | "resend" | "preview";
  messageId?: string;
  error?: string;
};

const PREVIEW_INBOX: Array<EmailMessage & { sentAt: Date; result: EmailDeliveryResult }> = [];

export function getPreviewInbox(limit = 50) {
  return PREVIEW_INBOX.slice(-limit).reverse();
}

export async function sendEmail(msg: EmailMessage): Promise<EmailDeliveryResult> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Gaméasù <no-reply@gameasu.africa>";

  let result: EmailDeliveryResult;
  try {
    if (sendgridKey) {
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: msg.to }] }],
          from: parseFromHeader(from),
          subject: msg.subject,
          content: [
            { type: "text/plain", value: msg.text },
            { type: "text/html", value: msg.html },
          ],
        }),
      });
      result = r.ok
        ? { delivered: true, provider: "sendgrid", messageId: r.headers.get("x-message-id") || undefined }
        : { delivered: false, provider: "sendgrid", error: `SendGrid HTTP ${r.status}: ${await r.text()}` };
    } else if (resendKey) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
      });
      const j: any = await r.json().catch(() => ({}));
      result = r.ok
        ? { delivered: true, provider: "resend", messageId: j.id }
        : { delivered: false, provider: "resend", error: j?.message || `Resend HTTP ${r.status}` };
    } else {
      console.log(`\n📧 [EMAIL PREVIEW] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
      result = { delivered: true, provider: "preview" };
    }
  } catch (e: any) {
    result = { delivered: false, provider: "preview", error: e?.message || "send failed" };
  }

  PREVIEW_INBOX.push({ ...msg, sentAt: new Date(), result });
  if (PREVIEW_INBOX.length > 200) PREVIEW_INBOX.splice(0, PREVIEW_INBOX.length - 200);
  return result;
}

function parseFromHeader(h: string): { email: string; name?: string } {
  const m = h.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: h.trim() };
}

// ─── Templates ──────────────────────────────────────────────────────────
export function buildInvitationEmail(opts: {
  recipientName: string; inviterName: string; orgName?: string; acceptUrl: string;
  temporaryPassword: string;
}): EmailMessage {
  const org = opts.orgName ?? "Gaméasù";
  return {
    to: "",
    subject: `Invitation à rejoindre ${org}`,
    text: [
      `Bonjour ${opts.recipientName},`,
      ``,
      `${opts.inviterName} vous invite à rejoindre ${org}.`,
      ``,
      `Pour activer votre compte, cliquez sur le lien suivant (valide 7 jours) :`,
      opts.acceptUrl,
      ``,
      `Mot de passe temporaire : ${opts.temporaryPassword}`,
      `Vous serez invité(e) à le changer à votre première connexion.`,
      ``,
      `À très bientôt,`,
      `L'équipe ${org}`,
    ].join("\n"),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
  <div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#FF6B00;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">${org.toUpperCase()}</div><h1 style="margin:0;font-size:22px">Bienvenue dans ${org}</h1></div>
  <div style="padding:24px 28px;line-height:1.6">
    <p>Bonjour <strong>${opts.recipientName}</strong>,</p>
    <p><strong>${opts.inviterName}</strong> vous invite à rejoindre la plateforme.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${opts.acceptUrl}" style="background:#FF6B00;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Activer mon compte</a>
    </p>
    <p style="font-size:13px;color:#555">Lien valable 7 jours. Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all;color:#0066cc">${opts.acceptUrl}</span></p>
    <div style="background:#f8f8f8;border-radius:8px;padding:14px;margin-top:18px">
      <div style="font-size:11px;letter-spacing:1px;color:#666;text-transform:uppercase">Mot de passe temporaire</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:18px;margin-top:4px"><strong>${opts.temporaryPassword}</strong></div>
      <div style="font-size:12px;color:#777;margin-top:4px">Il vous sera demandé de le changer à la première connexion.</div>
    </div>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:12px;color:#888;border-top:1px solid #eee">© ${new Date().getFullYear()} ${org} — Tous droits réservés.</div>
</div></body></html>`,
    category: "invitation",
  };
}

export function buildPasswordResetEmail(opts: {
  recipientName: string; resetUrl: string;
}): EmailMessage {
  return {
    to: "",
    subject: "Réinitialisation de votre mot de passe Gaméasù",
    text: `Bonjour ${opts.recipientName},\n\nUne demande de réinitialisation a été reçue. Cliquez sur le lien ci-dessous (valide 1h) :\n${opts.resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;padding:24px">
  <h2 style="margin:0 0 12px">Réinitialisation de mot de passe</h2>
  <p>Bonjour <strong>${opts.recipientName}</strong>,</p>
  <p>Une demande de réinitialisation a été reçue. Le lien ci-dessous est valable 1 heure :</p>
  <p style="text-align:center;margin:24px 0"><a href="${opts.resetUrl}" style="background:#FF6B00;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Réinitialiser mon mot de passe</a></p>
  <p style="font-size:12px;color:#888">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
</div></body></html>`,
    category: "password_reset",
  };
}
