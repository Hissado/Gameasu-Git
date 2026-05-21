import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Lock, ShieldCheck } from "lucide-react";

const PERMISSIONS = [
  { module: "Tableau de bord", actions: ["Consulter"] },
  { module: "Projets", actions: ["Consulter", "Créer", "Modifier", "Supprimer"] },
  { module: "Tâches", actions: ["Consulter", "Créer", "Modifier", "Assigner"] },
  { module: "Matériel & QR", actions: ["Consulter", "Créer", "Modifier", "Supprimer"] },
  { module: "Locations", actions: ["Consulter", "Créer", "Inspecter"] },
  { module: "Inspections", actions: ["Consulter", "Créer", "Litige"] },
  { module: "Commercial (Devis/Factures)", actions: ["Consulter", "Créer", "Approuver"] },
  { module: "Comptabilité OHADA", actions: ["Consulter", "Saisir", "Clôturer"] },
  { module: "Marketing & Prospects", actions: ["Consulter", "Lancer campagne"] },
  { module: "RH (Collaborateurs)", actions: ["Consulter", "Modifier", "Affecter"] },
  { module: "Documents", actions: ["Consulter", "Téléverser", "Supprimer"] },
  { module: "Utilisateurs & Rôles", actions: ["Consulter", "Inviter", "Modifier rôle"] },
];

const ROLES = [
  { key: "super_admin", label: "Super admin", color: "bg-red-100 text-red-800 border-red-300" },
  { key: "admin", label: "Administrateur", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "manager", label: "Responsable", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "commercial", label: "Commercial", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "technicien", label: "Technicien", color: "bg-slate-100 text-slate-800 border-slate-300" },
];

const RIGHTS: Record<string, Record<string, string[]>> = {
  super_admin: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer", "Approuver"],
    "Comptabilité OHADA": ["Consulter", "Saisir", "Clôturer"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Modifier", "Affecter"],
    "Documents": ["Consulter", "Téléverser", "Supprimer"],
    "Utilisateurs & Rôles": ["Consulter", "Inviter", "Modifier rôle"],
  },
  admin: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer", "Approuver"],
    "Comptabilité OHADA": ["Consulter", "Saisir", "Clôturer"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Modifier", "Affecter"],
    "Documents": ["Consulter", "Téléverser", "Supprimer"],
    "Utilisateurs & Rôles": ["Consulter", "Inviter", "Modifier rôle"],
  },
  manager: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Modifier"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer"],
    "Comptabilité OHADA": ["Consulter"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Affecter"],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": ["Consulter"],
  },
  commercial: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter", "Créer"],
    "Matériel & QR": ["Consulter"],
    "Locations": ["Consulter"],
    "Inspections": [],
    "Commercial (Devis/Factures)": ["Consulter", "Créer"],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": [],
  },
  technicien: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter", "Modifier"],
    "Matériel & QR": ["Consulter"],
    "Locations": ["Consulter", "Inspecter"],
    "Inspections": ["Consulter", "Créer"],
    "Commercial (Devis/Factures)": [],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": [],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": [],
  },
};

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdLoading, setPwdLoading] = useState(false);

  const submitPwd = async () => {
    if (pwd.next.length < 8) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "Minimum 8 caractères." });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast({ variant: "destructive", title: "Confirmation différente", description: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setPwdLoading(true);
    try {
      await apiFetch("/api/auth/password", { method: "PUT", body: { currentPassword: pwd.current, newPassword: pwd.next } });
      toast({ title: "Mot de passe mis à jour", description: "Votre mot de passe a été changé avec succès." });
      setPwd({ current: "", next: "", confirm: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Profil · Sécurité · Préférences · Gouvernance des accès</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="regional">Régionales</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="danger">Zone sensible</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>Mettez à jour vos coordonnées professionnelles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" defaultValue={user?.firstName || ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" defaultValue={user?.lastName || ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Adresse e-mail professionnelle</Label>
                <Input id="email" type="email" defaultValue={user?.email || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input id="phone" type="tel" placeholder="+237 6XX XXX XXX" />
              </div>
              <Button className="mt-2">Enregistrer les modifications</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Changer le mot de passe</CardTitle>
              <CardDescription>Choisissez un mot de passe d'au moins 8 caractères, distinct de l'actuel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="cur">Mot de passe actuel</Label>
                <Input id="cur" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new">Nouveau mot de passe</Label>
                <Input id="new" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conf">Confirmer le nouveau mot de passe</Label>
                <Input id="conf" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
              <Button onClick={submitPwd} disabled={pwdLoading || !pwd.current || !pwd.next || !pwd.confirm}>
                {pwdLoading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Préférences de notification</CardTitle>
              <CardDescription>Choisissez comment vous souhaitez être alerté.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Alertes par e-mail</Label>
                  <p className="text-sm text-muted-foreground">Recevez un récapitulatif quotidien de l'activité.</p>
                </div>
                <div className="h-6 w-11 bg-primary rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Notifications SMS</Label>
                  <p className="text-sm text-muted-foreground">Soyez alerté par SMS en cas d'incident urgent.</p>
                </div>
                <div className="h-6 w-11 bg-muted rounded-full relative"><div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Notifications navigateur</Label>
                  <p className="text-sm text-muted-foreground">Affichez les alertes en temps réel dans l'application.</p>
                </div>
                <div className="h-6 w-11 bg-primary rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regional" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Préférences régionales</CardTitle>
              <CardDescription>Langue, devise et fuseau horaire utilisés dans la plateforme.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Langue</p>
                <p className="font-medium">Français</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Devise</p>
                <p className="font-medium">Franc CFA (FCFA)</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Fuseau horaire</p>
                <p className="font-medium">Afrique/Douala (UTC+1)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Matrice des rôles & permissions</CardTitle>
              <CardDescription>Vue d'ensemble de ce que chaque rôle peut faire dans la plateforme. Édition réservée au super administrateur (à venir).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-5">
                {ROLES.map((r) => (
                  <Badge key={r.key} variant="outline" className={`${r.color} font-medium`}>{r.label}</Badge>
                ))}
              </div>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-xs uppercase">
                      <th className="text-left p-3 border-b font-semibold">Module</th>
                      {ROLES.map((r) => (
                        <th key={r.key} className="text-center p-3 border-b font-semibold whitespace-nowrap">{r.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p) => (
                      <tr key={p.module} className="hover:bg-muted/20">
                        <td className="p-3 border-b font-medium">
                          {p.module}
                          <div className="text-xs text-muted-foreground font-normal mt-0.5">{p.actions.join(" · ")}</div>
                        </td>
                        {ROLES.map((r) => {
                          const granted = RIGHTS[r.key]?.[p.module] || [];
                          const total = p.actions.length;
                          const count = granted.length;
                          const all = count === total;
                          const none = count === 0;
                          return (
                            <td key={r.key} className="text-center p-3 border-b">
                              {all ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="w-4 h-4" /> Tout
                                </span>
                              ) : none ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <X className="w-4 h-4" /> —
                                </span>
                              ) : (
                                <span className="text-xs text-amber-700 font-medium">{count}/{total}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Zone sensible</CardTitle>
              <CardDescription>Actions irréversibles sur votre compte.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive">Désactiver mon compte</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
