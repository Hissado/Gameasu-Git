import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Plus, Trash2, Lock, Users, Copy,
  LayoutDashboard, TrendingUp, ShoppingCart, Landmark, Package,
  Wrench, FolderKanban, UsersRound, Clock, Truck, FolderOpen,
  MessageSquare, Megaphone, BarChart3, Brain, Shield, Settings,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle,
  Sparkles, Eye, PencilLine, Download, Upload, CheckSquare, Banknote, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = { id: string; code: string; name: string; description?: string; isSystem: boolean; level?: number; permissionsCount: number; usersCount: number };
type Perm = { id: string; code: string; label: string; category: string };

// ── Structure hiérarchique des modules ──────────────────────────────────────

type PermItem = { code: string; label: string; icon?: React.ComponentType<{ className?: string }> };
type PermGroup = { label: string; icon?: React.ComponentType<{ className?: string }>; perms: PermItem[] };
type ModuleDef = {
  id: string; label: string; description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; border: string;
  groups: PermGroup[];
};

const MODULE_DEFS: ModuleDef[] = [
  {
    id: "dashboard", label: "Tableau de bord", description: "Indicateurs de performance et KPI",
    icon: LayoutDashboard, color: "text-foreground", bg: "bg-muted/50", border: "border",
    groups: [
      { label: "Consultation", icon: Eye, perms: [
        { code: "dashboard.view_financial_kpis", label: "Voir les KPI financiers" },
        { code: "dashboard.view_hr_kpis", label: "Voir les KPI RH" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "dashboard.export", label: "Exporter le tableau de bord" },
      ]},
    ],
  },
  {
    id: "crm_ventes", label: "CRM & Ventes", description: "Pipeline, clients, opportunités commerciales",
    icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200",
    groups: [
      { label: "Clients", icon: UsersRound, perms: [
        { code: "clients.read", label: "Voir les clients (filtrés)" },
        { code: "clients.read_all", label: "Voir TOUS les clients" },
        { code: "clients.create", label: "Créer un client" },
        { code: "clients.update", label: "Modifier un client" },
        { code: "clients.delete", label: "Supprimer un client" },
        { code: "clients.view_history", label: "Voir l'historique client" },
        { code: "clients.view_confidential", label: "Données confidentielles" },
        { code: "clients.export", label: "Exporter les clients" },
      ]},
      { label: "Pipeline CRM", icon: Target, perms: [
        { code: "commercial.read", label: "Voir le pipeline" },
        { code: "commercial.create", label: "Créer des opportunités" },
        { code: "commercial.update", label: "Modifier des opportunités" },
        { code: "commercial.delete", label: "Supprimer des opportunités" },
        { code: "commercial.export", label: "Exporter le pipeline" },
      ]},
      { label: "Scoring & Santé", icon: Brain, perms: [
        { code: "scoring.view_client_health", label: "Score de santé client" },
        { code: "scoring.view_project_risk", label: "Score de risque projet" },
        { code: "scoring.view_financial_forecasts", label: "Prévisions financières" },
      ]},
    ],
  },
  {
    id: "documents_ventes", label: "Devis, Commandes & Factures", description: "Cycle de vente et encaissements",
    icon: BarChart3, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",
    groups: [
      { label: "Devis & Commandes", icon: PencilLine, perms: [
        { code: "sales.create_quote", label: "Créer un devis / proforma" },
        { code: "sales.approve_quote", label: "Valider un devis" },
        { code: "sales.create_order", label: "Créer une commande" },
        { code: "sales.view_pricing", label: "Calculateur de prix" },
      ]},
      { label: "Facturation", icon: Banknote, perms: [
        { code: "sales.create_invoice", label: "Émettre une facture" },
        { code: "sales.cancel_invoice", label: "Annuler une facture" },
        { code: "sales.record_payment", label: "Enregistrer un encaissement" },
        { code: "sales.manage_credit_notes", label: "Gérer les avoirs" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "sales.export", label: "Exporter les documents commerciaux" },
      ]},
    ],
  },
  {
    id: "achats", label: "Achats", description: "Fournisseurs, bons de commande et dépenses",
    icon: ShoppingCart, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200",
    groups: [
      { label: "Consultation", icon: Eye, perms: [
        { code: "purchases.read", label: "Voir achats et fournisseurs" },
      ]},
      { label: "Saisie & Gestion", icon: PencilLine, perms: [
        { code: "purchases.write", label: "Créer / modifier des achats" },
        { code: "purchases.approve", label: "Approuver des factures fournisseurs" },
        { code: "purchases.pay", label: "Enregistrer des paiements" },
        { code: "purchases.manage", label: "Accès complet Achats" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "purchases.export", label: "Exporter les données achats" },
      ]},
    ],
  },
  {
    id: "finance", label: "Finance & Comptabilité", description: "Comptabilité, FP&A, trésorerie et reporting financier",
    icon: Landmark, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200",
    groups: [
      { label: "Comptabilité", icon: Eye, perms: [
        { code: "accounting.read", label: "Consulter la comptabilité" },
        { code: "accounting.manage", label: "Saisir des écritures" },
        { code: "accounting.approve_entries", label: "Valider des écritures" },
        { code: "accounting.manage_banks", label: "Gérer les comptes bancaires" },
        { code: "accounting.view_sensitive", label: "Données financières sensibles" },
      ]},
      { label: "FP&A & Budgets", icon: TrendingUp, perms: [
        { code: "fpa.read", label: "Voir les budgets et reportings" },
        { code: "fpa.manage", label: "Créer / modifier des budgets" },
        { code: "fpa.approve", label: "Approuver les budgets" },
      ]},
      { label: "Imports & Exports", icon: Upload, perms: [
        { code: "accounting.import", label: "Importer des écritures" },
        { code: "accounting.export", label: "Exporter les documents comptables" },
        { code: "fpa.export", label: "Exporter les budgets FP&A" },
      ]},
    ],
  },
  {
    id: "stock", label: "Stock & Inventaire", description: "Produits, mouvements de stock et entrepôts",
    icon: Package, color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200",
    groups: [
      { label: "Consultation & Gestion", icon: Eye, perms: [
        { code: "inventory.read", label: "Voir le stock et les mouvements" },
        { code: "inventory.manage", label: "Gérer les produits" },
        { code: "inventory.receive", label: "Réceptionner les commandes" },
        { code: "inventory.adjust", label: "Ajuster le stock manuellement" },
        { code: "inventory.manage_warehouses", label: "Gérer les entrepôts" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "inventory.export", label: "Exporter les données stock" },
      ]},
    ],
  },
  {
    id: "equipements", label: "Équipements & Locations", description: "Matériel, locations et inspections",
    icon: Wrench, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200",
    groups: [
      { label: "Consultation & Gestion", icon: Eye, perms: [
        { code: "equipment.read", label: "Voir le matériel" },
        { code: "equipment.manage", label: "Gérer le matériel" },
        { code: "equipment.manage_inspections", label: "Gérer les inspections" },
        { code: "equipment.manage_rentals", label: "Gérer les locations" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "equipment.export", label: "Exporter les données matériel" },
      ]},
    ],
  },
  {
    id: "projets", label: "Projets & Tâches", description: "Gestion de projets, tâches et documents",
    icon: FolderKanban, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200",
    groups: [
      { label: "Projets", icon: FolderOpen, perms: [
        { code: "projects.read", label: "Voir les projets (filtrés)" },
        { code: "projects.read_all", label: "Voir TOUS les projets" },
        { code: "projects.create", label: "Créer un projet" },
        { code: "projects.update", label: "Modifier un projet" },
        { code: "projects.delete", label: "Supprimer un projet" },
        { code: "projects.approve", label: "Approuver les étapes" },
        { code: "projects.manage_budget", label: "Gérer les budgets projet" },
        { code: "projects.export", label: "Exporter les données projets" },
      ]},
      { label: "Tâches", icon: CheckSquare, perms: [
        { code: "tasks.read", label: "Voir les tâches" },
        { code: "tasks.create", label: "Créer des tâches" },
        { code: "tasks.update", label: "Modifier des tâches" },
        { code: "tasks.delete", label: "Supprimer des tâches" },
      ]},
      { label: "Documents", icon: FolderOpen, perms: [
        { code: "documents.read", label: "Voir les documents" },
        { code: "documents.manage", label: "Téléverser / supprimer des documents" },
      ]},
    ],
  },
  {
    id: "rh", label: "Ressources Humaines", description: "Collaborateurs, contrats, congés et paie",
    icon: UsersRound, color: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200",
    groups: [
      { label: "Données RH", icon: Eye, perms: [
        { code: "hr.read", label: "Consulter les données RH" },
        { code: "hr.manage", label: "Gérer les données RH" },
        { code: "hr.view_sensitive", label: "Données sensibles (salaires, médical)" },
      ]},
      { label: "Paie & Salaires", icon: Banknote, perms: [
        { code: "hr.view_salary", label: "Voir les salaires" },
        { code: "hr.manage_payroll", label: "Gérer la paie et les bulletins" },
      ]},
      { label: "Congés & Contrats", icon: FolderOpen, perms: [
        { code: "hr.manage_leaves", label: "Gérer les congés et absences" },
        { code: "hr.manage_contracts", label: "Gérer les contrats de travail" },
      ]},
      { label: "Notes de frais", icon: Banknote, perms: [
        { code: "hr.manage_expenses", label: "Gérer les notes de frais" },
        { code: "hr.approve_expenses", label: "Approuver les notes de frais" },
      ]},
      { label: "Exports", icon: Upload, perms: [
        { code: "hr.export", label: "Exporter les données RH" },
      ]},
    ],
  },
  {
    id: "presences", label: "Présences & Pointage", description: "Suivi du temps, kiosk et anomalies",
    icon: Clock, color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200",
    groups: [
      { label: "Pointage", icon: Clock, perms: [
        { code: "attendance.clock", label: "Effectuer ses propres pointages" },
        { code: "attendance.view", label: "Voir les pointages" },
        { code: "attendance.manage", label: "Gérer les pointages" },
        { code: "attendance.view_anomalies", label: "Voir les anomalies" },
        { code: "attendance.manage_settings", label: "Configurer le module" },
      ]},
    ],
  },
  {
    id: "operations", label: "Opérations", description: "Missions terrain, dispatching et checklists",
    icon: Truck, color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
    groups: [
      { label: "Accès & Gestion", icon: Eye, perms: [
        { code: "operations.view", label: "Voir les missions" },
        { code: "operations.manage", label: "Gérer les missions" },
        { code: "operations.assign", label: "Affecter des responsables" },
        { code: "operations.dispatch", label: "Tableau de dispatching" },
        { code: "operations.checkin", label: "Check-in / check-out terrain" },
        { code: "operations.incidents", label: "Gérer les incidents" },
        { code: "operations.checklists", label: "Gérer les checklists" },
        { code: "operations.performance", label: "KPI opérationnels" },
        { code: "operations.export", label: "Exporter les données" },
      ]},
    ],
  },
  {
    id: "marketing", label: "Marketing", description: "Campagnes, audiences et analytics",
    icon: Megaphone, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200",
    groups: [
      { label: "Campagnes", icon: Megaphone, perms: [
        { code: "marketing.read", label: "Voir les campagnes" },
        { code: "marketing.manage", label: "Gérer les campagnes" },
      ]},
    ],
  },
  {
    id: "messagerie", label: "Messagerie", description: "Conversations et notifications temps réel",
    icon: MessageSquare, color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200",
    groups: [
      { label: "Messagerie", icon: MessageSquare, perms: [
        { code: "messaging.use", label: "Utiliser la messagerie" },
        { code: "messaging.moderate", label: "Modérer (épingler/supprimer)" },
      ]},
    ],
  },
  {
    id: "rapports", label: "Rapports & Exports", description: "Rapports analytiques, PDF et Excel",
    icon: BarChart3, color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200",
    groups: [
      { label: "Rapports", icon: BarChart3, perms: [
        { code: "reports.view", label: "Consulter les rapports" },
        { code: "reports.management", label: "Rapports de direction" },
        { code: "reports.export_pdf", label: "Exporter en PDF" },
        { code: "reports.export_excel", label: "Exporter en Excel" },
      ]},
    ],
  },
  {
    id: "intelligence", label: "Intelligence & IA", description: "Insights IA, automatisations et alertes",
    icon: Brain, color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200",
    groups: [
      { label: "Insights IA", icon: Brain, perms: [
        { code: "ai.view_insights", label: "Voir les insights IA" },
        { code: "ai.view_recommendations", label: "Voir les recommandations" },
        { code: "ai.view_risk_flags", label: "Voir les drapeaux de risque" },
      ]},
      { label: "Gestion IA", icon: Settings, perms: [
        { code: "ai.manage_predictive", label: "Fonctions prédictives" },
        { code: "ai.manage_reports", label: "Rapports intelligents" },
        { code: "ai.manage_translation", label: "Outils de traduction" },
        { code: "ai.manage_whatsapp", label: "Canaux WhatsApp" },
        { code: "automation.read", label: "Voir les automatisations" },
        { code: "automation.manage", label: "Gérer les automatisations" },
      ]},
    ],
  },
  {
    id: "administration", label: "Administration & Sécurité", description: "Utilisateurs, rôles, audit et paramètres",
    icon: Shield, color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200",
    groups: [
      { label: "Utilisateurs", icon: UsersRound, perms: [
        { code: "users.read", label: "Voir les utilisateurs" },
        { code: "users.create", label: "Créer un utilisateur" },
        { code: "users.update", label: "Modifier un utilisateur" },
        { code: "users.delete", label: "Désactiver un utilisateur" },
        { code: "users.invite", label: "Inviter un utilisateur" },
        { code: "users.assign_projects", label: "Gérer les accès projets" },
      ]},
      { label: "Rôles & Permissions", icon: Shield, perms: [
        { code: "roles.read", label: "Voir les rôles" },
        { code: "roles.manage", label: "Gérer les rôles" },
      ]},
      { label: "Audit & Paramètres", icon: Settings, perms: [
        { code: "admin.access", label: "Accéder au panneau admin" },
        { code: "audit.read", label: "Consulter le journal d'audit" },
        { code: "departments.read", label: "Voir les départements" },
        { code: "departments.manage", label: "Gérer les départements" },
        { code: "settings.read", label: "Voir les paramètres" },
        { code: "settings.manage", label: "Modifier les paramètres" },
        { code: "support.read", label: "Tickets support (lecture)" },
        { code: "support.manage", label: "Gérer les tickets support" },
      ]},
    ],
  },
];

