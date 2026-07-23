import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Lock, AlertTriangle, Shield, Target, TrendingUp,
  UsersRound, Truck, Megaphone, BarChart3, ChevronDown, ChevronRight,
  Layers, Loader2, X,
} from "lucide-react";
import { useOrganizationModules, useToggleModule } from "@/lib/saas";
import { useToast } from "@/hooks/use-toast";

type ModuleGroupDef = {
  id: string; label: string; description: string;
  colorCls: string; bgCls: string; borderCls: string; dotCls: string;
  icon: React.ReactNode;
  modules: Array<{
    key: string; name: string; description: string;
    protected?: boolean;
    subModules?: string[];
    impactOnDisable?: string[];
  }>;
};

const MODULE_GROUPS: ModuleGroupDef[] = [
  {
    id: "essentials", label: "Modules essentiels", description: "Fondamentaux au fonctionnement de Gameasu — toujours actifs.",
    colorCls: "text-foreground", bgCls: "bg-muted/50", borderCls: "border", dotCls: "bg-slate-500",
    icon: <Shield className="w-4 h-4" />,
    modules: [
      { key: "dashboard",            name: "Tableau de bord",          description: "KPI exécutifs, graphiques, alertes et vue d'ensemble.", protected: true, subModules: ["Vue d'ensemble", "Briefing du jour", "Intelligence IA", "Approbations"] },
      { key: "administration",       name: "Administration",            description: "Gestion des utilisateurs, invitations et audit des accès.", protected: true, subModules: ["Utilisateurs", "Invitations", "Audit", "RBAC"] },
      { key: "workspace_settings",   name: "Paramètres",               description: "Configuration de l'espace de travail, marque et préférences.", protected: true, subModules: ["Profil organisation", "Rôles & permissions", "Intégrations", "Pointage"] },
      { key: "billing_subscription", name: "Abonnement & facturation", description: "Formule active, modules inclus et historique de facturation.", protected: true, subModules: ["Formule", "Facturation", "Usage"] },
    ],
  },
  {
    id: "sales", label: "Ventes & Commercial", description: "Relation client, pipeline commercial et facturation.",
    colorCls: "text-blue-700", bgCls: "bg-blue-50", borderCls: "border-blue-200", dotCls: "bg-blue-500",
    icon: <Target className="w-4 h-4" />,
    modules: [
      { key: "clients",   name: "Clients & CRM",         description: "Annuaire clients, fiches 360°, historique et encours de crédit.", subModules: ["Annuaire", "Fiches 360°", "Opportunités CRM", "Activités", "Bons de commande", "Devis", "Factures", "Paiements"], impactOnDisable: ["Menu Clients masqué", "Pipeline commercial inaccessible", "Devis et factures masqués", "Rapports commerciaux indisponibles", "KPI commerciaux masqués dans le tableau de bord"] },
      { key: "sales_crm", name: "Pipeline & CRM avancé", description: "Kanban pipeline, opportunités, activités et suivi commercial.", subModules: ["Pipeline Kanban", "Opportunités", "Activités", "Campagnes CRM"], impactOnDisable: ["Menu CRM masqué", "Pipeline commercial inaccessible", "Rapports ventes indisponibles"] },
      { key: "services",  name: "Services & Catalogue",  description: "Catalogue de prestations, tarifs et conditions contractuelles.", subModules: ["Catalogue prestations", "Tarifs", "Contrats cadre"], impactOnDisable: ["Menu Services masqué", "Catalogue de prestations inaccessible"] },
    ],
  },
  {
    id: "finance", label: "Finance & Comptabilité", description: "Comptabilité SYSCOHADA, trésorerie et planification financière.",
    colorCls: "text-emerald-700", bgCls: "bg-emerald-50", borderCls: "border-emerald-200", dotCls: "bg-emerald-500",
    icon: <TrendingUp className="w-4 h-4" />,
    modules: [
      { key: "accounting",         name: "Comptabilité SYSCOHADA",    description: "Plan comptable, journaux, grand livre, trésorerie, TVA et clôtures.", subModules: ["Plan de comptes", "Journaux", "Grand livre", "Trésorerie", "Taxes & TVA", "Clôtures", "Comptabilité analytique", "Rapprochements"], impactOnDisable: ["Menu Comptabilité masqué", "Journaux inaccessibles", "KPI trésorerie masqués", "Exports comptables désactivés", "Rapports financiers indisponibles"] },
      { key: "financial_planning", name: "Budgets & Prévisions FP&A", description: "Budgets versionnés, forecast, analyse de variance et projections fin d'année.", subModules: ["Budgets", "Forecast", "Analyse de variance", "Synthèse projets", "Exports Excel FCFA"], impactOnDisable: ["Menu FP&A masqué", "Budgets inaccessibles", "KPI prévisions masqués dans le tableau de bord"] },
    ],
  },
  {
    id: "hr", label: "Équipe & Ressources Humaines", description: "Collaborateurs, contrats, congés, présences et paie.",
    colorCls: "text-violet-700", bgCls: "bg-violet-50", borderCls: "border-violet-200", dotCls: "bg-violet-500",
    icon: <UsersRound className="w-4 h-4" />,
    modules: [
      { key: "team_hr",        name: "Ressources Humaines",   description: "Collaborateurs, contrats, congés, présences, kiosk de pointage et paie.", subModules: ["Collaborateurs", "Contrats", "Congés", "Présences & Kiosk", "Badge QR", "Paie", "Formation", "Avantages sociaux", "Simulateur RH", "Rapports RH"], impactOnDisable: ["Menu RH masqué", "Collaborateurs inaccessibles", "Kiosk de pointage désactivé", "Paie indisponible", "Rapports RH masqués", "KPI effectifs masqués dans le tableau de bord"] },
      { key: "communications", name: "Communications", description: "Messagerie interne DM/groupes, appels et notifications temps réel.", subModules: ["Messagerie", "Groupes", "Appels", "Présence temps réel"], impactOnDisable: ["Messagerie masquée", "Appels désactivés", "Notifications temps réel coupées"] },
    ],
  },
  {
    id: "operations", label: "Opérations & Logistique", description: "Projets, tâches, équipements, stock, locations et opérations terrain.",
    colorCls: "text-amber-700", bgCls: "bg-amber-50", borderCls: "border-amber-200", dotCls: "bg-amber-500",
    icon: <Truck className="w-4 h-4" />,
    modules: [
      { key: "projects",           name: "Projets & Tâches",        description: "Gestion de projets avec phases, tâches, Gantt et suivi budgétaire.", subModules: ["Projets", "Phases", "Tâches", "Gantt", "Portfolio", "Budget projet"], impactOnDisable: ["Projets masqués", "Tâches inaccessibles", "Gantt désactivé", "KPI projets masqués"] },
      { key: "operations",         name: "Opérations & Logistique", description: "Opérations terrain, livraisons, tournées et planification.", subModules: ["Logistique", "Livraisons", "Tournées", "Planification"], impactOnDisable: ["Menu Opérations masqué", "Suivi logistique inaccessible"] },
      { key: "inventory_assets",   name: "Parc & Équipements",      description: "Inventaire matériel, disponibilité, catégories et suivi QR.", subModules: ["Équipements", "Catégories", "QR Codes", "Disponibilité", "Maintenance"], impactOnDisable: ["Menu Équipements masqué", "Inventaire matériel inaccessible"] },
      { key: "inventory_products", name: "Stock & Produits",         description: "Gestion des stocks, mouvements, valorisation et alertes de rupture.", subModules: ["Produits", "Mouvements de stock", "Valorisation", "Alertes rupture"], impactOnDisable: ["Menu Stock masqué", "Produits et stocks inaccessibles"] },
      { key: "rentals",            name: "Locations & Inspections",  description: "Dossiers de location, pré/post inspections et logistique de retour.", subModules: ["Dossiers location", "Inspections", "Livraisons/Retours", "Planning"], impactOnDisable: ["Menu Locations masqué", "Dossiers de location inaccessibles", "Inspections désactivées"] },
    ],
  },
  {
    id: "growth", label: "Marketing & Croissance", description: "Campagnes marketing, portail client et fidélisation.",
    colorCls: "text-rose-700", bgCls: "bg-rose-50", borderCls: "border-rose-200", dotCls: "bg-rose-500",
    icon: <Megaphone className="w-4 h-4" />,
    modules: [
      { key: "marketing",     name: "Marketing",      description: "Campagnes, audiences segmentées, formulaires, automatisations et analytics.", subModules: ["Campagnes", "Audiences", "Contacts marketing", "Prospects", "Formulaires", "Automatisations", "Analytics"], impactOnDisable: ["Menu Marketing masqué", "Campagnes inaccessibles", "Formulaires désactivés"] },
      { key: "client_portal", name: "Portail client", description: "Espace en ligne dédié à vos clients pour consulter devis et documents.", subModules: ["Accès client", "Documents partagés", "Devis en ligne", "Factures clients"], impactOnDisable: ["Portail client désactivé", "Accès client coupé"] },
    ],
  },
  {
    id: "intelligence", label: "Rapports & Documents", description: "Analyses avancées et gestion documentaire centralisée.",
    colorCls: "text-indigo-700", bgCls: "bg-indigo-50", borderCls: "border-indigo-200", dotCls: "bg-indigo-500",
    icon: <BarChart3 className="w-4 h-4" />,
    modules: [
      { key: "reports",   name: "Rapports & Analyses", description: "Tableaux de bord analytiques, KPI cross-modules, carte et exports.", subModules: ["Rapports ventes", "Rapports RH", "Rapports financiers", "Carte géo", "Exports"], impactOnDisable: ["Menu Rapports masqué", "Exports désactivés", "Analytique indisponible"] },
      { key: "documents", name: "Documents & GED",     description: "Gestion électronique, stockage centralisé, modèles et signatures.", subModules: ["Fichiers", "Modèles", "Partage sécurisé", "Signatures"], impactOnDisable: ["Menu Documents masqué", "GED inaccessible", "Modèles désactivés"] },
    ],
  },
];

