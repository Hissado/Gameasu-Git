import type { Request } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, securityAlertsTable } from "@workspace/db";
import { and, eq, gte, sql, count } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditCategory = "audit" | "navigation";
export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AuditStatus = "success" | "failure" | "denied";

export type AuditAction =
  | "create" | "update" | "delete" | "archive" | "restore" | "duplicate"
  | "view" | "export" | "import" | "download" | "print" | "send_email"
  | "validate" | "approve" | "reject" | "cancel" | "status_change"
  | "attachment_add" | "attachment_remove"
  | "login" | "logout" | "login_failed"
  | "login_2fa_sent" | "login_2fa_success" | "login_2fa_failed" | "login_2fa_locked"
  | "trusted_device_added" | "trusted_device_revoked"
  | "invite" | "invitation_resend" | "invitation_accept" | "invitation_revoke"
  | "invitation_sent" | "user_activated"
  | "onboarding_link_generated" | "onboarding_link_used" | "onboarding_link_revoked"
  | "role_change" | "permission_change" | "department_change"
  | "password_change" | "password_reset_request" | "password_reset_complete"
  | "deactivate" | "activate" | "2fa_disabled" | "2fa_enabled"
  | "project_access_grant" | "project_access_revoke"
  | "client_access_grant" | "client_access_revoke"
  | "order_edit" | "order_cancel" | "order_generate_invoice"
  | "proforma_edit" | "proforma_cancel" | "proforma_generate_invoice"
  | "invoice_edit" | "invoice_cancel" | "payment_record" | "payment_validate"
  | "journal_entry_create" | "journal_entry_validate" | "journal_entry_reverse"
  | "period_close" | "period_reopen" | "bank_reconciliation"
  | "salary_view" | "salary_change" | "payroll_generate" | "payroll_validate"
  | "payslip_download" | "advance_approve" | "leave_approve" | "contract_change"
  | "banking_change" | "fiscal_param_change" | "declaration_validate"
  | "module_activate" | "module_deactivate" | "subscription_change" | "addon_activate"
  | "org_settings_change" | "org_switch"
  | "kiosk_token_generate" | "kiosk_token_revoke" | "kiosk_token_access" | "kiosk_create" | "kiosk_delete"
  | "qr_token_generate" | "qr_token_status_change" | "qr_token_revoke"
  | "expert_firm_create" | "expert_firm_update"
  | "expert_member_invite" | "expert_member_remove"
  | "expert_client_link" | "expert_client_unlink"
  | "expert_doc_request_create" | "expert_doc_request_update"
  | "expert_plan_change"
  | "security_alert" | "unauthorized_access" | "access_denied"
  | "audit_export" | "audit_view";

/** Change structuré : champ modifié avec ancien/nouvelle valeur */
export interface AuditChange {
  field: string;
  label?: string;
  before?: unknown;
  after?: unknown;
}

/** Sévérité par défaut selon l'action */
const ACTION_SEVERITY: Partial<Record<AuditAction, AuditSeverity>> = {
  login: "info", logout: "info", view: "info",
  create: "medium", update: "medium", archive: "low", restore: "low", duplicate: "low",
  export: "medium", import: "medium", download: "low", print: "low", send_email: "low",
  validate: "medium", approve: "medium", reject: "low", cancel: "low", status_change: "low",
  delete: "high", deactivate: "high",
  login_failed: "medium", login_2fa_failed: "medium", login_2fa_locked: "high",
  role_change: "high", permission_change: "high", org_settings_change: "high",
  password_change: "high", password_reset_complete: "high",
  salary_view: "high", salary_change: "critical", payroll_generate: "high", payroll_validate: "critical",
  advance_approve: "high", contract_change: "high",
  journal_entry_validate: "high", journal_entry_reverse: "high",
  period_close: "high", period_reopen: "critical",
  banking_change: "critical", fiscal_param_change: "high", declaration_validate: "high",
  module_activate: "high", module_deactivate: "high", subscription_change: "high", addon_activate: "medium",
  "2fa_disabled": "critical", unauthorized_access: "critical", access_denied: "high",
  security_alert: "critical", audit_export: "high",
  kiosk_create: "medium", kiosk_delete: "high", kiosk_token_generate: "medium", kiosk_token_revoke: "high",
  expert_firm_create: "medium", expert_firm_update: "low",
};

