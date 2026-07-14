/**
 * Envoi d'emails via Resend (Replit Connectors SDK) ou fallback preview.
 *
 * Stratégie :
 * 1) Replit Connectors SDK → proxy Resend (préféré, zero-config en prod)
 * 2) RESEND_API_KEY dans l'env → appel Resend direct
 * 3) SENDGRID_API_KEY → SendGrid direct
 * 4) Sinon → mode "preview" : log console + boîte de réception mémoire
 *
 * Les routes d'invitation renvoient toujours l'URL dans la réponse HTTP
 * pour faciliter le copier-coller, quelle que soit la méthode d'envoi.
 */

export type EmailAttachment = {
  filename: string;
  content: string; // base64-encoded
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: string;
  attachments?: EmailAttachment[];
};

export type EmailDeliveryResult = {
  delivered: boolean;
  provider: "resend-connector" | "resend" | "sendgrid" | "preview";
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
  const from = process.env.EMAIL_FROM || "Gameasu <noreply@gameasu.com>";

  let result: EmailDeliveryResult;
  try {
    // 1) Replit Connectors SDK → Resend proxy (preferred)
    if (!sendgridKey && !resendKey) {
      try {
        const { ReplitConnectors } = await import("@replit/connectors-sdk");
        const connectors = new ReplitConnectors();
        const r = await connectors.proxy("resend", "/emails", {
          method: "POST",
          body: JSON.stringify({
            from,
            to: msg.to,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
          }),
          headers: { "Content-Type": "application/json" },
        });
        const j: any = typeof r === "object" ? r : {};
        if (j?.id) {
          result = { delivered: true, provider: "resend-connector", messageId: j.id };
        } else {
          result = { delivered: false, provider: "resend-connector", error: j?.message || JSON.stringify(j).slice(0, 200) };
        }
      } catch (connErr: any) {
        // Connector not available (dev without binding) → fall through to preview
        console.log(`[email] connector unavailable: ${connErr?.message} — using preview mode`);
        result = await previewFallback(msg);
      }
    } else if (resendKey) {
      // 2) Direct Resend via API key
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text,
          ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
        }),
      });
      const j: any = await r.json().catch(() => ({}));
      result = r.ok
        ? { delivered: true, provider: "resend", messageId: j.id }
        : { delivered: false, provider: "resend", error: j?.message || `Resend HTTP ${r.status}` };
    } else {
      // 3) SendGrid
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
    }
  } catch (e: any) {
    result = { delivered: false, provider: "preview", error: e?.message || "send failed" };
  }

  PREVIEW_INBOX.push({ ...msg, sentAt: new Date(), result });
  if (PREVIEW_INBOX.length > 200) PREVIEW_INBOX.splice(0, PREVIEW_INBOX.length - 200);
  return result;
}

