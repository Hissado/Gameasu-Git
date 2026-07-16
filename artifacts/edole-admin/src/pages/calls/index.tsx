import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListCallSessions, useListConversations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Search, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCallCenter } from "@/components/CallCenter";

const STATUS_META: Record<string, { label: string; cls: string; Icon: any }> = {
  active:    { label: "En cours",  cls: "text-emerald-600 bg-emerald-50 border-emerald-200", Icon: PhoneCall },
  ringing:   { label: "Sonnerie",  cls: "text-amber-700 bg-amber-50 border-amber-200",       Icon: PhoneCall },
  completed: { label: "Terminé",   cls: "text-muted-foreground bg-muted/50 border",       Icon: PhoneCall },
  missed:    { label: "Manqué",    cls: "text-red-600 bg-red-50 border-red-200",             Icon: PhoneMissed },
  declined:  { label: "Refusé",    cls: "text-red-600 bg-red-50 border-red-200",             Icon: PhoneMissed },
  ended:     { label: "Terminé",   cls: "text-muted-foreground bg-muted/50 border",       Icon: PhoneCall },
};

function formatDuration(s?: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}min ${r.toString().padStart(2, "0")}s`;
}

function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function CallsList() {
  const { user } = useAuth();
  const { data, isLoading } = useListCallSessions();
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const calls = data?.data || [];
  const filtered = useMemo(() => {
    if (!search) return calls;
    const q = search.toLowerCase();
    return calls.filter((c: any) => (c.initiatorName || "").toLowerCase().includes(q));
  }, [calls, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appels</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Button onClick={() => setPickerOpen(true)} className="bg-primary hover:bg-primary/90">
            <PhoneCall className="w-4 h-4 mr-2" />
            Nouvel appel
          </Button>
        </div>
      </div>

      <Card className="border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <div className="text-base font-medium text-foreground">Aucun appel</div>
              <div className="text-sm text-muted-foreground mt-1">Démarrez votre premier appel depuis une conversation.</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((call: any) => {
                const st = STATUS_META[call.status] || STATUS_META.completed;
                const isMine = call.initiatorId === user?.id;
                const Icon = call.type === "video" ? Video : (isMine ? PhoneOutgoing : PhoneIncoming);
                const colorIcon = call.status === "missed" || call.status === "declined" ? "text-red-500" : isMine ? "text-blue-500" : "text-emerald-500";
                const initials = (call.initiatorName || "??").split(" ").map((s: string) => s[0]).slice(0, 2).join("");
                const date = new Date(call.createdAt);
                return (
                  <li key={call.id} className="px-4 sm:px-6 py-4 hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <Avatar className="w-11 h-11">
                          <AvatarImage src={call.initiatorAvatarUrl} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border flex items-center justify-center">
                          <Icon className={`w-3 h-3 ${colorIcon}`} />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-foreground truncate">{call.initiatorName || "—"}</div>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${st.cls}`}>
                            {st.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground bg-muted/50">
                            {call.type === "video" ? "Vidéo" : call.type === "conference" ? "Conférence" : "Audio"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{relativeTime(date)}</span>
                          <span>·</span>
                          <span>{date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                          <span>·</span>
                          <span className="font-mono">{formatDuration(call.durationSeconds)}</span>
                        </div>
                      </div>
                      {call.conversationId && (
                        <Link href={`/messaging?c=${call.conversationId}`}>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <CallPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

function CallPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const callCenter = useCallCenter();
  const { user } = useAuth();
  const { data } = useListConversations();
  const [search, setSearch] = useState("");

  const convs = (data?.data || []).filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if ((c.title || "").toLowerCase().includes(q)) return true;
    return (c.participants || []).some((p: any) => (p.name || "").toLowerCase().includes(q));
  });

  function getOther(c: any) {
    if (c.type !== "direct") return null;
    return (c.participants || []).find((p: any) => p.userId !== user?.id) || null;
  }

  async function call(c: any, type: "audio" | "video") {
    const other = getOther(c);
    const peerName = other?.name || c.title || "Conversation";
    const peerAvatarUrl = other?.avatarUrl || null;
    onOpenChange(false);
    await callCenter.startCall({ conversationId: c.id, type, peerName, peerAvatarUrl });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>Démarrer un appel</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher une conversation…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {convs.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">Aucune conversation.</li>
          ) : convs.map((c: any) => {
            const other = getOther(c);
            const name = other?.name || c.title || "Conversation";
            const initials = name.split(" ").map((s: string) => s[0]).slice(0, 2).join("");
            return (
              <li key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={other?.avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.type === "direct" ? "Conversation directe" : `${(c.participants || []).length} participants`}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => call(c, "audio")} className="text-muted-foreground hover:text-primary">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => call(c, "video")} className="text-muted-foreground hover:text-primary">
                  <Video className="w-4 h-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
