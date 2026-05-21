import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSquare2 } from "lucide-react";

type Contact = {
  type: "client" | "prospect" | "collaborator" | "user";
  id: string; name: string; company: string | null; email: string | null; phone: string | null;
  source: string | null; status: string; tags: string[]; language: string | null; createdAt: string;
};

const TYPE_COLOR: Record<string, string> = {
  client: "bg-emerald-100 text-emerald-700",
  prospect: "bg-blue-100 text-blue-700",
  collaborator: "bg-violet-100 text-violet-700",
  user: "bg-amber-100 text-amber-700",
};

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sources.length) params.set("sources", sources.join(","));
  if (requireEmail) params.set("requireEmail", "true");
  if (requirePhone) params.set("requirePhone", "true");

  const { data, isLoading } = useQuery<{ total: number; breakdown: Record<string, number>; data: Contact[] }>({
    queryKey: ["marketing-contacts", params.toString()],
    queryFn: () => apiFetch(`/api/marketing/contacts?${params.toString()}`),
  });

  const toggleSource = (s: string) => setSources((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  return (
    <MarketingShell title="Contacts marketing" subtitle="Vue unifiée : clients, prospects, collaborateurs et utilisateurs">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground font-bold uppercase">Total</div><div className="text-2xl font-bold mt-1">{data?.total ?? 0}</div></CardContent></Card>
        {Object.entries(data?.breakdown ?? {}).map(([k, v]) => (
          <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground font-bold uppercase capitalize">{k}s</div><div className="text-2xl font-bold mt-1">{v}</div></CardContent></Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs font-medium">Recherche</label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email, société…" /></div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Sources</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "clients", l: "Clients" },
                  { k: "prospects", l: "Prospects" },
                  { k: "collaborators", l: "Collaborateurs" },
                  { k: "users", l: "Utilisateurs" },
                ].map((s) => (
                  <button key={s.k} type="button" onClick={() => toggleSource(s.k)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${sources.includes(s.k) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={requireEmail} onChange={(e) => setRequireEmail(e.target.checked)} /> Email présent</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} /> Téléphone présent</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Société</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Téléphone</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun contact ne correspond.</td></tr>
                : data!.data.map((c) => (
                  <tr key={`${c.type}:${c.id}`} className="border-b hover:bg-muted/20">
                    <td className="p-3"><div className="font-medium flex items-center gap-2"><UserSquare2 className="w-4 h-4 text-muted-foreground" /> {c.name}</div></td>
                    <td className="p-3"><Badge className={`${TYPE_COLOR[c.type]} border-0 capitalize`}>{c.type}</Badge></td>
                    <td className="p-3 text-xs">{c.company || "—"}</td>
                    <td className="p-3 text-xs">{c.email || "—"}</td>
                    <td className="p-3 text-xs">{c.phone || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.source || "—"}</td>
                    <td className="p-3 text-xs"><Badge variant="outline" className="capitalize">{c.status}</Badge></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </MarketingShell>
  );
}