async function previewFallback(msg: EmailMessage): Promise<EmailDeliveryResult> {
  console.log(`\n📧 [EMAIL PREVIEW] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
  return { delivered: true, provider: "preview" };
}

function parseFromHeader(h: string): { email: string; name?: string } {
  const m = h.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: h.trim() };
}

// ─── Commercial Document Templates ──────────────────────────────────────────

type OrgBranding = { name: string; logoUrl?: string | null; primaryColor?: string | null };
type DocLine = { description: string; quantity: number; unitPriceFcfa: number; discountPct: number; taxRatePct: number; totalFcfa: number };

function fmt(n: number) { return n.toLocaleString("fr-FR") + " FCFA"; }

function buildDocHeader(org: OrgBranding, color: string): string {
  const logo = org.logoUrl
    ? `<img src="${org.logoUrl}" alt="${org.name}" style="max-height:48px;max-width:160px;object-fit:contain" />`
    : `<div style="color:#fff;font-weight:700;letter-spacing:2px;font-size:14px">${org.name.toUpperCase()}</div>`;
  return `<div style="background:${color};padding:20px 28px">${logo}</div>`;
}

function buildLinesTable(lines: DocLine[]): string {
  if (!lines.length) return "";
  const rows = lines.map(l => {
    const disc = l.discountPct > 0 ? ` <span style="color:#e67e22;font-size:10px">(−${l.discountPct}%)</span>` : "";
    return `<tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px 10px;font-size:13px">${l.description}</td>
      <td style="padding:8px 10px;text-align:center;font-size:13px;color:#555">${l.quantity}</td>
      <td style="padding:8px 10px;text-align:right;font-size:13px;color:#555">${fmt(l.unitPriceFcfa)}${disc}</td>
      <td style="padding:8px 10px;text-align:center;font-size:13px;color:#555">${l.taxRatePct}%</td>
      <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:600">${fmt(l.totalFcfa)}</td>
    </tr>`;
  }).join("");
  const subtotalHT = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100), 0);
  const totalTVA = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100) * (l.taxRatePct / 100), 0);
  const totalTTC = subtotalHT + totalTVA;
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Inter,Arial,sans-serif">
    <thead><tr style="background:#f8f8f8">
      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Description</th>
      <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Qté</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">PU HT</th>
      <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">TVA</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">Total TTC</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end"><table style="width:260px;font-size:13px">
    <tr><td style="padding:3px 8px;color:#666">Sous-total HT</td><td style="padding:3px 8px;text-align:right">${fmt(Math.round(subtotalHT))}</td></tr>
    <tr><td style="padding:3px 8px;color:#666">TVA</td><td style="padding:3px 8px;text-align:right">${fmt(Math.round(totalTVA))}</td></tr>
    <tr style="border-top:2px solid #eee"><td style="padding:6px 8px;font-weight:700;font-size:15px">Total TTC</td><td style="padding:6px 8px;text-align:right;font-weight:700;font-size:15px">${fmt(Math.round(totalTTC))}</td></tr>
  </table></div>`;
}

function buildDocEmail(opts: {
  org: OrgBranding; docTypeLabel: string; refNumber: string; clientName: string;
  totalAmount: number; lines: DocLine[]; notes?: string | null;
  extraFields?: Array<{ label: string; value: string }>; message?: string;
  color: string; headerColor?: string;
}): EmailMessage {
  const { color } = opts;
  const headerColor = opts.headerColor ?? color;
  const header = buildDocHeader(opts.org, headerColor);
  const linesHtml = buildLinesTable(opts.lines);
  const extras = (opts.extraFields ?? []).map(f =>
    `<div style="font-size:12px;color:#666;margin-top:2px">${f.label} : <strong>${f.value}</strong></div>`
  ).join("");
  const notesHtml = opts.notes ? `<div style="margin-top:16px;background:#fafafa;border-left:3px solid ${color};border-radius:4px;padding:12px;font-size:13px;color:#555"><strong>Notes :</strong> ${opts.notes}</div>` : "";
  const msgHtml = opts.message ? `<div style="margin-bottom:16px;padding:12px;background:#EFF6FF;border-radius:8px;font-size:13px;color:#333;font-style:italic">"${opts.message}"</div>` : "";
  const totalBlock = linesHtml ? "" : `<div style="text-align:center;padding:24px 0"><div style="font-size:30px;font-weight:700;color:${color}">${fmt(opts.totalAmount)}</div><div style="font-size:12px;color:#aaa;margin-top:4px">Montant total TTC</div></div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  ${header}
  <div style="padding:28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div><div style="font-size:11px;letter-spacing:1.5px;color:#999;text-transform:uppercase;margin-bottom:4px">${opts.docTypeLabel}</div><div style="font-size:22px;font-weight:700">${opts.refNumber}</div></div>
      <div style="text-align:right"><div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Client</div><div style="font-weight:600;font-size:15px">${opts.clientName}</div>${extras}</div>
    </div>
    ${msgHtml}${linesHtml}${totalBlock}${notesHtml}
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">© ${new Date().getFullYear()} ${opts.org.name} — Gameasu</div>
</div></body></html>`;
  const textLines = opts.lines.map(l => `  - ${l.description} × ${l.quantity} = ${fmt(l.totalFcfa)}`).join("\n");
  const text = `${opts.docTypeLabel} ${opts.refNumber}\nClient : ${opts.clientName}\n${textLines ? `\nLignes :\n${textLines}\n` : ""}Total : ${fmt(opts.totalAmount)}${opts.notes ? `\n\nNotes : ${opts.notes}` : ""}`;
  return { to: "", subject: `${opts.docTypeLabel} ${opts.refNumber} — ${opts.org.name}`, html, text, category: "commercial" };
}

export function buildProformaEmail(opts: {
  org: OrgBranding; refNumber: string; clientName: string; totalAmount: number;
  lines: DocLine[]; notes?: string | null; validUntil?: string | null;
  paymentTerms?: string | null; message?: string;
}): EmailMessage {
  const extras: Array<{ label: string; value: string }> = [];
  if (opts.validUntil) extras.push({ label: "Valide jusqu'au", value: new Date(opts.validUntil).toLocaleDateString("fr-FR") });
  if (opts.paymentTerms) extras.push({ label: "Conditions", value: opts.paymentTerms });
  return buildDocEmail({ ...opts, docTypeLabel: "DEVIS", color: "#2563eb", extraFields: extras });
}

export function buildOrderEmail(opts: {
  org: OrgBranding; refNumber: string; clientName: string; totalAmount: number;
  lines: DocLine[]; notes?: string | null; message?: string;
}): EmailMessage {
  return buildDocEmail({ ...opts, docTypeLabel: "BON DE COMMANDE", color: "#2563EB" });
}

export function buildInvoiceEmail(opts: {
  org: OrgBranding; refNumber: string; clientName: string; totalAmount: number;
  lines: DocLine[]; notes?: string | null; dueDate?: string | null; message?: string;
}): EmailMessage {
  const extras: Array<{ label: string; value: string }> = [];
  if (opts.dueDate) extras.push({ label: "Échéance", value: new Date(opts.dueDate).toLocaleDateString("fr-FR") });
  return buildDocEmail({ ...opts, docTypeLabel: "FACTURE", color: "#2563EB", headerColor: "#0E1A39", extraFields: extras });
}

export function buildCreditNoteEmail(opts: {
  org: OrgBranding; refNumber: string; originalInvoiceRef: string; clientName: string;
  amount: number; reason: string; notes?: string | null; message?: string;
}): EmailMessage {
  const color = "#2563EB";
  const header = buildDocHeader(opts.org, "#0E1A39");
  const msgHtml = opts.message ? `<div style="margin-bottom:16px;padding:12px;background:#EFF6FF;border-radius:8px;font-size:13px;color:#333;font-style:italic">"${opts.message}"</div>` : "";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  ${header}
  <div style="padding:28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div><div style="font-size:11px;letter-spacing:1.5px;color:#999;text-transform:uppercase;margin-bottom:4px">NOTE DE CRÉDIT / AVOIR</div><div style="font-size:22px;font-weight:700">${opts.refNumber}</div></div>
      <div style="text-align:right"><div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Client</div><div style="font-weight:600;font-size:15px">${opts.clientName}</div><div style="font-size:12px;color:#666;margin-top:2px">Facture d'origine : ${opts.originalInvoiceRef}</div></div>
    </div>
    ${msgHtml}
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
      <div style="font-size:11px;color:#1D4ED8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Montant de l'avoir</div>
      <div style="font-size:32px;font-weight:700;color:${color}">− ${fmt(opts.amount)}</div>
    </div>
    <div style="margin-top:16px;background:#fafafa;border-left:3px solid ${color};padding:12px;font-size:13px;color:#555"><strong>Motif :</strong> ${opts.reason}</div>
    ${opts.notes ? `<div style="margin-top:12px;font-size:13px;color:#666"><strong>Notes :</strong> ${opts.notes}</div>` : ""}
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">© ${new Date().getFullYear()} ${opts.org.name} — Gameasu</div>
</div></body></html>`;
  const text = `NOTE DE CRÉDIT ${opts.refNumber}\nClient : ${opts.clientName}\nFacture d'origine : ${opts.originalInvoiceRef}\nMontant : −${fmt(opts.amount)}\nMotif : ${opts.reason}`;
  return { to: "", subject: `Note de crédit ${opts.refNumber} — ${opts.org.name}`, html, text, category: "commercial" };
}

// ─── Templates ──────────────────────────────────────────────────────────
export function buildInvitationEmail(opts: {
  recipientName: string; inviterName: string; orgName?: string; acceptUrl: string;
  temporaryPassword: string;
}): EmailMessage {
  const org = opts.orgName ?? "Gameasu";
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
  <div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#3B82F6;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">${org.toUpperCase()}</div><h1 style="margin:0;font-size:22px">Bienvenue dans ${org}</h1></div>
  <div style="padding:24px 28px;line-height:1.6">
    <p>Bonjour <strong>${opts.recipientName}</strong>,</p>
    <p><strong>${opts.inviterName}</strong> vous invite à rejoindre la plateforme.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${opts.acceptUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Activer mon compte</a>
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

export function buildTwoFactorEmail(opts: {
  recipientName: string; code: string; expirationMinutes: number;
}): EmailMessage {
  return {
    to: "",
    subject: "Votre code de vérification Gameasu",
    text: `Bonjour ${opts.recipientName},\n\nVotre code de vérification est :\n\n${opts.code}\n\nCe code expire dans ${opts.expirationMinutes} minutes.\n\nSi vous n'êtes pas à l'origine de cette connexion, ignorez ce message et sécurisez votre compte.`,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#0C1830 100%);padding:24px 28px">
    <div style="color:#5BA3F0;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:4px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:18px;font-weight:600">Vérification de connexion</div>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:14px;color:#444">Bonjour <strong>${opts.recipientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">Voici votre code de vérification à usage unique :</p>
    <div style="background:#F6F8FB;border:2px solid #1D6CE8;border-radius:12px;padding:24px;text-align:center;margin:0 0 20px">
      <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#080E1C;font-family:'JetBrains Mono',monospace">${opts.code}</div>
      <div style="font-size:12px;color:#999;margin-top:8px">Expire dans ${opts.expirationMinutes} minutes</div>
    </div>
    <p style="margin:0;font-size:12px;color:#aaa">Si vous n'avez pas tenté de vous connecter, ignorez ce message et vérifiez la sécurité de votre compte.</p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">© ${new Date().getFullYear()} Gameasu — noreply@gameasu.com</div>
</div></body></html>`,
    category: "security",
  };
}

export function buildExpertFirmInvitationEmail(opts: {
  firmName: string;
  plan: string;
  acceptUrl: string;
}): EmailMessage {
  const planLabel: Record<string, string> = {
    starter: "Starter", business: "Business", premium: "Premium", enterprise: "Personnalisée",
    // Alias anciens codes
    growth: "Business", professional: "Premium",
  };
  return {
    to: "",
    subject: `Invitation à rejoindre Gameasu — Cabinet ${opts.firmName}`,
    text: [
      `Bonjour,`,
      ``,
      `L'équipe Gameasu vous invite à créer votre espace professionnel pour le cabinet "${opts.firmName}" (plan ${planLabel[opts.plan] ?? opts.plan}).`,
      ``,
      `Pour accepter l'invitation et activer votre compte, cliquez sur le lien suivant (valide 72 heures) :`,
      opts.acceptUrl,
      ``,
      `Une fois votre compte activé, vous pourrez :`,
      `  • Gérer votre cabinet et vos collaborateurs`,
      `  • Créer et inviter vos clients (tenants)`,
      `  • Accéder à tous les dossiers de vos clients depuis un seul tableau de bord`,
      ``,
      `À très bientôt sur Gameasu,`,
      `L'équipe Gameasu`,
    ].join("\n"),
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#1a2640 100%);padding:28px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:13px;margin-bottom:8px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:22px;font-weight:700">Invitation Cabinet Expert</div>
    <div style="color:#8fa3c0;font-size:14px;margin-top:6px">Rejoignez la plateforme ERP nouvelle génération</div>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#333">Bonjour,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">
      L'équipe <strong>Gameasu</strong> vous invite à créer votre espace professionnel pour le cabinet :
    </p>
    <div style="background:#F8F9FB;border:1.5px solid #E8ECF4;border-radius:10px;padding:18px 20px;margin:0 0 24px">
      <div style="font-size:18px;font-weight:700;color:#080E1C">${opts.firmName}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Plan ${planLabel[opts.plan] ?? opts.plan}</div>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#555">
      Une fois activé, vous pourrez <strong>gérer vos collaborateurs, créer vos clients et accéder à tous leurs dossiers</strong> depuis un seul tableau de bord multi-clients.
    </p>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.acceptUrl}" style="background:#F37021;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:0.3px">
        Activer mon espace cabinet
      </a>
    </p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0">
      Ce lien est valable <strong>72 heures</strong>. Si le bouton ne fonctionne pas, copiez ce lien :<br>
      <span style="word-break:break-all;color:#0066cc">${opts.acceptUrl}</span>
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gameasu — Votre ERP SaaS nouvelle génération en Afrique de l'Ouest
  </div>
</div></body></html>`,
    category: "invitation",
  };
}

export function buildPlanChangeEmail(opts: {
  orgName: string;
  recipientName: string;
  newPlanName: string;
  newPlanCode: string;
  includedModules: string[];
  changedByFirmName: string;
  changedByUserName: string;
}): EmailMessage {
  const planColorMap: Record<string, string> = {
    STARTER: "#64748b", BUSINESS: "#0369a1", PREMIUM: "#7c3aed", ENTERPRISE: "#1d4ed8",
    // Alias anciens codes
    GROWTH: "#0369a1", PROFESSIONAL: "#7c3aed",
  };
  const accent = planColorMap[opts.newPlanCode.toUpperCase()] ?? "#F37021";
  const moduleList = opts.includedModules.length
    ? opts.includedModules.map((m) => `<li style="padding:2px 0;font-size:13px;color:#444">${m}</li>`).join("")
    : `<li style="font-size:13px;color:#888">Aucun module spécifié</li>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#1a2640 100%);padding:28px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:13px;margin-bottom:8px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:20px;font-weight:700">Changement de formule d'abonnement</div>
    <div style="color:#8fa3c0;font-size:13px;margin-top:6px">${opts.orgName}</div>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:14px;color:#444">Bonjour <strong>${opts.recipientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">
      Votre cabinet partenaire <strong>${opts.changedByFirmName}</strong> a modifié la formule d'abonnement de votre espace de travail.
    </p>
    <div style="background:#F8F9FB;border:2px solid ${accent};border-radius:10px;padding:20px;text-align:center;margin:0 0 24px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Nouvelle formule</div>
      <div style="font-size:28px;font-weight:800;color:${accent}">${opts.newPlanName}</div>
    </div>
    <p style="font-size:13px;font-weight:600;color:#333;margin:0 0 8px">Modules inclus dans votre formule :</p>
    <ul style="margin:0 0 20px;padding-left:18px;list-style:disc">
      ${moduleList}
    </ul>
    <div style="background:#fafafa;border-radius:8px;padding:14px 16px;font-size:12px;color:#777;border:1px solid #eee">
      Modification effectuée par <strong>${opts.changedByUserName}</strong> (${opts.changedByFirmName}) le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#aaa">
      Si vous estimez que cette modification est erronée, contactez votre cabinet partenaire ou l'équipe Gameasu.
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gameasu — Votre ERP SaaS nouvelle génération en Afrique de l'Ouest
  </div>
</div></body></html>`;
  const text = [
    `Bonjour ${opts.recipientName},`,
    ``,
    `Le cabinet ${opts.changedByFirmName} a modifié la formule d'abonnement de ${opts.orgName}.`,
    ``,
    `Nouvelle formule : ${opts.newPlanName}`,
    ``,
    `Modules inclus :`,
    ...opts.includedModules.map((m) => `  - ${m}`),
    ``,
    `Modification effectuée par ${opts.changedByUserName} (${opts.changedByFirmName}).`,
  ].join("\n");
  return {
    to: "",
    subject: `Votre formule Gameasu a été modifiée → ${opts.newPlanName}`,
    html,
    text,
    category: "billing",
  };
}

// ─── SaaS Self-Onboarding Templates ─────────────────────────────────────────

export function buildRegistrationEmail(opts: {
  firstName: string;
  orgName: string;
  planName: string;
  seats: number;
  totalTTC: number;
  billingUrl: string;
}): EmailMessage {
  function fmtFCFA(n: number) { return n.toLocaleString("fr-FR") + " FCFA"; }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#1a2640 100%);padding:28px 32px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:13px;margin-bottom:10px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:22px;font-weight:700">Bienvenue, ${opts.firstName} ! 🎉</div>
    <div style="color:#8fa3c0;font-size:14px;margin-top:6px">Votre espace <strong style="color:#e2e8f0">${opts.orgName}</strong> est créé</div>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#333">
      Votre espace de travail <strong>${opts.orgName}</strong> a bien été créé sur Gameasu.<br>
      Il ne reste qu'une étape : <strong>effectuer le paiement</strong> pour l'activer.
    </p>
    <div style="background:#FFF7ED;border:2px solid #FB923C;border-radius:12px;padding:20px 24px;margin:0 0 24px">
      <div style="font-size:11px;color:#C2410C;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Votre abonnement</div>
      <div style="font-size:20px;font-weight:700;color:#1e293b">${opts.planName}</div>
      <div style="font-size:13px;color:#555;margin-top:4px">${opts.seats} siège${opts.seats > 1 ? "s" : ""} — <strong>${fmtFCFA(opts.totalTTC)} TTC</strong></div>
    </div>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.billingUrl}" style="background:#F37021;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:0.3px">
        Finaliser le paiement →
      </a>
    </p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0">
      Ce lien vous connecte directement à votre espace Gameasu.<br>
      <span style="word-break:break-all;color:#0066cc">${opts.billingUrl}</span>
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gameasu — ERP SaaS nouvelle génération en Afrique de l'Ouest
  </div>
</div></body></html>`;
  const text = [
    `Bienvenue sur Gameasu, ${opts.firstName} !`,
    ``,
    `Votre espace "${opts.orgName}" a bien été créé.`,
    ``,
    `Abonnement : ${opts.planName} — ${opts.seats} siège${opts.seats > 1 ? "s" : ""} — ${fmtFCFA(opts.totalTTC)} TTC`,
    ``,
    `Pour activer votre espace, finalisez le paiement :`,
    opts.billingUrl,
    ``,
    `L'équipe Gameasu`,
  ].join("\n");
  return {
    to: "",
    subject: `Bienvenue sur Gameasu — finalisez l'activation de ${opts.orgName}`,
    html, text, category: "onboarding",
  };
}