// ── Templates de rôles prédéfinis ─────────────────────────────────────────────

type RoleTemplate = { id: string; name: string; description: string; permCodes: string[] };

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "direction",
    name: "Direction Générale",
    description: "Accès complet à toutes les données, rapports et KPI",
    permCodes: [
      "dashboard.view_financial_kpis","dashboard.view_hr_kpis","dashboard.export",
      "clients.read","clients.read_all","clients.view_history","clients.view_confidential","clients.export",
      "commercial.read","commercial.export","scoring.view_client_health","scoring.view_project_risk","scoring.view_financial_forecasts",
      "sales.create_invoice","sales.export",
      "accounting.read","accounting.view_sensitive","accounting.export","fpa.read","fpa.export",
      "projects.read","projects.read_all","projects.export","tasks.read",
      "hr.read","hr.view_salary","hr.view_sensitive",
      "inventory.read","equipment.read","operations.view","operations.performance",
      "reports.view","reports.management","reports.export_pdf","reports.export_excel",
      "ai.view_insights","ai.view_recommendations","ai.view_risk_flags",
      "users.read","departments.read","audit.read",
    ],
  },
  {
    id: "resp_finance",
    name: "Responsable Finance",
    description: "Comptabilité, FP&A, achats et reporting financier complet",
    permCodes: [
      "dashboard.view_financial_kpis","dashboard.export",
      "clients.read","clients.read_all","clients.export",
      "commercial.read",
      "sales.create_invoice","sales.cancel_invoice","sales.record_payment","sales.export",
      "accounting.read","accounting.manage","accounting.approve_entries","accounting.manage_banks","accounting.import","accounting.export","accounting.view_sensitive",
      "fpa.read","fpa.manage","fpa.approve","fpa.export",
      "purchases.read","purchases.write","purchases.approve","purchases.pay","purchases.export",
      "reports.view","reports.management","reports.export_pdf","reports.export_excel",
      "ai.view_insights","scoring.view_financial_forecasts",
      "users.read","departments.read","audit.read",
    ],
  },
  {
    id: "comptable",
    name: "Comptable",
    description: "Saisie comptable, rapprochement et exports",
    permCodes: [
      "clients.read","commercial.read",
      "sales.create_invoice","sales.record_payment","sales.export",
      "accounting.read","accounting.manage","accounting.approve_entries","accounting.export",
      "fpa.read","fpa.export",
      "purchases.read","purchases.write","purchases.pay","purchases.export",
      "reports.view","reports.export_pdf","reports.export_excel",
      "users.read","departments.read",
    ],
  },
  {
    id: "commercial",
    name: "Commercial",
    description: "CRM, clients, devis et commandes",
    permCodes: [
      "dashboard.view_financial_kpis",
      "clients.read","clients.create","clients.update","clients.view_history","clients.export",
      "commercial.read","commercial.create","commercial.update","commercial.export",
      "sales.create_quote","sales.approve_quote","sales.create_order","sales.view_pricing","sales.export",
      "services.read","services.manage",
      "projects.read","tasks.read",
      "documents.read","documents.manage","messaging.use","marketing.read",
      "ai.view_insights","ai.view_recommendations","scoring.view_client_health",
      "inventory.read","reports.view","reports.export_pdf",
      "users.read","departments.read",
    ],
  },
  {
    id: "resp_rh",
    name: "Responsable RH",
    description: "Gestion complète des ressources humaines",
    permCodes: [
      "dashboard.view_hr_kpis",
      "hr.read","hr.manage","hr.view_salary","hr.manage_payroll","hr.manage_leaves","hr.manage_contracts","hr.view_sensitive","hr.manage_expenses","hr.approve_expenses","hr.export",
      "attendance.view","attendance.manage","attendance.clock","attendance.view_anomalies","attendance.manage_settings",
      "departments.read","departments.manage",
      "users.read","users.invite",
      "projects.read","tasks.read","documents.read","documents.manage","messaging.use",
      "reports.view","reports.export_pdf","reports.export_excel",
      "ai.view_insights",
    ],
  },
  {
    id: "resp_achats",
    name: "Responsable Achats",
    description: "Fournisseurs, commandes et paiements fournisseurs",
    permCodes: [
      "clients.read","commercial.read",
      "purchases.read","purchases.write","purchases.approve","purchases.pay","purchases.manage","purchases.export",
      "inventory.read","inventory.receive",
      "documents.read","documents.manage","messaging.use",
      "reports.view","reports.export_pdf",
      "users.read","departments.read",
    ],
  },
  {
    id: "manager",
    name: "Manager / Chef de projet",
    description: "Pilotage des projets, équipes et budgets",
    permCodes: [
      "dashboard.view_financial_kpis","dashboard.view_hr_kpis",
      "clients.read","clients.create","clients.update","commercial.read",
      "projects.read","projects.create","projects.update","projects.approve","projects.manage_budget","projects.export",
      "tasks.read","tasks.create","tasks.update","tasks.delete","tasks.manage",
      "hr.read","hr.manage_leaves",
      "equipment.read","inventory.read",
      "operations.view","operations.assign","operations.performance",
      "documents.read","documents.manage","messaging.use","messaging.moderate",
      "reports.view","reports.export_pdf","reports.export_excel",
      "ai.view_insights","ai.view_recommendations","scoring.view_project_risk",
      "attendance.view","attendance.clock",
      "users.read","departments.read",
    ],
  },
  {
    id: "collaborateur",
    name: "Collaborateur",
    description: "Accès aux projets assignés, tâches et messagerie",
    permCodes: [
      "clients.read","services.read",
      "projects.read","tasks.read","tasks.create","tasks.update","tasks.manage",
      "equipment.read","documents.read","messaging.use",
      "attendance.clock","operations.view","operations.checkin","inventory.read",
      "ai.view_insights","users.read","departments.read",
    ],
  },
  {
    id: "lecture_seule",
    name: "Lecture seule",
    description: "Consultation uniquement, aucune modification",
    permCodes: [
      "dashboard.view_financial_kpis","dashboard.view_hr_kpis",
      "clients.read","commercial.read","projects.read","tasks.read",
      "equipment.read","inventory.read","hr.read",
      "accounting.read","fpa.read","purchases.read",
      "documents.read","messaging.use","marketing.read",
      "reports.view","ai.view_insights",
      "attendance.view","operations.view",
      "users.read","departments.read","settings.read",
    ],
  },
];