export function ModulesActifsTab() {
  const { toast } = useToast();
  const { data: modules = [], isLoading } = useOrganizationModules();
  const toggleModule = useToggleModule();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["sales", "finance", "hr", "operations"])
  );
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ moduleKey: string; name: string; impacts: string[] } | null>(null);

  const modMap = new Map(modules.map((m) => [m.moduleKey, m]));

  const toggleGroup = (id: string) => setExpandedGroups((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleMod = (key: string) => setExpandedMods((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const handleToggle = (modDef: ModuleGroupDef["modules"][0], enabled: boolean) => {
    if (modDef.protected) return;
    if (!enabled) {
      setConfirm({ moduleKey: modDef.key, name: modDef.name, impacts: modDef.impactOnDisable ?? [] });
      return;
    }
    toggleModule.mutate({ moduleKey: modDef.key, enabled: true }, {
      onSuccess: () => toast({ title: `${modDef.name} activé` }),
      onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
    });
  };

  const confirmDisable = () => {
    if (!confirm) return;
    toggleModule.mutate({ moduleKey: confirm.moduleKey, enabled: false }, {
      onSuccess: () => { toast({ title: `${confirm.name} désactivé` }); setConfirm(null); },
      onError: (e: any) => { toast({ variant: "destructive", title: "Erreur", description: e.message }); setConfirm(null); },
    });
  };

  const enabledCount = modules.filter((m) => m.enabled).length;
  const totalCount = modules.length;

  return (
    <div className="space-y-5">
      {/* En-tête récapitulatif */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Modules actifs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Activez ou désactivez les fonctionnalités disponibles pour votre organisation.
            Les modules désactivés masquent le menu, les permissions et les données associées.
          </p>
        </div>
        {!isLoading && totalCount > 0 && (
          <Badge variant="outline" className="text-sm font-medium px-3 py-1.5 bg-primary/5 border-primary/20 text-primary">
            {enabledCount} / {totalCount} modules actifs
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement des modules…
        </div>
      ) : (
        <div className="space-y-3">
          {MODULE_GROUPS.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const groupMods = group.modules;
            const activeInGroup = groupMods.filter((m) => modMap.get(m.key)?.enabled ?? m.protected).length;

            return (
              <Card key={group.id} className={`border ${group.borderCls} overflow-hidden`}>
                {/* Header du groupe — cliquable */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between p-4 ${group.bgCls} hover:opacity-90 transition-opacity text-left`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${group.colorCls} p-1.5 rounded-md bg-card/60 border border-white/80`}>
                      {group.icon}
                    </span>
                    <div>
                      <p className={`font-semibold text-sm ${group.colorCls}`}>{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant="outline" className={`text-xs font-medium ${group.bgCls} ${group.borderCls} ${group.colorCls}`}>
                      {activeInGroup}/{groupMods.length}
                    </Badge>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Modules du groupe */}
                {isExpanded && (
                  <div className="divide-y divide-border">
                    {groupMods.map((modDef) => {
                      const orgMod = modMap.get(modDef.key);
                      const isEnabled = orgMod?.enabled ?? modDef.protected ?? false;
                      const isProtected = modDef.protected;
                      const isSubExpanded = expandedMods.has(modDef.key);

                      return (
                        <div key={modDef.key} className="bg-card">
                          <div className="flex items-start gap-4 p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{modDef.name}</span>
                                {isProtected && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground border bg-muted/50 gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Système
                                  </Badge>
                                )}
                                {isEnabled && !isProtected && (
                                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 border">Actif</Badge>
                                )}
                                {!isEnabled && !isProtected && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground/60 border">Inactif</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{modDef.description}</p>

                              {/* Sous-modules */}
                              {modDef.subModules && modDef.subModules.length > 0 && (
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleMod(modDef.key)}
                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Layers className="w-3 h-3" />
                                    {isSubExpanded ? "Masquer" : "Voir"} les sous-modules ({modDef.subModules.length})
                                    {isSubExpanded
                                      ? <ChevronDown className="w-2.5 h-2.5" />
                                      : <ChevronRight className="w-2.5 h-2.5" />}
                                  </button>
                                  {isSubExpanded && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {modDef.subModules.map((s) => (
                                        <span
                                          key={s}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                                            isEnabled
                                              ? `${group.bgCls} ${group.borderCls} ${group.colorCls}`
                                              : "bg-muted/50 border text-muted-foreground/60 line-through"
                                          }`}
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Toggle / Verrou */}
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              {isProtected ? (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Protégé</span>
                                </div>
                              ) : (
                                <Switch
                                  checked={isEnabled}
                                  disabled={toggleModule.isPending}
                                  onCheckedChange={(v) => handleToggle(modDef, v)}
                                />
                              )}
                            </div>
                          </div>

                          {/* Alerte impact si module désactivé */}
                          {!isEnabled && !isProtected && modDef.impactOnDisable && modDef.impactOnDisable.length > 0 && (
                            <div className="px-4 pb-3">
                              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                  <span className="font-medium">Module désactivé — </span>
                                  {modDef.impactOnDisable.slice(0, 2).join(" · ")}
                                  {modDef.impactOnDisable.length > 2 && (
                                    <span className="text-amber-600"> +{modDef.impactOnDisable.length - 2} impacts</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog confirmation désactivation */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Désactiver {confirm?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              La désactivation masque l'accès au module sans supprimer vos données. Vous pourrez le réactiver à tout moment.
            </p>
            {confirm && confirm.impacts.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Impacts immédiats</p>
                <ul className="space-y-1">
                  {confirm.impacts.map((imp) => (
                    <li key={imp} className="flex items-start gap-1.5 text-xs text-amber-800">
                      <X className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />{imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={toggleModule.isPending}
              className="gap-1"
            >
              {toggleModule.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <X className="w-4 h-4" />}
              Confirmer la désactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