export function buildActivationEmail(opts: {
  firstName: string;
  orgName: string;
  planName: string;
  periodEnd: Date | null;
  loginUrl: string;
}): EmailMessage {
  const periodEndStr = opts.periodEnd
    ? opts.periodEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#1a2640 100%);padding:28px 32px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:13px;margin-bottom:10px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:22px;font-weight:700">✅ Votre espace est activé !</div>
    <div style="color:#8fa3c0;font-size:14px;margin-top:6px">${opts.orgName}</div>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#333">
      Bonjour <strong>${opts.firstName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">
      Votre paiement a été confirmé. L'espace de travail <strong>${opts.orgName}</strong> est désormais
      <strong style="color:#059669">actif</strong> sur la formule <strong>${opts.planName}</strong>.
    </p>
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:18px 20px;margin:0 0 24px">
      <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Abonnement actif jusqu'au</div>
      <div style="font-size:20px;font-weight:700;color:#14532d">${periodEndStr}</div>
    </div>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.loginUrl}" style="background:#059669;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
        Accéder à mon espace →
      </a>
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gameasu — ERP SaaS nouvelle génération en Afrique de l'Ouest
  </div>
</div></body></html>`;
  const text = [
    `Bonjour ${opts.firstName},`,
    ``,
    `Votre espace "${opts.orgName}" est maintenant actif sur la formule ${opts.planName}.`,
    ``,
    `Abonnement valide jusqu'au : ${periodEndStr}`,
    ``,
    `Accédez à votre espace : ${opts.loginUrl}`,
    ``,
    `L'équipe Gameasu`,
  ].join("\n");
  return {
    to: "",
    subject: `✅ Votre espace ${opts.orgName} est activé sur Gameasu`,
    html, text, category: "onboarding",
  };
}

