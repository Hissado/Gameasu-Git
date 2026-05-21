import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ShieldCheck, KeySquare, Users2, Building2, MailCheck, ClipboardList, Settings as SettingsIcon, Lock, Database, Loader2,
} from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const TILES = [
  { perm: "users.invite", to: "/admin/users", icon: Users2, title: "Utilisateurs", desc: "Inviter, modifier, désactiver" },
  { perm: "users.invite", to: "/admin/invitations", icon: MailCheck, title: "Invitations", desc: "Suivi, relance, copie de lien" },
  { perm: "roles.read", to: "/admin/roles", icon: ShieldCheck, title: "Rôles", desc: "Créer / éditer la matrice de droits" },
  { perm: "roles.read", to: "/admin/permissions", icon: KeySquare, title: "Catalogue de permissions", desc: "Référentiel des droits disponibles" },
  { perm: "departments.read", to: "/admin/departments", icon: Building2, title: "Départements", desc: "Pôles, hiérarchie, responsables" },
  { perm: "audit.read", to: "/admin/audit", icon: ClipboardList, title: "Journal d'audit", desc: "Traces des actions sensibles" },
  { perm: "settings.read", to: "/settings", icon: SettingsIcon, title: "Paramètres", desc: "Configuration globale" },
] as const;

export default function AdminHub() {
  const { has, isAdmin } = usePermissions();
  const { toast } = useToast();
  const [seeding, setSeeding] = React.useState(false);

  async function runSeed(force: boolean) {
    setSeeding(true);
    try {
      const url = `/api/admin/seed-demo${force ? "?force=true" : ""}`;
      const res = await apiFetch<{ skipped?: boolean; counts?: Record<string, number>; message?: string }>(url, { method: "POST", body: JSON.stringify({}) });
      if (res.skipped) {
        toast({ title: "Données déjà présentes", description: res.message ?? "Utilisez « Régénérer » pour réinitialiser." });
      } else {
        const total = Object.values(res.counts ?? {}).reduce((a, b) => a + b, 0);
        toast({ title: "Données de démo générées", description: `${total} enregistrements créés sur ${Object.keys(res.counts ?? {}).length} modules.` });
      }
    } catch (e: any) {
      toast({ title: "Échec de la génération", description: e?.message ?? "Erreur inconnue", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-1">Gouvernance · Sécurité · Configuration</p>
      </div>

      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <Lock className="w-5 h-5 text-amber-700" />
            <div className="text-sm text-amber-900">L'accès complet à l'administration nécessite un rôle administrateur.</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.filter(t => has(t.perm) || isAdmin).map((t) => (
          <Link key={t.to} href={t.to}>
            <Card className="cursor-pointer hover:shadow-lg hover:border-primary/40 transition group">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                    <t.icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{t.title}</CardTitle>
                </div>
                <CardDescription className="mt-2">{t.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Données de démonstration</CardTitle>
                <CardDescription className="mt-1">
                  Génère un jeu complet de données réalistes interconnectées : clients, engagements, projets, tâches, équipement, factures, écritures comptables, budgets, CRM, marketing, conversations, alertes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => runSeed(false)} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              Générer si absent
            </Button>
            <Button variant="outline" onClick={() => runSeed(true)} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Régénérer (réinitialise la démo)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
