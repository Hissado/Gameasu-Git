import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Client360Tab from "./Client360Tab";
import {
  Building2, Briefcase, FolderKanban, CheckSquare, FolderOpen,
  MessageSquare, Plus, ChevronLeft, ChevronRight, Mail, Phone, Globe,
  Repeat, Calendar, ChevronDown, MessageCircle,
} from "lucide-react";

function waLink(phone?: string, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  const url = `https://wa.me/${digits}`;
  return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}

type Client = { id: string; name: string; email?: string; phone?: string; website?: string; industry?: string; address?: string; status: string };
type Engagement = { id: string; name: string; isRecurring: boolean; status: string; recurrencePattern?: any; clientName?: string };
type Project = { id: string; name: string; status: string; progress?: number };
type Task = { id: string; title: string; status: string; priority: string; serviceId?: string; projectId?: string; dueDate?: string };
type Document = { id: string; name: string; entityType?: string; entityId?: string; category?: string; createdAt: string; fileUrl: string };

export default function ClientDetailWorkspace() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id;

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["client", id], queryFn: () => apiFetch(`/api/clients/${id}`), enabled: !!id,
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
            title="Ouvrir une conversation WhatsApp"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Briefcase} label="Engagements" value={engagements?.data?.length ?? 0} />
        <StatCard icon={FolderKanban} label="Projets" value={projects?.data?.length ?? 0} />
        <StatCard icon={CheckSquare} label="Tâches" value={"—"} />
        <StatCard icon={FolderOpen} label="Documents" value={"—"} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="360" className="w-full">
        <TabsList>
          <TabsTrigger value="360">Vue 360°</TabsTrigger>
          <TabsTrigger value="tree">Arborescence</TabsTrigger>
          <TabsTrigger value="engagements">Services</TabsTrigger>
          <TabsTrigger value="projects">Projets</TabsTrigger>
          <TabsTrigger value="messaging">Messagerie</TabsTrigger>
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
            <Link key={p.id} href={`/projects/${p.id}`}>
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

        <TabsContent value="messaging" className="mt-4">
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Conversations liées à ce client.</p>
            <Link href={`/messaging?clientId=${client.id}`}><Button size="sm" variant="outline" className="mt-3">Ouvrir la messagerie</Button></Link>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
  const link = type === "service" ? `/services/${id}` : `/projects/${id}`;
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
