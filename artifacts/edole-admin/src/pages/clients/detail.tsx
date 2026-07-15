import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SectionHelp } from "@/components/ui/section-help";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Client360Tab from "./Client360Tab";
import {
  Building2, Briefcase, FolderKanban, CheckSquare, Check, FolderOpen,
  MessageSquare, Plus, ChevronLeft, ChevronRight, Mail, Phone, Globe,
  Repeat, Calendar, ChevronDown, MessageCircle, Send, Inbox,
  ArrowUpRight, ArrowDownLeft, Paperclip, Clock, Activity,
  FileText, CreditCard, ShoppingCart, Receipt, Users2, Tag,
  CheckCircle2, AlertCircle, Sparkles, ExternalLink, Pin, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

function waLink(phone?: string, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  const url = `https://wa.me/${digits}`;
  return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function relDate(d: string | Date) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days}j`;
  return fmtDate(d);
}

type Client = { id: string; name: string; email?: string; phone?: string; website?: string; industry?: string; address?: string; status: string; creditLimit?: number | null; paymentTermsDays?: number | null };
type CreditRisk = { encours: number; overdueAmount: number; overdueCount: number; creditLimit: number | null; paymentTermsDays: number | null; utilisationPct: number | null; riskScore: "low" | "medium" | "high" | "critical" };
type Engagement = { id: string; name: string; isRecurring: boolean; status: string; recurrencePattern?: any; clientName?: string };
type Project = { id: string; name: string; status: string; progress?: number };
type Task = { id: string; title: string; status: string; priority: string; serviceId?: string; projectId?: string; dueDate?: string };
type EmailLog = { id: string; direction: string; subject: string; fromAddress: string; toAddress: string; preview?: string; body?: string; status: string; hasAttachments: boolean; sentAt: string };
type ActivityEvent = { id: string; type: string; label: string; createdAt: string; meta: Record<string, any> };
type Conv = { id: string; title?: string | null; type: string; lastMessage?: string | null; lastMessageAt?: string | null };

// ─── Activity event config ────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  client_created:        { icon: Building2,    color: "text-blue-500",   label: "Client créé" },
  project_created:       { icon: FolderKanban, color: "text-indigo-500", label: "Projet créé" },
  invoice_created:       { icon: Receipt,      color: "text-orange-500", label: "Facture créée" },
  proforma_created:      { icon: FileText,     color: "text-amber-500",  label: "Devis créé" },
  order_created:         { icon: ShoppingCart, color: "text-green-500",  label: "Commande créée" },
  payment_recorded:      { icon: CreditCard,   color: "text-emerald-500",label: "Encaissement" },
  email_sent:            { icon: ArrowUpRight, color: "text-sky-500",    label: "Email envoyé" },
  email_received:        { icon: ArrowDownLeft,color: "text-purple-500", label: "Email reçu" },
  conversation_created:  { icon: MessageSquare,color: "text-pink-500",   label: "Groupe créé" },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDetailWorkspace() {
  const [, params] = useRoute("/clients/:id");
  const [, navigate] = useLocation();
  const id = params?.id;

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["client", id], queryFn: () => apiFetch(`/api/clients/${id}`), enabled: !!id,
  });
  const { data: creditRisk } = useQuery<CreditRisk>({
    queryKey: ["client-credit-risk", id], queryFn: () => apiFetch(`/api/clients/${id}/credit-risk`), enabled: !!id,
  });
  const { data: engagements } = useQuery<{ data: Engagement[] }>({
    queryKey: ["client-engagements", id], queryFn: () => apiFetch(`/api/engagements?clientId=${id}`), enabled: !!id,
  });
  const { data: projects } = useQuery<{ data: Project[] }>({
    queryKey: ["client-projects", id], queryFn: () => apiFetch(`/api/projects?clientId=${id}&limit=200`), enabled: !!id,
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-12">Chargement…</div>;
  if (!client) return <div className="text-center text-muted-foreground py-12">Client introuvable.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Tous les clients
      </Link>

      <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              {client.industry && <span>{client.industry}</span>}
              {client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="w-3 h-3" />{client.email}</a>}
              {client.phone && <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" />{client.phone}</a>}
              {client.website && <a href={client.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="w-3 h-3" />Site</a>}
            </div>
          </div>
        </div>
        {client.phone && waLink(client.phone) && (
          <a
            href={waLink(client.phone)!}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#25D366] text-white text-sm font-medium hover:bg-[#1DA851] transition-colors shrink-0"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Briefcase}    label="Engagements" value={engagements?.data?.length ?? 0} />
        <StatCard icon={FolderKanban} label="Projets"      value={projects?.data?.length ?? 0} />
        <StatCard icon={CheckSquare}  label="Tâches"        value="—" />
        <StatCard icon={FolderOpen}   label="Documents"     value="—" />
      </div>

      {/* Credit Risk Panel */}
      {creditRisk && (
        <div className={`rounded-xl border p-4 grid grid-cols-2 md:grid-cols-4 gap-4 ${
          creditRisk.riskScore === "critical" ? "bg-red-50 border-red-200" :
          creditRisk.riskScore === "high" ? "bg-orange-50 border-orange-200" :
          creditRisk.riskScore === "medium" ? "bg-amber-50 border-amber-200" :
          "bg-emerald-50/40 border-emerald-200/60"
        }`}>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Encours</p>
            <p className={`text-xl font-bold mt-0.5 ${creditRisk.encours > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {formatFCFA(creditRisk.encours)}
            </p>
            {creditRisk.creditLimit && (
              <p className="text-xs text-muted-foreground mt-0.5">
                / {formatFCFA(creditRisk.creditLimit)}
                {creditRisk.utilisationPct !== null && (
                  <span className={`ml-1 font-semibold ${creditRisk.utilisationPct >= 80 ? "text-red-600" : creditRisk.utilisationPct >= 60 ? "text-amber-600" : "text-emerald-600"}`}>
                    ({creditRisk.utilisationPct}%)
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">En retard</p>
            <p className={`text-xl font-bold mt-0.5 ${creditRisk.overdueAmount > 0 ? "text-red-600" : "text-emerald-700"}`}>
              {creditRisk.overdueAmount > 0 ? formatFCFA(creditRisk.overdueAmount) : "Aucun"}
            </p>
            {creditRisk.overdueCount > 0 && (
              <p className="text-xs text-red-600 font-medium">{creditRisk.overdueCount} facture{creditRisk.overdueCount > 1 ? "s" : ""}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Délai paiement</p>
            <p className="text-xl font-bold mt-0.5">{creditRisk.paymentTermsDays ? `${creditRisk.paymentTermsDays}j` : "—"}</p>
          </div>
          <div className="flex flex-col items-start md:items-end justify-center">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Score risque</p>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
              creditRisk.riskScore === "critical" ? "bg-red-100 border-red-300 text-red-700" :
              creditRisk.riskScore === "high" ? "bg-orange-100 border-orange-300 text-orange-700" :
              creditRisk.riskScore === "medium" ? "bg-amber-100 border-amber-300 text-amber-700" :
              "bg-emerald-100 border-emerald-300 text-emerald-700"
            }`}>
              {creditRisk.riskScore === "critical" && "🔴 Critique"}
              {creditRisk.riskScore === "high" && "🟠 Élevé"}
              {creditRisk.riskScore === "medium" && "🟡 Modéré"}
              {creditRisk.riskScore === "low" && "🟢 Faible"}
            </span>
            {creditRisk.creditLimit && creditRisk.utilisationPct !== null && (
              <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full transition-all ${
                  creditRisk.utilisationPct >= 80 ? "bg-red-500" :
                  creditRisk.utilisationPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                }`} style={{ width: `${Math.min(100, creditRisk.utilisationPct)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="360" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="360">Vue 360° <SectionHelp id="clients.detail.360" /></TabsTrigger>
          <TabsTrigger value="tree">Arborescence <SectionHelp id="clients.detail.tree" /></TabsTrigger>
          <TabsTrigger value="engagements">Services <SectionHelp id="clients.detail.engagements" /></TabsTrigger>
          <TabsTrigger value="projects">Projets <SectionHelp id="clients.detail.projects" /></TabsTrigger>
          <TabsTrigger value="communication">
            <Mail className="w-3.5 h-3.5 mr-1" />Communication <SectionHelp id="clients.detail.communication" />
          </TabsTrigger>
          <TabsTrigger value="messaging">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />Messagerie <SectionHelp id="clients.detail.messaging" />
          </TabsTrigger>
          <TabsTrigger value="notes">
            <FileText className="w-3.5 h-3.5 mr-1" />Notes <SectionHelp id="clients.detail.notes" />
          </TabsTrigger>
          <TabsTrigger value="journal">
            <Activity className="w-3.5 h-3.5 mr-1" />Journal <SectionHelp id="clients.detail.journal" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="360" className="mt-4">
          <Client360Tab clientId={client.id} />
        </TabsContent>

        <TabsContent value="tree" className="mt-4">
          <Card><CardContent className="p-4">
            <ClientTreeView clientId={client.id} engagements={engagements?.data ?? []} projects={projects?.data ?? []} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="engagements" className="mt-4 space-y-2">
          {(engagements?.data ?? []).length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Aucun engagement pour ce client.</p>
              <Link href="/services"><Button size="sm" variant="outline" className="mt-3"><Plus className="w-4 h-4 mr-1" />Créer un engagement</Button></Link>
            </CardContent></Card>
          )}
          {(engagements?.data ?? []).map(e => (
            <Link key={e.id} href={`/services/${e.id}`}>
              <Card className="hover:border-primary/50 cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium flex-1 truncate">{e.name}</span>
                  {e.isRecurring && <Badge variant="secondary" className="gap-1 text-xs"><Repeat className="w-3 h-3" />{e.recurrencePattern?.frequency}</Badge>}
                  <Badge variant="outline" className="text-xs">{e.status}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-2">
          {(projects?.data ?? []).length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Aucun projet pour ce client.</p>
            </CardContent></Card>
          )}
          {(projects?.data ?? []).map(p => (
            <Link key={p.id} href={`/projets/${p.id}`}>
              <Card className="hover:border-primary/50 cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium flex-1 truncate">{p.name}</span>
                  <Badge variant="outline" className="text-xs">{p.status}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>

        {/* ── Communication ── */}
        <TabsContent value="communication" className="mt-4">
          <CommunicationTab client={client} />
        </TabsContent>

        {/* ── Messagerie ── */}
        <TabsContent value="messaging" className="mt-4">
          <MessagingTab client={client} />
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes" className="mt-4">
          <NotesTab clientId={client.id} />
        </TabsContent>

        {/* ── Journal d'activité ── */}
        <TabsContent value="journal" className="mt-4">
          <JournalTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Communication tab ────────────────────────────────────────────────────────

function CommunicationTab({ client }: { client: Client }) {
  const qc = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery<{ data: EmailLog[] }>({
    queryKey: ["client-emails", client.id],
    queryFn: () => apiFetch(`/api/clients/${client.id}/emails`),
  });
  const emails = data?.data ?? [];

  async function sendEmail() {
    if (!subject.trim() || !body.trim()) { toast.error("Sujet et message requis"); return; }
    setSending(true);
    try {
      await apiFetch(`/api/clients/${client.id}/emails/send`, {
        method: "POST",
        body: { subject, body, toAddress: client.email },
      });
      toast.success("Email envoyé et enregistré");
      qc.invalidateQueries({ queryKey: ["client-emails", client.id] });
      qc.invalidateQueries({ queryKey: ["client-activity", client.id] });
      setSubject(""); setBody(""); setComposeOpen(false);
    } catch {
      toast.error("Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  const totalEmails = emails.length;
  const sent = emails.filter(e => e.direction === "outbound").length;
  const received = emails.filter(e => e.direction === "inbound").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">{totalEmails} échange{totalEmails !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1 text-sky-600"><ArrowUpRight className="w-3.5 h-3.5" />{sent} envoyé{sent !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1 text-purple-600"><ArrowDownLeft className="w-3.5 h-3.5" />{received} reçu{received !== 1 ? "s" : ""}</span>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-white" onClick={() => setComposeOpen(true)}>
          <Send className="w-3.5 h-3.5" /> Composer un email
        </Button>
      </div>

      {/* AI synthesis */}
      {emails.length > 0 && (
        <Card className="border-amber-200/60 bg-primary/5">
          <CardContent className="p-4 flex gap-3">
            <Sparkles className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-amber-800">Synthèse des échanges</div>
              <p className="text-sm text-amber-700/90">
                {sent} email{sent !== 1 ? "s" : ""} envoyé{sent !== 1 ? "s" : ""} et {received} reçu{received !== 1 ? "s" : ""} avec {client.name}.
                {emails[0] && ` Dernier échange le ${fmtDate(emails[0].sentAt)} — ${emails[0].direction === "outbound" ? "envoi" : "réception"} : « ${emails[0].subject} ».`}
                {sent > 0 && " Suivi actif."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email list */}
      {isLoading && <div className="text-center py-8 text-muted-foreground text-sm">Chargement…</div>}
      {!isLoading && emails.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucun email enregistré pour ce client</p>
            <p className="text-xs mt-1">Composez un premier email pour démarrer le suivi de communication.</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setComposeOpen(true)}>
              <Send className="w-3.5 h-3.5" /> Composer
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {emails.map(email => (
          <EmailCard key={email.id} email={email} />
        ))}
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Nouveau message à {client.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>À</Label>
              <Input value={client.email ?? ""} disabled className="bg-slate-50 text-sm" />
            </div>
            <div className="space-y-1">
              <Label>Sujet *</Label>
              <Input placeholder="Objet du message…" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Message *</Label>
              <Textarea rows={6} placeholder="Corps du message…" value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)}>Annuler</Button>
              <Button className="gap-1.5 bg-primary text-white" disabled={sending} onClick={sendEmail}>
                <Send className="w-3.5 h-3.5" /> {sending ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailCard({ email }: { email: EmailLog }) {
  const [expanded, setExpanded] = useState(false);
  const isOut = email.direction === "outbound";
  return (
    <Card className={`hover:shadow-sm transition-shadow ${isOut ? "border-l-2 border-l-sky-400" : "border-l-2 border-l-purple-400"}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isOut ? "bg-sky-100" : "bg-purple-100"}`}>
            {isOut ? <ArrowUpRight className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-purple-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{email.subject}</span>
              {email.hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
              <StatusBadge status={email.status} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
              <span>{isOut ? `À : ${email.toAddress}` : `De : ${email.fromAddress}`}</span>
              <span>·</span>
              <span title={fmtDateTime(email.sentAt)}>{relDate(email.sentAt)}</span>
            </div>
            {email.preview && !expanded && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{email.preview}</p>
            )}
            {expanded && email.body && (
              <div className="mt-2 text-sm whitespace-pre-wrap bg-slate-50 rounded-md p-3 border text-slate-700">{email.body}</div>
            )}
          </div>
          <button
            onClick={() => setExpanded(o => !o)}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-1"
          >
            {expanded ? "Réduire" : "Lire"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    sent:      { label: "Envoyé",    class: "bg-blue-100 text-blue-700" },
    delivered: { label: "Livré",     class: "bg-green-100 text-green-700" },
    opened:    { label: "Ouvert",    class: "bg-emerald-100 text-emerald-700" },
    bounced:   { label: "Rejeté",    class: "bg-red-100 text-red-700" },
    failed:    { label: "Échec",     class: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? { label: status, class: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.class}`}>{s.label}</span>;
}

// ─── Messagerie tab ───────────────────────────────────────────────────────────

function MessagingTab({ client }: { client: Client }) {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Conv[] }>({
    queryKey: ["client-conversations", client.id],
    queryFn: () => apiFetch(`/api/conversations?clientId=${client.id}`),
  });
  const conversations = data?.data ?? [];

  const { data: usersData } = useQuery<{ data: Array<{ id: string; firstName: string; lastName: string; email: string; role: string }> }>({
    queryKey: ["users-list"],
    queryFn: () => apiFetch("/api/users"),
  });
  const users = usersData?.data ?? [];

  function toggleUser(uid: string) {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  }

  async function createGroup() {
    setCreating(true);
    try {
      const conv = await apiFetch<Conv>("/api/conversations", {
        method: "POST",
        body: {
          title: groupTitle || `${client.name} — Discussion`,
          type: "group",
          clientId: client.id,
          participantIds: selectedUsers,
        } as any,
      });
      toast.success("Groupe créé");
      qc.invalidateQueries({ queryKey: ["client-conversations", client.id] });
      setCreateOpen(false);
      setGroupTitle("");
      setSelectedUsers([]);
      navigate(`/messaging?convId=${conv.id}`);
    } catch {
      toast.error("Impossible de créer le groupe");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {conversations.length} groupe{conversations.length !== 1 ? "s" : ""} lié{conversations.length !== 1 ? "s" : ""} à ce client
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/messaging?clientId=${client.id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Ouvrir la messagerie
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Nouveau groupe
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-muted-foreground text-sm">Chargement…</div>}
      {!isLoading && conversations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucun groupe lié à ce client</p>
            <p className="text-xs mt-1">Créez un groupe de discussion dédié pour centraliser les échanges internes.</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Créer un groupe
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {conversations.map(conv => (
          <Link key={conv.id} href={`/messaging?convId=${conv.id}`}>
            <Card className="hover:border-primary/50 cursor-pointer hover:shadow-sm transition-all">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{conv.title ?? "Discussion"}</div>
                  {conv.lastMessage && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</div>
                  )}
                </div>
                {conv.lastMessageAt && (
                  <span className="text-xs text-muted-foreground shrink-0">{relDate(conv.lastMessageAt)}</span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setSelectedUsers([]); setGroupTitle(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Nouveau groupe — {client.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nom du groupe</Label>
              <Input
                placeholder={`${client.name} — Discussion`}
                value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Participants{selectedUsers.length > 0 && <span className="ml-1.5 text-xs text-primary font-normal">({selectedUsers.length} sélectionné{selectedUsers.length > 1 ? "s" : ""})</span>}</Label>
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {users.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Chargement…</div>
                )}
                {users.map(u => {
                  const selected = selectedUsers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5" : ""}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                        {selected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button className="gap-1.5 bg-primary text-white" disabled={creating} onClick={createGroup}>
                <Plus className="w-3.5 h-3.5" /> {creating ? "Création…" : "Créer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Journal tab ──────────────────────────────────────────────────────────────

function JournalTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery<{ data: ActivityEvent[] }>({
    queryKey: ["client-activity", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/activity`),
  });
  const events = data?.data ?? [];

  function groupByDate(events: ActivityEvent[]) {
    const groups: Record<string, ActivityEvent[]> = {};
    events.forEach(e => {
      const key = new Date(e.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  }

  const grouped = groupByDate(events);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Chargement…</div>;

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune activité enregistrée</p>
          <p className="text-xs mt-1">Les actions liées à ce client apparaîtront ici au fil du temps.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{date}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2 ml-1">
            {dayEvents.map(event => {
              const cfg = ACTIVITY_CONFIG[event.type] ?? { icon: Activity, color: "text-slate-400", label: event.type };
              const Icon = cfg.icon;
              return (
                <div key={event.id} className="flex items-start gap-3 group">
                  <div className={`mt-0.5 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-sm text-slate-800">{event.label}</p>
                    {event.meta?.amount && (
                      <p className="text-xs text-muted-foreground">{formatFCFA(Number(event.meta.amount))}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-1">
                    {new Date(event.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

type ClientNote = { id: string; content: string; pinned: boolean; authorId?: string | null; createdAt: string; updatedAt: string };

function relTimeNote(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function NoteCard({
  note, editingId, editContent,
  onEdit, onCancelEdit, onEditChange, onSaveEdit, onPin, onDelete,
}: {
  note: ClientNote;
  editingId: string | null;
  editContent: string;
  onEdit: (note: ClientNote) => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onPin: (note: ClientNote) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className={`transition-all ${note.pinned ? "border-primary/40 bg-primary/[0.02]" : ""}`}>
      <CardContent className="p-4">
        {editingId === note.id ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={e => onEditChange(e.target.value)}
              rows={3}
              autoFocus
              className="text-sm resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={onCancelEdit}>Annuler</Button>
              <Button size="sm" className="bg-primary text-white" onClick={() => onSaveEdit(note.id)}>Enregistrer</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-2">{relTimeNote(note.createdAt)}</p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => onPin(note)}
                className={`p-1 rounded hover:bg-muted transition-colors ${note.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                title={note.pinned ? "Désépingler" : "Épingler"}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onEdit(note)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                title="Modifier"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotesTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data, isLoading } = useQuery<{ data: ClientNote[] }>({
    queryKey: ["client-notes", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/notes`),
  });
  const notes = data?.data ?? [];
  const pinnedNotes = notes.filter(n => n.pinned);
  const otherNotes = notes.filter(n => !n.pinned);

  async function addNote() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/clients/${clientId}/notes`, { method: "POST", body: { content: draft } as any });
      qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
      setDraft("");
      toast.success("Note ajoutée");
    } catch { toast.error("Erreur lors de l'ajout"); }
    finally { setSaving(false); }
  }

  async function handlePin(note: ClientNote) {
    await apiFetch(`/api/clients/${clientId}/notes/${note.id}`, { method: "PATCH", body: { pinned: !note.pinned } as any });
    qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/clients/${clientId}/notes/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
    toast.success("Note supprimée");
  }

  async function handleSaveEdit(id: string) {
    if (!editContent.trim()) return;
    await apiFetch(`/api/clients/${clientId}/notes/${id}`, { method: "PATCH", body: { content: editContent } as any });
    qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
    setEditingId(null);
  }

  const cardProps = {
    editingId,
    editContent,
    onEdit: (n: ClientNote) => { setEditingId(n.id); setEditContent(n.content); },
    onCancelEdit: () => setEditingId(null),
    onEditChange: setEditContent,
    onSaveEdit: handleSaveEdit,
    onPin: handlePin,
    onDelete: handleDelete,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Saisissez une note interne…"
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="resize-none text-sm"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Ctrl + Entrée pour envoyer</p>
            <Button size="sm" className="bg-primary text-white gap-1.5" disabled={!draft.trim() || saving} onClick={addNote}>
              <Plus className="w-3.5 h-3.5" /> {saving ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-center py-8 text-muted-foreground text-sm">Chargement…</div>}

      {!isLoading && notes.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucune note pour ce client</p>
            <p className="text-xs mt-1">Ajoutez des notes internes, rappels ou observations.</p>
          </CardContent>
        </Card>
      )}

      {pinnedNotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Pin className="w-3 h-3 text-primary" /> Épinglées
          </p>
          {pinnedNotes.map(n => <NoteCard key={n.id} note={n} {...cardProps} />)}
        </div>
      )}

      {otherNotes.length > 0 && (
        <div className="space-y-2">
          {pinnedNotes.length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Autres notes</p>
          )}
          {otherNotes.map(n => <NoteCard key={n.id} note={n} {...cardProps} />)}
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientTreeView({ clientId, engagements, projects }: { clientId: string; engagements: Engagement[]; projects: Project[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (engagements.length === 0 && projects.length === 0) {
    return <div className="text-center text-muted-foreground py-6 text-sm">Aucune ressource. Créez un engagement ou un projet pour commencer.</div>;
  }
  return (
    <ul className="space-y-1">
      {engagements.length > 0 && (
        <li>
          <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Services</div>
          <ul className="space-y-0.5">
            {engagements.map(e => <TreeNode key={e.id} id={e.id} type="service" name={e.name} open={openIds.has(e.id)} onToggle={() => toggle(e.id)} />)}
          </ul>
        </li>
      )}
      {projects.length > 0 && (
        <li className="mt-3">
          <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Projets</div>
          <ul className="space-y-0.5">
            {projects.map(p => <TreeNode key={p.id} id={p.id} type="project" name={p.name} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} />)}
          </ul>
        </li>
      )}
    </ul>
  );
}

function TreeNode({ id, type, name, open, onToggle }: { id: string; type: "service" | "project"; name: string; open: boolean; onToggle: () => void }) {
  const Icon = type === "service" ? Briefcase : FolderKanban;
  const link = type === "service" ? `/services/${id}` : `/projets/${id}`;
  return (
    <li>
      <div className="flex items-center gap-1 py-1.5 px-2 rounded hover:bg-muted/50">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground p-0.5">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <Icon className="w-4 h-4 text-primary" />
        <Link href={link} className="text-sm hover:underline flex-1 truncate">{name}</Link>
      </div>
      {open && <NodeChildren type={type} id={id} />}
    </li>
  );
}

function NodeChildren({ type, id }: { type: "service" | "project"; id: string }) {
  const { data } = useQuery<any>({
    queryKey: [type, id, "children"],
    queryFn: () => apiFetch(type === "service" ? `/api/engagements/${id}` : `/api/projects/${id}`),
  });
  const tasks: Task[] = data?.tasks ?? [];
  const sections = type === "service" ? (data?.sections ?? []) : [];
  return (
    <ul className="ml-7 mt-1 space-y-0.5">
      {sections.length > 0 && sections.map((s: any) => (
        <li key={s.id} className="text-xs text-muted-foreground py-1 px-2">📂 {s.name}</li>
      ))}
      {tasks.slice(0, 10).map(t => (
        <li key={t.id} className="text-xs flex items-center gap-1.5 py-0.5 px-2">
          <CheckSquare className="w-3 h-3 text-muted-foreground" />
          <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
        </li>
      ))}
      {tasks.length > 10 && <li className="text-xs text-muted-foreground italic px-2">+ {tasks.length - 10} autres tâches</li>}
      {tasks.length === 0 && sections.length === 0 && <li className="text-xs text-muted-foreground italic px-2">Vide</li>}
    </ul>
  );
}
