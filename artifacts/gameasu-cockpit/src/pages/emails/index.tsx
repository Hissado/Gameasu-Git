import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Mail, Loader2, CheckCircle2, XCircle, Search, Eye, X, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type EmailEntry = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: string;
  sentAt: string;
  result: {
    delivered: boolean;
    provider: "resend-connector" | "resend" | "sendgrid" | "preview";
    messageId?: string;
    error?: string;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  security: "Sécurité",
  invitation: "Invitation",
  commercial: "Commercial",
  password_reset: "Réinitialisation",
  marketing: "Marketing",
};

const PROVIDER_LABELS: Record<string, string> = {
  "resend-connector": "Resend (connector)",
  resend: "Resend",
  sendgrid: "SendGrid",
  preview: "Preview (test)",
};

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function EmailsPage() {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<EmailEntry | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cockpit-emails"],
    queryFn: () => apiFetch<{ count: number; rows: EmailEntry[] }>("/api/super-admin/emails"),
    refetchInterval: 30_000,
  });

  const rows = (data?.rows ?? []).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.to.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q);
  });

  const delivered = (data?.rows ?? []).filter(r => r.result.delivered).length;
  const failed = (data?.rows ?? []).filter(r => !r.result.delivered).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Emails envoyés</h1>
          <p className="page-subtitle">Historique des emails envoyés par la plateforme Gaméasù</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="stat-value text-2xl">{data?.count ?? 0}</p>
                <p className="stat-label">Total envoyés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{delivered}</p>
                <p className="stat-label">Délivrés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{failed}</p>
                <p className="stat-label">Échoués</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par destinataire ou sujet…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {search && <p className="text-sm text-muted-foreground">{rows.length} résultat{rows.length !== 1 ? "s" : ""}</p>}
      </div>

      {/* Table */}
      <Card className="premium-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "Aucun email trouvé pour cette recherche" : "Aucun email enregistré"}</p>
              {!search && <p className="text-xs mt-1">Les emails apparaissent ici dès qu'ils sont envoyés par la plateforme</p>}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinataire</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sujet</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Catégorie</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fournisseur</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((email, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[160px]">{email.to}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-muted-foreground truncate max-w-[200px]">{email.subject}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[email.category ?? ""] ?? email.category ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {PROVIDER_LABELS[email.result.provider] ?? email.result.provider}
                      </td>
                      <td className="px-4 py-3">
                        {email.result.delivered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Délivré
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600" title={email.result.error}>
                            <XCircle className="w-3.5 h-3.5" /> Échoué
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {fmtDatetime(email.sentAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(email)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email preview dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Aperçu de l'email</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">À :</span> <strong>{preview.to}</strong></div>
                <div><span className="text-muted-foreground">Date :</span> <strong>{fmtDatetime(preview.sentAt)}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Sujet :</span> <strong>{preview.subject}</strong></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  srcDoc={preview.html}
                  className="w-full h-80 bg-white"
                  sandbox="allow-same-origin"
                  title="Email preview"
                />
              </div>
              {preview.result.error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <strong>Erreur :</strong> {preview.result.error}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
