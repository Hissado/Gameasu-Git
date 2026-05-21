import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare, Phone, ShieldCheck, ShieldOff } from "lucide-react";

type Consent = { id: string; contactType: string; contactId: string; channel: string; optIn: boolean; source?: string; preferredLanguage?: string; updatedAt: string };
type Contact = { type: string; id: string; name: string; email: string | null; phone: string | null; company: string | null };

const channelIcon: Record<string, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  sms: <MessageSquare className="w-3 h-3" />,
  whatsapp: <Phone className="w-3 h-3" />,
};

export default function ConsentPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: consents } = useQuery<{ data: Consent[] }>({
    queryKey: ["marketing-consent"],
    queryFn: () => apiFetch("/api/marketing/consent"),
  });
  const { data: contacts } = useQuery<{ data: Contact[]; total: number }>({
    queryKey: ["marketing-contacts-all"],
    queryFn: () => apiFetch("/api/marketing/contacts?limit=500"),
  });

  // Index consent par (type:id:channel)
  const consentMap = useMemo(() => {
    const m = new Map<string, Consent>();
    for (const c of consents?.data ?? []) m.set(`${c.contactType}:${c.contactId}:${c.channel}`, c);
    return m;
  }, [consents]);

  const filtered = (contacts?.data || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q);
  }).slice(0, 200);

  const set = useMutation({
    mutationFn: (payload: { contactType: string; contactId: string; channel: string; optIn: boolean }) =>
      apiFetch("/api/marketing/consent", { method: "PUT", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-consent"] }),
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const stats = useMemo(() => {
    const all = consents?.data || [];
    return {
      total: all.length,
      optIn: all.filter((c) => c.optIn).length,
      optOut: all.filter((c) => !c.optIn).length,
      byChannel: ["email", "sms", "whatsapp"].map((ch) => ({
        channel: ch,
        optIn: all.filter((c) => c.channel === ch && c.optIn).length,
        optOut: all.filter((c) => c.channel === ch && !c.optIn).length,
      })),
    };
  }, [consents]);

  const getOptIn = (c: Contact, channel: string) => {
    const entry = consentMap.get(`${c.type}:${c.id}:${channel}`);
    return entry ? entry.optIn : true; // par défaut opt-in
  };

  return (
    <MarketingShell title="Consentement & préférences" subtitle="Opt-in / opt-out par contact et par canal — journal complet">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground font-bold">Entrées</div><div className="text-2xl font-bold mt-1">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground font-bold">Opt-in</div><div className="text-2xl font-bold mt-1 text-emerald-600">{stats.optIn}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground font-bold">Opt-out</div><div className="text-2xl font-bold mt-1 text-rose-600">{stats.optOut}</div></CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground font-bold mb-1">Par canal</div>
          <div className="space-y-0.5 text-xs">
            {stats.byChannel.map((c) => (
              <div key={c.channel} className="flex justify-between"><span className="capitalize">{c.channel}</span><span><span className="text-emerald-600 font-medium">{c.optIn}</span> · <span className="text-rose-600">{c.optOut}</span></span></div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-3">
          <Input placeholder="Rechercher un contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Type</th>
                <th className="text-center p-3">Email</th>
                <th className="text-center p-3">SMS</th>
                <th className="text-center p-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun contact.</td></tr>
                : filtered.map((c) => (
                  <tr key={`${c.type}:${c.id}`} className="border-b hover:bg-muted/20">
                    <td className="p-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.email || c.phone || "—"}</div></td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{c.type}</Badge></td>
                    {["email", "sms", "whatsapp"].map((ch) => {
                      const on = getOptIn(c, ch);
                      return (
                        <td key={ch} className="p-3 text-center">
                          <Button size="sm" variant={on ? "outline" : "ghost"}
                            onClick={() => set.mutate({ contactType: c.type, contactId: c.id, channel: ch, optIn: !on })}
                            className={on ? "text-emerald-600 border-emerald-200" : "text-rose-600"}>
                            {on ? <><ShieldCheck className="w-3 h-3 mr-1" /> Opt-in</> : <><ShieldOff className="w-3 h-3 mr-1" /> Opt-out</>}
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </MarketingShell>
  );
}