/** Extraire browser/OS/device depuis user-agent */
function parseUserAgent(ua: string | undefined): { browser?: string; os?: string; device?: string } {
  if (!ua) return {};
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari" :
    /OPR\/|Opera\//.test(ua) ? "Opera" : "Autre";
  const os =
    /Windows NT/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Linux/.test(ua) ? "Linux" : "Autre";
  const device =
    /Mobi|Android|iPhone/.test(ua) ? "Mobile" :
    /iPad|Tablet/.test(ua) ? "Tablette" : "Bureau";
  return { browser, os, device };
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export async function audit(
  req: Pick<Request, "ip" | "headers"> & {
    authUser?: { id: string; email: string; organizationId?: string; role?: string; sessionId?: string };
    id?: string; // request id (pino)
  },
  action: AuditAction,
  opts: {
    entityType?: string;
    entityId?: string | null;
    entityName?: string;
    module?: string;
    subModule?: string;
    page?: string;
    payload?: unknown;
    changes?: AuditChange[];
    organizationId?: string;
    severity?: AuditSeverity;
    status?: AuditStatus;
    category?: AuditCategory;
    errorMessage?: string;
  } = {},
) {
  const orgId = opts.organizationId ?? (req as any).authUser?.organizationId;
  if (!orgId) {
    return; // silencieux — pas d'org = pas de trace (ex : avant auth)
  }
  const ua = (req.headers?.["user-agent"] as string) ?? undefined;
  const { browser, os, device } = parseUserAgent(ua);
  const severity = opts.severity ?? ACTION_SEVERITY[action] ?? "medium";

  try {
    await db.insert(auditLogsTable).values({
      organizationId: orgId,
      userId: (req as any).authUser?.id ?? null,
      userEmail: (req as any).authUser?.email ?? null,
      userRole: (req as any).authUser?.role ?? null,
      action,
      category: opts.category ?? "audit",
      severity,
      status: opts.status ?? "success",
      module: opts.module ?? null,
      subModule: opts.subModule ?? null,
      page: opts.page ?? null,
      entityType: opts.entityType ?? null,
      entityId: (opts.entityId ?? null) as any,
      entityName: opts.entityName ?? null,
      changes: (opts.changes ?? null) as any,
      payload: (opts.payload ?? null) as any,
      errorMessage: opts.errorMessage ?? null,
      sessionId: (req as any).authUser?.sessionId ?? null,
      requestId: (req as any).id ?? null,
      ipAddress: (req.ip ?? null) as any,
      userAgent: ua ?? null,
      browser: browser ?? null,
      os: os ?? null,
      device: device ?? null,
    });

    // Détection anomalies en arrière-plan (non-bloquant)
    detectAnomalies(orgId, (req as any).authUser?.id, action, req.ip ?? "").catch(() => {});
  } catch (e: any) {
    // Jamais bloquant
  }
}

// ─── Détection d'anomalies ────────────────────────────────────────────────────

const SENSITIVE_ACTIONS: AuditAction[] = [
  "salary_change", "banking_change", "role_change", "permission_change",
  "2fa_disabled", "delete", "period_reopen", "declaration_validate",
];

async function detectAnomalies(orgId: string, userId: string | undefined, action: AuditAction, ip: string) {
  if (!userId) return;
  const now = new Date();
  const fiveMin = new Date(now.getTime() - 5 * 60_000);
  const oneHour = new Date(now.getTime() - 60 * 60_000);

  // Brute force : 5+ login_failed en 5 min
  if (action === "login_failed") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.userId, userId),
        eq(auditLogsTable.action, "login_failed"),
        gte(auditLogsTable.createdAt, fiveMin),
      ));
    if (Number(n) >= 4) {
      await createAlert(orgId, userId, null, "brute_force", "critical",
        `Tentatives de connexion répétées détectées (${Number(n) + 1} échecs en 5 min)`);
    }
    return;
  }

  // Suppression massive : 10+ suppressions en 1h
  if (action === "delete") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.userId, userId),
        eq(auditLogsTable.action, "delete"),
        gte(auditLogsTable.createdAt, oneHour),
      ));
    if (Number(n) >= 9) {
      await createAlert(orgId, userId, null, "mass_delete", "high",
        `Suppression massive détectée : ${Number(n) + 1} suppressions en moins d'1h`);
    }
    return;
  }

  // Export massif : 20+ exports en 1h
  if (action === "export" || action === "audit_export") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.userId, userId),
        eq(auditLogsTable.action, "export"),
        gte(auditLogsTable.createdAt, oneHour),
      ));
    if (Number(n) >= 19) {
      await createAlert(orgId, userId, null, "mass_export", "high",
        `Export massif détecté : ${Number(n) + 1} exports en moins d'1h`);
    }
    return;
  }

  // Actions sensibles toujours alertées
  if (SENSITIVE_ACTIONS.includes(action)) {
    const labels: Partial<Record<AuditAction, string>> = {
      salary_change: "Modification de salaire détectée",
      banking_change: "Modification de coordonnées bancaires détectée",
      role_change: "Changement de rôle utilisateur effectué",
      permission_change: "Modification de permissions effectuée",
      "2fa_disabled": "Désactivation de la double authentification",
      period_reopen: "Réouverture d'une période comptable clôturée",
      declaration_validate: "Validation d'une déclaration fiscale",
    };
    if (labels[action]) {
      await createAlert(orgId, userId, null, action as string, "high", labels[action]!);
    }
  }
}

async function createAlert(
  orgId: string, userId: string | null, userEmail: string | null,
  type: string, severity: "medium" | "high" | "critical", message: string,
  detail?: unknown,
) {
  try {
    // Anti-doublon : pas 2 alertes identiques en moins de 30 min
    const thirtyMin = new Date(Date.now() - 30 * 60_000);
    const existing = await db
      .select({ id: securityAlertsTable.id })
      .from(securityAlertsTable)
      .where(and(
        eq(securityAlertsTable.organizationId, orgId),
        eq(securityAlertsTable.type, type),
        ...(userId ? [eq(securityAlertsTable.userId, userId)] : []),
        gte(securityAlertsTable.createdAt, thirtyMin),
        sql`${securityAlertsTable.resolvedAt} IS NULL`,
      ))
      .limit(1);
    if (existing.length > 0) return;

    await db.insert(securityAlertsTable).values({
      organizationId: orgId,
      userId: userId as any,
      userEmail,
      type,
      severity,
      message,
      detail: (detail ?? null) as any,
    });
  } catch { /* non-bloquant */ }
}