// ── Composant principal ───────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["admin/roles"],
    queryFn: () => apiFetch<{ data: Role[] }>("/api/admin/roles"),
  });
  const { data: permsData } = useQuery({
    queryKey: ["admin/permissions"],
    queryFn: () => apiFetch<{ data: Perm[] }>("/api/admin/permissions"),
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Role | null>(null);
  const [dupRole, setDupRole] = useState<Role | null>(null);

  const roles = rolesData?.data ?? [];
  const perms = permsData?.data ?? [];
  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (roles.length && !selectedRoleId) setSelectedRoleId(roles[0].id);
  }, [roles]);

  const create = useMutation({
    mutationFn: (body: any) => apiFetch("/api/admin/roles", { method: "POST", body }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      toast({ title: "Rôle créé" });
      setCreateOpen(false);
      if (res?.id) setSelectedRoleId(res.id);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      toast({ title: "Rôle supprimé" });
      setConfirmDel(null);
      setSelectedRoleId(roles.find(r => r.id !== confirmDel?.id)?.id ?? null);
    },
    onError: (e: any) => toast({ title: "Suppression impossible", description: e?.body?.error, variant: "destructive" }),
  });
  const duplicate = useMutation({
    mutationFn: ({ id, newCode, newName }: { id: string; newCode: string; newName: string }) =>
      apiFetch(`/api/admin/roles/${id}/duplicate`, { method: "POST", body: { newCode, newName } as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/roles"] }); toast({ title: "Rôle dupliqué" }); setDupRole(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full">
      {/* En-tête */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rôles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Définissez précisément ce que chaque rôle peut voir, faire et exporter</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nouveau rôle
        </Button>
      </div>

      {/* Corps principal en split-panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─ Panneau gauche : liste des rôles ── */}
        <div className="w-64 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col">
          <div className="p-3 space-y-1">
            {isLoading && <div className="text-xs text-muted-foreground px-2 py-1">Chargement…</div>}
            {roles.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2.5 transition-colors group",
                  selectedRoleId === r.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className={cn("w-4 h-4 shrink-0", selectedRoleId === r.id ? "text-primary-foreground" : "text-primary")} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", selectedRoleId === r.id ? "text-primary-foreground" : "")}>{r.name}</div>
                    <div className={cn("text-[10px] tabular-nums", selectedRoleId === r.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {r.permissionsCount} permissions · {r.usersCount} utilisateur{r.usersCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  {r.isSystem && <Lock className={cn("w-3 h-3 shrink-0", selectedRoleId === r.id ? "text-primary-foreground/60" : "text-muted-foreground/60")} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ─ Panneau droit : éditeur du rôle sélectionné ── */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole && perms.length > 0 ? (
            <RoleEditor
              key={selectedRole.id}
              role={selectedRole}
              allPerms={perms}
              onDuplicate={() => setDupRole(selectedRole)}
              onDelete={() => setConfirmDel(selectedRole)}
              onDeleted={() => setSelectedRoleId(roles.find(r => r.id !== selectedRole.id)?.id ?? null)}
            />
          ) : selectedRole ? (
            // Rôle sélectionné mais catalogue indisponible : ne jamais échouer
            // en silence (audit §D) — expliquer la cause probable.
            <div className="flex flex-col items-center justify-center h-full text-sm gap-2 px-6 text-center">
              <span className="font-medium text-destructive">Le catalogue de permissions est indisponible.</span>
              <span className="text-muted-foreground">
                Le référentiel des droits n'a pas pu être chargé (droits insuffisants ou seed RBAC non exécuté).
                La matrice ne peut pas être affichée sans lui.
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Sélectionnez un rôle pour configurer ses permissions
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={(b) => create.mutate(b)} pending={create.isPending} />
      {dupRole && (
        <DuplicateRoleDialog source={dupRole} onClose={() => setDupRole(null)}
          onSubmit={(c, n) => duplicate.mutate({ id: dupRole.id, newCode: c, newName: n })} pending={duplicate.isPending} />
      )}
      <ConfirmDialog
        open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer le rôle « ${confirmDel?.name} » ?`}
        description={confirmDel?.usersCount ? <>Ce rôle est attribué à <strong>{confirmDel.usersCount}</strong> utilisateur(s) — la suppression sera refusée.</> : "Cette action est irréversible."}
        destructive requireTypeToConfirm={confirmDel?.code} confirmLabel="Supprimer définitivement"
        onConfirm={() => { if (confirmDel) remove.mutate(confirmDel.id); }}
      />
    </div>
  );
}

// ── Éditeur de permissions d'un rôle ─────────────────────────────────────────

function RoleEditor({ role, allPerms, onDuplicate, onDelete, onDeleted }: {
  role: Role; allPerms: Perm[];
  onDuplicate: () => void; onDelete: () => void; onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"modules" | "resume">("modules");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["dashboard", "crm_ventes"]));
  const [templateOpen, setTemplateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin/role", role.id],
    queryFn: () => apiFetch<any>(`/api/admin/roles/${role.id}`),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.permissionIds) {
      setSelected(new Set(data.permissionIds));
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/admin/roles/${role.id}/permissions`, { method: "PUT", body: { permissionIds: Array.from(selected) } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      qc.invalidateQueries({ queryKey: ["admin/role", role.id] });
      toast({ title: "Permissions enregistrées" });
      setDirty(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  // Map code → permId
  const codeToId = useMemo(() => {
    const m = new Map<string, string>();
    allPerms.forEach(p => m.set(p.code, p.id));
    return m;
  }, [allPerms]);

  const toggle = (code: string) => {
    const id = codeToId.get(code);
    if (!id) return;
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
    setDirty(true);
  };
  const hasCode = (code: string) => {
    const id = codeToId.get(code);
    return id ? selected.has(id) : false;
  };

  // Module-level helpers
  const getModuleCodes = (mod: ModuleDef) => mod.groups.flatMap(g => g.perms.map(p => p.code));
  const moduleEnabledCount = (mod: ModuleDef) => getModuleCodes(mod).filter(hasCode).length;
  const moduleTotal = (mod: ModuleDef) => getModuleCodes(mod).length;
  const isModuleOn = (mod: ModuleDef) => moduleEnabledCount(mod) > 0;
  const isModuleFull = (mod: ModuleDef) => moduleEnabledCount(mod) === moduleTotal(mod);

  const toggleModule = (mod: ModuleDef) => {
    const codes = getModuleCodes(mod);
    const allOn = codes.every(hasCode);
    const n = new Set(selected);
    codes.forEach(code => {
      const id = codeToId.get(code);
      if (!id) return;
      if (allOn) n.delete(id); else n.add(id);
    });
    setSelected(n);
    setDirty(true);
  };

  const applyTemplate = (tmpl: RoleTemplate) => {
    const n = new Set<string>();
    tmpl.permCodes.forEach(code => {
      const id = codeToId.get(code);
      if (id) n.add(id);
    });
    setSelected(n);
    setDirty(true);
    setTemplateOpen(false);
    toast({ title: `Modèle « ${tmpl.name} » appliqué`, description: "Enregistrez pour confirmer." });
  };

  const toggleExpanded = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id); else n.add(id);
    setExpanded(n);
  };

  if (isLoading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Chargement…</div>;

  // Résumé pour l'onglet résumé
  const enabledModules = MODULE_DEFS.filter(m => isModuleOn(m));
  const disabledModules = MODULE_DEFS.filter(m => !isModuleOn(m));
  const hasSensitiveAccess = ["accounting.view_sensitive","hr.view_sensitive","hr.view_salary","clients.view_confidential","fpa.approve"].some(hasCode);
  const hasExportAccess = allPerms.filter(p => p.code.includes(".export") || p.code.includes("export_")).some(p => selected.has(p.id));
  const hasApproveAccess = allPerms.filter(p => p.code.includes(".approve") || p.code.includes("_approve")).some(p => selected.has(p.id));

  return (
    <div className="flex flex-col h-full">
      {/* En-tête du rôle */}
      <div className="px-6 py-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{role.name}</h2>
                {role.isSystem && <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]"><Lock className="w-2.5 h-2.5 mr-1" />Système</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{role.code}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{role.usersCount} utilisateur{role.usersCount > 1 ? "s" : ""}</span>
                <span>{selected.size} permission{selected.size > 1 ? "s" : ""} active{selected.size > 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Modèle
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}><Copy className="w-3.5 h-3.5 mr-1.5" /> Dupliquer</Button>
            {!role.isSystem && (
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
            )}
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending} className={cn(dirty ? "bg-primary" : "")}>
              {save.isPending ? "Enregistrement…" : dirty ? "Enregistrer les modifications" : "Enregistré"}
            </Button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 mt-3 border-b -mb-4 pt-2">
          {(["modules", "resume"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t === "modules" ? "Modules & Permissions" : "Résumé du rôle"}
            </button>
          ))}
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "modules" ? (
          <div className="space-y-3 max-w-4xl">
            {MODULE_DEFS.map(mod => {
              const count = moduleEnabledCount(mod);
              const total = moduleTotal(mod);
              const on = isModuleOn(mod);
              const full = isModuleFull(mod);
              const open = expanded.has(mod.id);

              return (
                <div key={mod.id} className={cn("rounded-xl border transition-all", on ? mod.border : "border-border/50")}>
                  {/* En-tête du module */}
                  <div className={cn("flex items-center gap-3 px-4 py-3 rounded-t-xl", on ? mod.bg : "bg-muted/20")}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", on ? mod.bg : "bg-muted/40")}>
                      <mod.icon className={cn("w-4 h-4", on ? mod.color : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium text-sm", on ? "text-foreground" : "text-muted-foreground")}>{mod.label}</span>
                        {full && <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 border-0">Accès complet</Badge>}
                        {on && !full && <Badge variant="secondary" className="text-[9px] h-4">{count}/{total}</Badge>}
                        {!on && <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground">Désactivé</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Switch
                        checked={on}
                        onCheckedChange={() => toggleModule(mod)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <button onClick={() => toggleExpanded(mod.id)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Détail des permissions */}
                  {open && (
                    <div className="p-4 space-y-4">
                      {mod.groups.map((group, gi) => {
                        const groupCodes = group.perms.map(p => p.code);
                        const groupOn = groupCodes.filter(hasCode).length;
                        const groupTotal = groupCodes.length;
                        return (
                          <div key={gi}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {group.icon && <group.icon className="w-3.5 h-3.5" />}
                                {group.label}
                              </div>
                              <button
                                className="text-[10px] text-primary hover:underline"
                                onClick={() => {
                                  const allOn2 = groupCodes.every(hasCode);
                                  const n = new Set(selected);
                                  groupCodes.forEach(code => {
                                    const id = codeToId.get(code);
                                    if (!id) return;
                                    if (allOn2) n.delete(id); else n.add(id);
                                  });
                                  setSelected(n);
                                  setDirty(true);
                                }}
                              >
                                {groupOn === groupTotal ? "Tout désactiver" : "Tout activer"}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {group.perms.map(p => {
                                const active = hasCode(p.code);
                                return (
                                  <label key={p.code} className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-colors text-sm",
                                    active ? "bg-primary/5 border-primary/20 text-foreground" : "border-transparent hover:bg-muted/40 text-muted-foreground"
                                  )}>
                                    <div className={cn(
                                      "w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors",
                                      active ? "bg-primary border-primary" : "border-muted-foreground/30 bg-background"
                                    )}
                                      onClick={() => toggle(p.code)}>
                                      {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <span className="leading-tight" onClick={() => toggle(p.code)}>{p.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Onglet Résumé ── */
          <div className="max-w-3xl space-y-5">
            {dirty && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Des modifications non enregistrées sont en attente.
                <Button size="sm" className="ml-auto h-7" onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Permissions actives", value: selected.size, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
                { label: "Modules activés", value: enabledModules.length, icon: ShieldCheck, color: "text-blue-600 bg-blue-50" },
                { label: "Modules désactivés", value: disabledModules.length, icon: XCircle, color: "text-gray-500 bg-gray-50" },
                { label: "Utilisateurs", value: role.usersCount, icon: Users, color: "text-violet-600 bg-violet-50" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="p-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", color.split(" ")[1])}>
                    <Icon className={cn("w-4 h-4", color.split(" ")[0])} />
                  </div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </Card>
              ))}
            </div>

            {/* Accès spéciaux */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <h3 className="font-semibold text-sm">Accès spéciaux</h3>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { label: "Données sensibles (salaires, financier, confidentiel)", active: hasSensitiveAccess, icon: Eye },
                  { label: "Exports de données (PDF, Excel, CSV)", active: hasExportAccess, icon: Upload },
                  { label: "Approbations (budgets, devis, dépenses)", active: hasApproveAccess, icon: CheckSquare },
                  { label: "Administration (gestion utilisateurs/rôles/paramètres)", active: hasCode("admin.access"), icon: Shield },
                  { label: "Journal d'audit", active: hasCode("audit.read"), icon: ShieldCheck },
                ].map(({ label, active, icon: Icon }) => (
                  <div key={label} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                    active ? "bg-emerald-50 text-emerald-900" : "bg-muted/30 text-muted-foreground")}>
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-emerald-600" : "text-muted-foreground/50")} />
                    <span className="flex-1">{label}</span>
                    {active ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Modules activés */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <h3 className="font-semibold text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Modules activés ({enabledModules.length})
                </h3>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {enabledModules.map(m => (
                    <span key={m.id} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border", m.bg, m.border, m.color)}>
                      <m.icon className="w-3 h-3" />
                      {m.label}
                      {isModuleFull(m) && <span className="opacity-60">·complet</span>}
                    </span>
                  ))}
                  {enabledModules.length === 0 && <span className="text-sm text-muted-foreground">Aucun module activé</span>}
                </div>
              </CardContent>
            </Card>

            {/* Modules désactivés */}
            {disabledModules.length > 0 && (
              <Card className="border-dashed">
                <CardHeader className="pb-2 pt-4 px-4">
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Modules désactivés ({disabledModules.length})
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {disabledModules.map(m => (
                      <span key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground bg-muted/40 border border-dashed">
                        <m.icon className="w-3 h-3" />
                        {m.label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Sélecteur de templates */}
      {templateOpen && (
        <Dialog open onOpenChange={setTemplateOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Appliquer un modèle de rôle</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Sélectionnez un modèle prédéfini pour configurer rapidement les permissions. Vous pourrez les ajuster ensuite.</p>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
              {ROLE_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)}
                  className="text-left p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="font-semibold text-sm group-hover:text-primary">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-2">{t.permCodes.length} permissions</div>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateOpen(false)}>Annuler</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

function CreateRoleDialog({ open, onOpenChange, onSubmit, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (b: any) => void; pending: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(20);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer un nouveau rôle</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nom du rôle</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Chef de projet" /></div>
          <div><Label>Code interne</Label><Input value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="Ex : chef_projet" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="À quoi sert ce rôle ?" /></div>
          <div><Label>Niveau hiérarchique (1–99)</Label><Input type="number" min={1} max={99} value={level} onChange={e => setLevel(Number(e.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSubmit({ code, name, description, level })} disabled={pending || !code || !name}>
            {pending ? "Création…" : "Créer le rôle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateRoleDialog({ source, onClose, onSubmit, pending }: { source: { id: string; code: string; name: string }; onClose: () => void; onSubmit: (newCode: string, newName: string) => void; pending: boolean }) {
  const [code, setCode] = useState(`${source.code}_copie`);
  const [name, setName] = useState(`${source.name} (copie)`);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dupliquer « {source.name} »</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Le nouveau rôle héritera de toutes les permissions du rôle source. Vous pourrez les ajuster ensuite.</p>
        <div className="space-y-3">
          <div><Label>Nom du nouveau rôle</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Code interne</Label><Input value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSubmit(code, name)} disabled={pending || !code || !name}>
            {pending ? "Duplication…" : "Dupliquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
