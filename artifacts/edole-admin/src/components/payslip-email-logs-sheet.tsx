import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, RefreshCw, Mail, Copy, Check,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type EmailLog = {
  id: string;
  sentAt: string;
  sentTo: string;
  provider: string | null;
  messageId: string | null;
  status: string;
  errorMessage: string | null;
};

async function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts?.headers,
    },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as { error?: string }).error ?? r.statusText);
  }
  return r.json() as Promise<T>;
}

const MOIS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
function formatPeriod(period: string) {
  const [yr, mo] = period.split("-");
  return `${MOIS[(parseInt(mo, 10) - 1)] ?? mo} ${yr}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(text).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? "Copié !" : "Copier"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface PayslipEmailLogsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslipId: string | null;
  collaboratorName?: string;
  period?: string;
  hasEmail?: boolean;
  onResent?: () => void;
}

export function PayslipEmailLogsSheet({
  open,
  onOpenChange,
  payslipId,
  collaboratorName,
  period,
  hasEmail = true,
  onResent,
}: PayslipEmailLogsSheetProps) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const { data, isFetching, refetch } = useQuery<{ logs: EmailLog[] }>({
    queryKey: ["payslip-email-logs-sheet", payslipId],
    queryFn: () => apiFetch<{ logs: EmailLog[] }>(`/api/payroll/payslips/${payslipId}/email-logs`),
    enabled: open && !!payslipId,
    staleTime: 0,
  });

  const logs = data?.logs ?? [];

  async function handleResend() {
    if (!payslipId) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      await apiFetch(`/api/payroll/payslips/${payslipId}/send-email`, { method: "POST" });
      setSendSuccess(true);
      await refetch();
      qc.invalidateQueries({ queryKey: ["payslip-email-logs"] });
      qc.invalidateQueries({ queryKey: ["payslip-email-logs-detail"] });
      onResent?.();
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  const periodLabel = period ? formatPeriod(period) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Historique des envois email
          </SheetTitle>
          <SheetDescription>
            {collaboratorName && <span className="font-medium text-foreground">{collaboratorName}</span>}
            {collaboratorName && periodLabel && <span className="mx-1 text-muted-foreground">·</span>}
            {periodLabel && <span>Bulletin {periodLabel}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 border-b bg-muted/30 shrink-0 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {isFetching
              ? "Chargement…"
              : `${logs.length} envoi${logs.length !== 1 ? "s" : ""} enregistré${logs.length !== 1 ? "s" : ""}`
            }
          </div>
          <div className="flex items-center gap-2">
            {sendSuccess && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Email envoyé
              </span>
            )}
            {sendError && (
              <span className="text-xs text-red-600 max-w-[200px] truncate" title={sendError}>
                {sendError}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={sending || !hasEmail}
              onClick={handleResend}
              className="gap-1.5"
            >
              {sending
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : logs.length > 0
                  ? <RefreshCw className="w-3.5 h-3.5" />
                  : <Mail className="w-3.5 h-3.5" />
              }
              {logs.length > 0 ? "Renvoyer" : "Envoyer"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isFetching && logs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <Mail className="w-10 h-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aucun envoi enregistré</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {hasEmail
                    ? "Utilisez le bouton ci-dessus pour envoyer ce bulletin par email."
                    : "Aucun email renseigné pour ce collaborateur."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date &amp; Heure</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Destinataire</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Message ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {log.status === "delivered" ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            Envoyé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs whitespace-nowrap">
                            <XCircle className="w-3 h-3" />
                            Échec
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium max-w-[160px] truncate" title={log.sentTo}>
                        {log.sentTo}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.provider && log.provider !== "unknown" ? (
                          <span className="capitalize">{log.provider}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.messageId ? (
                          <div className="flex items-center gap-1 max-w-[180px]">
                            <code className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono truncate block">
                              {log.messageId}
                            </code>
                            <CopyButton text={log.messageId} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {log.errorMessage ? (
                          <span className="text-red-600" title={log.errorMessage}>
                            {log.errorMessage.length > 60
                              ? log.errorMessage.slice(0, 60) + "…"
                              : log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