export function buildDocumentReceivedEmail(opts: {
  recipientName: string;
  firmName: string;
  documentTitle: string;
  clientOrgName: string;
  clientUserName: string;
  reviewUrl: string;
}): EmailMessage {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#1a2640 100%);padding:28px 32px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:13px;margin-bottom:8px;text-transform:uppercase">Gameasu</div>
    <div style="color:#fff;font-size:20px;font-weight:700">Document reçu</div>
    <div style="color:#8fa3c0;font-size:13px;margin-top:6px">${opts.firmName}</div>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px;color:#333">
      Bonjour <strong>${opts.recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">
      Votre client <strong>${opts.clientOrgName}</strong> vient de déposer un document en réponse à votre demande.
    </p>
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:18px 20px;margin:0 0 24px">
      <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Document déposé</div>
      <div style="font-size:17px;font-weight:700;color:#14532d">${opts.documentTitle}</div>
      <div style="font-size:13px;color:#555;margin-top:6px">Déposé par : <strong>${opts.clientUserName}</strong></div>
    </div>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.reviewUrl}" style="background:#F37021;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:0.3px">
        Consulter le document →
      </a>
    </p>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0">
      Si le bouton ne fonctionne pas, copiez ce lien :<br>
      <span style="word-break:break-all;color:#0066cc">${opts.reviewUrl}</span>
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gameasu — Vous recevez cet email car vous êtes membre du cabinet ${opts.firmName}.
  </div>
</div></body></html>`;
  const text = [
    `Bonjour ${opts.recipientName},`,
    ``,
    `Votre client ${opts.clientOrgName} vient de déposer un document en réponse à votre demande.`,
    ``,
    `Document : ${opts.documentTitle}`,
    `Déposé par : ${opts.clientUserName}`,
    ``,
    `Consultez le document : ${opts.reviewUrl}`,
    ``,
    `L'équipe Gameasu`,
  ].join("\n");
  return {
    to: "",
    subject: `Document reçu de ${opts.clientOrgName} — ${opts.documentTitle}`,
    html,
    text,
    category: "notification",
  };
}

export function buildPasswordResetEmail(opts: {
  recipientName: string; resetUrl: string;
}): EmailMessage {
  return {
    to: "",
    subject: "Réinitialisation de votre mot de passe Gameasu",
    text: `Bonjour ${opts.recipientName},\n\nUne demande de réinitialisation a été reçue. Cliquez sur le lien ci-dessous (valide 1h) :\n${opts.resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;padding:24px">
  <h2 style="margin:0 0 12px">Réinitialisation de mot de passe</h2>
  <p>Bonjour <strong>${opts.recipientName}</strong>,</p>
  <p>Une demande de réinitialisation a été reçue. Le lien ci-dessous est valable 1 heure :</p>
  <p style="text-align:center;margin:24px 0"><a href="${opts.resetUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Réinitialiser mon mot de passe</a></p>
  <p style="font-size:12px;color:#888">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
</div></body></html>`,
    category: "password_reset",
  };
}
