import type { Request } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

/**
 * Log d'audit non bloquant : on ne casse jamais une requête utile à cause d'une
 * écriture d'audit (try/catch silencieux + console.warn).
 */
export type AuditAction =
  | "create" | "update" | "delete"
  | "login" | "logout" | "login_failed"
  | "invite" | "invitation_resend" | "invitation_accept"
  | "role_change" | "permission_change" | "department_change"
  | "password_change" | "password_reset_request" | "password_reset_complete"
  | "deactivate" | "activate"
  | "project_access_grant" | "project_access_revoke"
  // ── Workflow commercial ───────────────────────────────────────────────────
  | "order_edit" | "order_cancel" | "order_generate_invoice"
  | "proforma_edit" | "proforma_cancel" | "proforma_generate_invoice"
  | "invoice_edit" | "invoice_cancel" | "payment_record";

export async function audit(
  req: Pick<Request, "ip" | "headers"> & { authUser?: { id: string; email: string; organizationId?: string } },
  action: AuditAction,
  opts: {
    entityType?: string;
    entityId?: string | null;
    payload?: unknown;
    organizationId?: string;
  } = {},
) {
  const orgId = opts.organizationId ?? (req as any).authUser?.organizationId;
  if (!orgId) {
    console.warn("[audit] skipped: missing organizationId for action", action);
    return;
  }
  try {
    await db.insert(auditLogsTable).values({
      organizationId: orgId,
      userId: req.authUser?.id ?? null,
      userEmail: req.authUser?.email ?? null,
      action,
      entityType: opts.entityType ?? null,
      entityId: (opts.entityId ?? null) as any,
      payload: (opts.payload ?? null) as any,
      ipAddress: (req.ip ?? null) as any,
      userAgent: (req.headers?.["user-agent"] as string) ?? null,
    });
  } catch (e: any) {
    console.warn("[audit] write failed:", e?.message);
  }
}
