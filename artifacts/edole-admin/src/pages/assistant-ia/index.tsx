import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, MessageSquare, Book, Settings, History, Plus, Trash2, Edit3,
  Send, Loader2, RotateCcw, Phone, Zap, Users, FileText, CheckCircle2,
  TrendingUp, BarChart3, Activity, AlertCircle, ChevronDown, ChevronUp,
  Sparkles, Power,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

// ─── types ──────────────────────────────────────────────────────────────────

type AssistantConfig = {
  id: string; organizationId: string; name: string; description: string | null;
  isActive: boolean; language: string; voiceGender: string; voiceStyle: string;
  formalityLevel: string; greetingMessage: string | null; offHoursMessage: string | null;
  allowAppointmentBooking: boolean; allowTicketCreation: boolean; allowLeadCreation: boolean;
  maxResponseLength: number; systemPromptExtra: string | null; phoneNumber: string | null;
  transferKeywords: string[];
};
type KbItem = {
  id: string; type: string; title: string; content: string;
  category: string | null; isActive: boolean; sortOrder: number;
  createdAt: string;
};
type Stats = {
  totalConversations: number; completedConversations: number;
  transferredConversations: number; ticketsCreated: number;
  leadsCreated: number; appointmentsSet: number; resolutionRate: number;
  knowledgeBaseItems: number; dailyActivity: Array<{ day: string; total: number }>;
};
type Conversation = {
  id: string; channel: string; clientName: string | null; status: string;
  messageCount: number; actionTaken: string | null; createdAt: string; updatedAt: string;
};
type Message = { id: string; role: string; content: string; createdAt: string };
type ConversationDetail = Conversation & { messages: Message[] };

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  faq: "FAQ", document: "Document", info: "Information", procedure: "Procédure", policy: "Politique",
};
const TYPE_COLORS: Record<string, string> = {
  faq: "bg-blue-100 text-blue-700", document: "bg-purple-100 text-purple-700",
  info: "bg-green-100 text-green-700", procedure: "bg-orange-100 text-orange-700",
  policy: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  active: "En cours", completed: "Terminée", transferred: "Transférée", abandoned: "Abandonnée",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700",
  transferred: "bg-orange-100 text-orange-700", abandoned: "bg-gray-100 text-gray-600",
};
const CHANNEL_ICON: Record<string, typeof MessageSquare> = {
  chat: MessageSquare, phone: Phone, whatsapp: MessageSquare, email: FileText,
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Bot; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AssistantIaPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading: loadingConfig } = useQuery<AssistantConfig>({
    queryKey: ["assistant-ia-config"],
    queryFn: () => apiFetch("/api/assistant-ia/config"),
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["assistant-ia-stats"],
    queryFn: () => apiFetch("/api/assistant-ia/stats"),
  });
  const { data: kbItems = [], isLoading: loadingKb } = useQuery<KbItem[]>({
    queryKey: ["assistant-ia-knowledge"],
    queryFn: () => apiFetch("/api/assistant-ia/knowledge"),
  });
  const { data: conversations = [], isLoading: loadingConv } = useQuery<Conversation[]>({
    queryKey: ["assistant-ia-conversations"],
    queryFn: () => apiFetch("/api/assistant-ia/conversations"),
  });

  const updateConfig = useMutation({
    mutationFn: (data: Partial<AssistantConfig>) =>
      apiFetch("/api/assistant-ia/config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistant-ia-config"] }); },
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: (val: boolean) =>
      apiFetch("/api/assistant-ia/config", { method: "PUT", body: JSON.stringify({ isActive: val }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assistant-ia-config"] }); },
  });

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{config?.name ?? "Gameasu Assistant IA"}</h1>
            <p className="text-sm text-muted-foreground">Votre secrétaire virtuelle intelligente, disponible 24h/24</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={config?.isActive ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config?.isActive ? "bg-green-500" : "bg-gray-400"}`} />
            {config?.isActive ? "Actif" : "Inactif"}
          </Badge>
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-muted-foreground" />
            <Switch
              checked={config?.isActive ?? false}
              onCheckedChange={(v) => toggleActive.mutate(v)}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Tableau de bord</TabsTrigger>
          <TabsTrigger value="test" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Tester</TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5"><Book className="w-3.5 h-3.5" />Connaissance</TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5"><Settings className="w-3.5 h-3.5" />Configuration</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="w-3.5 h-3.5" />Historique</TabsTrigger>
        </TabsList>

        {/* ── Tab: Tableau de bord ─────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Conversations (30j)" value={stats?.totalConversations ?? 0} icon={MessageSquare} color="bg-blue-100 text-blue-600" />
            <KpiCard label="Taux de résolution" value={`${stats?.resolutionRate ?? 0}%`} sub="conversations complètes" icon={CheckCircle2} color="bg-green-100 text-green-600" />
            <KpiCard label="Tickets créés" value={stats?.ticketsCreated ?? 0} icon={Zap} color="bg-orange-100 text-orange-600" />
            <KpiCard label="Leads qualifiés" value={stats?.leadsCreated ?? 0} icon={TrendingUp} color="bg-violet-100 text-violet-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Rendez-vous pris" value={stats?.appointmentsSet ?? 0} icon={Users} color="bg-teal-100 text-teal-600" />
            <KpiCard label="Transférés" value={stats?.transferredConversations ?? 0} icon={Activity} color="bg-yellow-100 text-yellow-600" />
            <KpiCard label="Base de connaissance" value={stats?.knowledgeBaseItems ?? 0} sub="entrées actives" icon={Book} color="bg-indigo-100 text-indigo-600" />
            <KpiCard label="Statut" value={config?.isActive ? "Actif" : "Inactif"} sub={config?.language === "fr" ? "Français" : config?.language} icon={Sparkles} color={config?.isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"} />
          </div>

          {stats && stats.dailyActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activité — 30 derniers jours</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.dailyActivity}>
                    <defs>
                      <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, "Conversations"]} />
                    <Area type="monotone" dataKey="total" stroke="#7c3aed" fill="url(#aiGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {stats?.totalConversations === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-medium text-muted-foreground">Aucune conversation pour l'instant</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Activez votre assistant et testez-le dans l'onglet « Tester »</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Tester ──────────────────────────────────────────────────── */}
        <TabsContent value="test" className="mt-6">
          <ChatTab config={config} />
        </TabsContent>

        {/* ── Tab: Base de connaissance ────────────────────────────────────── */}
        <TabsContent value="knowledge" className="mt-6">
          <KnowledgeTab items={kbItems} loading={loadingKb} />
        </TabsContent>

        {/* ── Tab: Configuration ───────────────────────────────────────────── */}
        <TabsContent value="config" className="mt-6">
          <ConfigTab config={config!} onSave={(data) => updateConfig.mutate(data)} saving={updateConfig.isPending} />
        </TabsContent>

        {/* ── Tab: Historique ──────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-6">
          <HistoryTab conversations={conversations} loading={loadingConv} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── ChatTab ─────────────────────────────────────────────────────────────────

function ChatTab({ config }: { config: AssistantConfig | undefined }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await apiFetch("/api/assistant-ia/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, conversationId: convId, channel: "chat" }),
      }) as { conversationId: string; reply: string };
      setConvId(res.conversationId);
      setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Désolé, une erreur est survenue. Veuillez réessayer." }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setMessages([]); setConvId(null); setInput(""); };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="py-3 px-4 border-b flex-row items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">{config?.name ?? "Assistant IA"}</p>
              <p className="text-xs text-muted-foreground">Mode test — les conversations sont enregistrées</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <div className="p-4 bg-violet-50 rounded-full">
                  <Bot className="w-10 h-10 text-violet-500" />
                </div>
                <p className="font-medium">{config?.greetingMessage ?? `Bonjour ! Je suis ${config?.name ?? "votre assistant"}. Comment puis-je vous aider ?`}</p>
                <p className="text-sm text-muted-foreground">Posez votre première question ci-dessous</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>
          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Tapez votre message…"
              className="flex-1"
            />
            <Button onClick={send} disabled={loading || !input.trim()} size="sm" className="gap-1.5">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Suggestions de test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Quels sont vos services ?",
              "Je voudrais prendre un rendez-vous",
              "Quels sont vos horaires ?",
              "J'ai un problème avec ma commande",
              "Comment puis-je vous contacter ?",
              "Pouvez-vous m'aider à faire un devis ?",
            ].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                {s}
              </button>
            ))}
          </CardContent>
        </Card>
        {!config?.isActive && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-700">L'assistant est actuellement inactif. Activez-le depuis l'en-tête pour qu'il réponde à vos clients.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── KnowledgeTab ─────────────────────────────────────────────────────────────

function KnowledgeTab({ items, loading }: { items: KbItem[]; loading: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KbItem | null>(null);
  const [form, setForm] = useState({ title: "", content: "", type: "faq", category: "" });

  const createItem = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/api/assistant-ia/knowledge", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-ia-knowledge"] });
      qc.invalidateQueries({ queryKey: ["assistant-ia-stats"] });
      setOpen(false);
      setForm({ title: "", content: "", type: "faq", category: "" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KbItem> }) =>
      apiFetch(`/api/assistant-ia/knowledge/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-ia-knowledge"] });
      setOpen(false); setEditing(null);
    },
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/assistant-ia/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-ia-knowledge"] });
      qc.invalidateQueries({ queryKey: ["assistant-ia-stats"] });
    },
  });
  const toggleItem = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/assistant-ia/knowledge/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-ia-knowledge"] }),
  });

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  const openAdd = () => { setEditing(null); setForm({ title: "", content: "", type: "faq", category: "" }); setOpen(true); };
  const openEdit = (item: KbItem) => {
    setEditing(item);
    setForm({ title: item.title, content: item.content, type: item.type, category: item.category ?? "" });
    setOpen(true);
  };
  const submit = () => {
    if (!form.title || !form.content) return;
    if (editing) updateItem.mutate({ id: editing.id, data: form });
    else createItem.mutate(form);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["all", "faq", "document", "info", "procedure", "policy"].map((t) => (
            <Button key={t} size="sm" variant={filter === t ? "default" : "outline"}
              onClick={() => setFilter(t)} className="h-7 text-xs">
              {t === "all" ? "Tout" : TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" />Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Book className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">Aucune entrée dans la base de connaissance</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Ajoutez des FAQ, procédures et informations pour améliorer les réponses de votre assistant</p>
            <Button size="sm" onClick={openAdd} className="mt-4 gap-1.5"><Plus className="w-4 h-4" />Ajouter une entrée</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-start gap-4">
                <Switch checked={item.isActive} onCheckedChange={(v) => toggleItem.mutate({ id: item.id, isActive: v })} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs border-0 ${TYPE_COLORS[item.type] ?? ""}`}>{TYPE_LABELS[item.type] ?? item.type}</Badge>
                    {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                  </div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'entrée" : "Nouvelle entrée"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie (optionnel)</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="ex: Horaires" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Titre / Question</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex: Quels sont vos horaires d'ouverture ?" />
            </div>
            <div className="space-y-1.5">
              <Label>Contenu / Réponse</Label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Rédigez la réponse complète…" rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={createItem.isPending || updateItem.isPending}>
              {(createItem.isPending || updateItem.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ConfigTab ───────────────────────────────────────────────────────────────

function ConfigTab({ config, onSave, saving }: {
  config: AssistantConfig;
  onSave: (data: Partial<AssistantConfig>) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<AssistantConfig>>({ ...config });
  useEffect(() => { setForm({ ...config }); }, [config]);

  const f = (key: keyof AssistantConfig, value: unknown) => setForm((p) => ({ ...p, [key]: value }));
  const save = () => {
    onSave(form);
    toast({ title: "Configuration sauvegardée" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité de l'assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom de l'assistant</Label>
              <Input value={form.name ?? ""} onChange={(e) => f("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => f("description", e.target.value)} rows={2} placeholder="Description courte de votre assistant…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Langue principale</Label>
                <Select value={form.language ?? "fr"} onValueChange={(v) => f("language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">Anglais</SelectItem>
                    <SelectItem value="es">Espagnol</SelectItem>
                    <SelectItem value="pt">Portugais</SelectItem>
                    <SelectItem value="ar">Arabe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Niveau de formalité</Label>
                <Select value={form.formalityLevel ?? "formal"} onValueChange={(v) => f("formalityLevel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formel</SelectItem>
                    <SelectItem value="neutral">Neutre</SelectItem>
                    <SelectItem value="casual">Décontracté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Genre de voix</Label>
                <Select value={form.voiceGender ?? "female"} onValueChange={(v) => f("voiceGender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Féminine</SelectItem>
                    <SelectItem value="male">Masculine</SelectItem>
                    <SelectItem value="neutral">Neutre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Style de voix</Label>
                <Select value={form.voiceStyle ?? "professional"} onValueChange={(v) => f("voiceStyle", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professionnel</SelectItem>
                    <SelectItem value="warm">Chaleureux</SelectItem>
                    <SelectItem value="dynamic">Dynamique</SelectItem>
                    <SelectItem value="institutional">Institutionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages automatiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Message d'accueil</Label>
              <Textarea value={form.greetingMessage ?? ""} onChange={(e) => f("greetingMessage", e.target.value)} rows={3} placeholder="Bonjour ! Comment puis-je vous aider ?" />
            </div>
            <div className="space-y-1.5">
              <Label>Message hors horaires</Label>
              <Textarea value={form.offHoursMessage ?? ""} onChange={(e) => f("offHoursMessage", e.target.value)} rows={3} placeholder="Nos bureaux sont fermés. Laissez un message…" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissions et capacités</CardTitle>
            <CardDescription>Ce que votre assistant peut faire automatiquement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              ["allowAppointmentBooking", "Prise de rendez-vous", "L'assistant peut proposer et confirmer des rendez-vous"],
              ["allowTicketCreation", "Création de tickets", "L'assistant peut créer des tickets de support"],
              ["allowLeadCreation", "Enregistrement de leads", "L'assistant peut qualifier et enregistrer des prospects"],
            ] as const).map(([key, label, desc]) => (
              <div key={key} className="flex items-start gap-3">
                <Switch
                  checked={Boolean(form[key])}
                  onCheckedChange={(v) => f(key, v)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
            <div className="space-y-1.5 pt-2 border-t">
              <Label>Longueur max des réponses (mots)</Label>
              <Input
                type="number"
                value={form.maxResponseLength ?? 500}
                onChange={(e) => f("maxResponseLength", Number(e.target.value))}
                min={50} max={2000}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paramètres avancés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Numéro de téléphone (optionnel)</Label>
              <Input value={form.phoneNumber ?? ""} onChange={(e) => f("phoneNumber", e.target.value)} placeholder="+228 90 00 00 00" />
              <p className="text-xs text-muted-foreground">Nécessite l'add-on Assistant IA Pro pour les appels entrants</p>
            </div>
            <div className="space-y-1.5">
              <Label>Instructions supplémentaires pour l'IA</Label>
              <Textarea
                value={form.systemPromptExtra ?? ""}
                onChange={(e) => f("systemPromptExtra", e.target.value)}
                rows={4}
                placeholder="Ajoutez des règles ou contextes spécifiques à votre organisation…"
              />
              <p className="text-xs text-muted-foreground">Ces instructions sont ajoutées au prompt système de l'assistant</p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Sauvegarder la configuration
        </Button>
      </div>
    </div>
  );
}

// ─── HistoryTab ──────────────────────────────────────────────────────────────

function HistoryTab({ conversations, loading }: { conversations: Conversation[]; loading: boolean }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: detail } = useQuery<ConversationDetail>({
    queryKey: ["assistant-ia-conv", expanded],
    queryFn: () => apiFetch(`/api/assistant-ia/conversations/${expanded}`),
    enabled: !!expanded,
  });
  const deleteConv = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/assistant-ia/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-ia-conversations"] });
      qc.invalidateQueries({ queryKey: ["assistant-ia-stats"] });
      setExpanded(null);
    },
  });

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (conversations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <History className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">Aucune conversation enregistrée</p>
          <p className="text-sm text-muted-foreground/70 mt-1">L'historique apparaîtra ici après les premières interactions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const ChanIcon = CHANNEL_ICON[conv.channel] ?? MessageSquare;
        const isOpen = expanded === conv.id;
        return (
          <Card key={conv.id}>
            <CardContent className="p-0">
              <button
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : conv.id)}
              >
                <div className="p-2 bg-muted rounded-lg shrink-0">
                  <ChanIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{conv.clientName ?? "Client anonyme"}</p>
                    <Badge className={`text-xs border-0 ${STATUS_COLORS[conv.status] ?? ""}`}>
                      {STATUS_LABELS[conv.status] ?? conv.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmt(conv.createdAt)} · {conv.messageCount} messages · Canal : {conv.channel}</p>
                  {conv.actionTaken && <p className="text-xs text-violet-600 mt-0.5">Action : {conv.actionTaken.replace("_", " ")}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteConv.mutate(conv.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {isOpen && detail?.messages && (
                <div className="border-t p-4 space-y-3 bg-muted/20">
                  {detail.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-violet-600 text-white rounded-br-sm"
                          : "bg-card border rounded-bl-sm"
                      }`}>
                        <p>{m.content}</p>
                        <p className={`text-xs mt-0.5 ${m.role === "user" ? "text-violet-200" : "text-muted-foreground"}`}>
                          {fmt(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
