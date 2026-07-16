import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList, Search, ChevronLeft, ChevronRight, Filter, X,
  Shield, AlertTriangle, Download, Activity, Users, Trash2, LogIn,
  Eye, BarChart3, Clock, Monitor, Globe, CheckCircle2, XCircle,
  AlertCircle, Info, Zap, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLog = {
  id: string;
  userId?: string; userEmail?: string; userRole?: string;
  action: string; category: string; severity: string; status: string;
  module?: string; subModule?: string; page?: string;
  entityType?: string; entityId?: string; entityName?: string;
  changes?: Array<{ field: string; label?: string; before?: unknown; after?: unknown }>;
  payload?: unknown; errorMessage?: string;
  sessionId?: string; requestId?: string;
  ipAddress?: string; userAgent?: string; browser?: string; os?: string; device?: string;
  createdAt: string;
};

type AuditResponse = { data: AuditLog[]; total: number; page: number; limit: number; pages: number };

type DashboardData = {
  kpis: {
    total: number; logins: number; failures: number; sensitive: number;
    deletions: number; exports: number; permissionChanges: number; openAlerts: number;
  };
  dailySeries: Array<{ day: string; total: number; failures: number }>;
  byModule: Array<{ module: string; n: number }>;
  bySeverity: Array<{ severity: string; n: number }>;
  topUsers: Array<{ userEmail: string; userId: string; n: number }>;
};

type SecurityAlert = {
  id: string; organizationId: string; userId?: string; userEmail?: string;
  type: string; severity: string; message: string; detail?: unknown;
  resolvedAt?: string; createdBy?: string; createdAt: string;
};

// ─── Constantes ──────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  info:     { label: "Info",     color: "bg-sky-100 text-sky-700 border-sky-200",           icon: <Info className="w-3 h-3" /> },
  low:      { label: "Faible",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  medium:   { label: "Moyen",    color: "bg-blue-100 text-blue-700 border-blue-200",         icon: <Activity className="w-3 h-3" /> },
  high:     { label: "Élevé",    color: "bg-amber-100 text-amber-800 border-amber-200",      icon: <AlertTriangle className="w-3 h-3" /> },
  critical: { label: "Critique", color: "bg-red-100 text-red-700 border-red-200",           icon: <Zap className="w-3 h-3" /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  success: { label: "Succès",  color: "bg-emerald-100 text-emerald-700" },
  failure: { label: "Échec",   color: "bg-red-100 text-red-700" },
  denied:  { label: "Refusé",  color: "bg-amber-100 text-amber-800" },
};

const ACTION_LABELS: Record<string, string> = {
  create: "Création", update: "Modification", delete: "Suppression",
  archive: "Archivage", restore: "Restauration", duplicate: "Duplication",
  view: "Consultation", export: "Export", import: "Import",
  download: "Téléchargement", print: "Impression", send_email: "Envoi email",
  validate: "Validation", approve: "Approbation", reject: "Rejet",
  cancel: "Annulation", status_change: "Changement statut",
  login: "Connexion", logout: "Déconnexion", login_failed: "Connexion échouée",
  login_2fa_sent: "2FA envoyé", login_2fa_success: "2FA validé",
  login_2fa_failed: "2FA échoué", login_2fa_locked: "2FA bloqué",
  invite: "Invitation", invitation_sent: "Invitation envoyée",
  invitation_accept: "Invitation acceptée", invitation_revoke: "Invitation révoquée",
  role_change: "Changement de rôle", permission_change: "Modif. permissions",
  password_change: "Changement MDP", "2fa_disabled": "2FA désactivé",
  salary_change: "Modification salaire", payroll_generate: "Paie générée",
  payroll_validate: "Paie validée", payslip_download: "Bulletin téléchargé",
  advance_approve: "Avance approuvée", leave_approve: "Congé approuvé",
  journal_entry_create: "Écriture créée", journal_entry_validate: "Écriture validée",
  journal_entry_reverse: "Contre-passation", period_close: "Période clôturée",
  period_reopen: "Période réouverte", banking_change: "Coords. bancaires modifiées",
  module_activate: "Module activé", module_deactivate: "Module désactivé",
  subscription_change: "Abonnement modifié", org_settings_change: "Paramètres modifiés",
  org_switch: "Organisation changée", audit_export: "Export journal",
  audit_view: "Consultation événement", unauthorized_access: "Accès non autorisé",
  access_denied: "Accès refusé", security_alert: "Alerte sécurité",
  kiosk_create: "Kiosk créé", kiosk_delete: "Kiosk supprimé",
  kiosk_token_generate: "Token kiosk généré", kiosk_token_revoke: "Token kiosk révoqué",
  expert_firm_create: "Cabinet créé", expert_firm_update: "Cabinet modifié",
};

const MODULE_LABELS: Record<string, string> = {
  ventes: "Ventes", crm: "CRM", achats: "Achats", comptabilite: "Comptabilité",
  fpa: "FP&A", rh: "Ressources humaines", paie: "Paie", projets: "Projets",
  taches: "Tâches", equipements: "Équipements", locations: "Locations",
  logistique: "Logistique", messagerie: "Messagerie", expert: "Expert",
  administration: "Administration", kiosk: "Kiosk",
};

// ─── Groupes d'actions (filter hiérarchique) ─────────────────────────────────

const ACTION_GROUPS: Array<{ key: string; label: string; actions: Array<{ key: string; label: string }> }> = [
  { key: "group:navigation", label: "Navigation", actions: [] },
  { key: "group:auth", label: "Authentification & Sécurité", actions: [
    { key: "login",              label: "Connexion réussie" },
    { key: "logout",             label: "Déconnexion" },
    { key: "login_failed",       label: "Connexion échouée" },
    { key: "login_2fa_locked",   label: "2FA bloqué" },
    { key: "2fa_enabled",        label: "2FA activé" },
    { key: "2fa_disabled",       label: "2FA désactivé" },
    { key: "password_change",    label: "Mot de passe modifié" },
    { key: "org_switch",         label: "Organisation changée" },
  ]},
  { key: "group:consultation", label: "Consultation", actions: [
    { key: "view",         label: "Consultation" },
    { key: "salary_view",  label: "Salaire consulté" },
    { key: "audit_view",   label: "Événement d'audit consulté" },
  ]},
  { key: "group:creation", label: "Création", actions: [
    { key: "create",              label: "Création" },
    { key: "invite",              label: "Invitation envoyée" },
    { key: "journal_entry_create",label: "Écriture comptable créée" },
    { key: "kiosk_create",        label: "Kiosk créé" },
    { key: "expert_firm_create",  label: "Cabinet expert créé" },
  ]},
  { key: "group:modification", label: "Modification", actions: [
    { key: "update",             label: "Modification" },
    { key: "role_change",        label: "Rôle modifié" },
    { key: "permission_change",  label: "Permissions modifiées" },
    { key: "salary_change",      label: "Salaire modifié" },
    { key: "contract_change",    label: "Contrat modifié" },
    { key: "org_settings_change",label: "Paramètres org modifiés" },
    { key: "banking_change",     label: "Coordonnées bancaires" },
    { key: "fiscal_param_change",label: "Paramètre fiscal" },
    { key: "status_change",      label: "Statut modifié" },
  ]},
  { key: "group:validation", label: "Validation & Approbation", actions: [
    { key: "validate",            label: "Validation" },
    { key: "approve",             label: "Approbation" },
    { key: "reject",              label: "Rejet" },
    { key: "journal_entry_validate", label: "Écriture validée" },
    { key: "payroll_validate",    label: "Paie validée" },
    { key: "advance_approve",     label: "Avance approuvée" },
    { key: "leave_approve",       label: "Congé approuvé" },
    { key: "payment_validate",    label: "Paiement validé" },
    { key: "declaration_validate",label: "Déclaration fiscale validée" },
  ]},
  { key: "group:suppression", label: "Suppression & Archivage", actions: [
    { key: "delete",   label: "Suppression" },
    { key: "archive",  label: "Archivage" },
    { key: "restore",  label: "Restauration" },
    { key: "cancel",   label: "Annulation" },
    { key: "deactivate",label: "Désactivation" },
    { key: "kiosk_delete", label: "Kiosk supprimé" },
  ]},
  { key: "group:export", label: "Export & Téléchargement", actions: [
    { key: "export",          label: "Export" },
    { key: "audit_export",    label: "Export journal d'audit" },
    { key: "download",        label: "Téléchargement" },
    { key: "print",           label: "Impression" },
    { key: "payslip_download",label: "Bulletin de paie" },
    { key: "import",          label: "Import" },
    { key: "send_email",      label: "Email envoyé" },
  ]},
  { key: "group:finance", label: "Finance & Comptabilité", actions: [
    { key: "journal_entry_create",  label: "Écriture créée" },
    { key: "journal_entry_validate",label: "Écriture validée" },
    { key: "journal_entry_reverse", label: "Contre-passation" },
    { key: "period_close",          label: "Période clôturée" },
    { key: "period_reopen",         label: "Période réouverte" },
    { key: "bank_reconciliation",   label: "Rapprochement bancaire" },
    { key: "payment_record",        label: "Paiement enregistré" },
    { key: "payment_validate",      label: "Paiement validé" },
  ]},
  { key: "group:rh", label: "Ressources Humaines & Paie", actions: [
    { key: "salary_view",    label: "Salaire consulté" },
    { key: "salary_change",  label: "Salaire modifié" },
    { key: "payroll_generate",label: "Paie générée" },
    { key: "payroll_validate",label: "Paie validée" },
    { key: "payslip_download",label: "Bulletin téléchargé" },
    { key: "advance_approve", label: "Avance approuvée" },
    { key: "leave_approve",   label: "Congé approuvé" },
    { key: "contract_change", label: "Contrat modifié" },
  ]},
  { key: "group:admin", label: "Administration", actions: [
    { key: "module_activate",  label: "Module activé" },
    { key: "module_deactivate",label: "Module désactivé" },
    { key: "subscription_change",label: "Abonnement modifié" },
    { key: "addon_activate",   label: "Add-on activé" },
    { key: "activate",         label: "Utilisateur activé" },
    { key: "deactivate",       label: "Utilisateur désactivé" },
    { key: "invite",           label: "Invitation envoyée" },
  ]},
  { key: "group:security", label: "Alertes sécurité", actions: [
    { key: "security_alert",      label: "Alerte sécurité" },
    { key: "unauthorized_access", label: "Accès non autorisé" },
    { key: "access_denied",       label: "Accès refusé" },
  ]},
];

// ─── Description lisible par événement ────────────────────────────────────────

function entityLabel(entityType?: string | null): string {
  const map: Record<string, string> = {
    client: "Client", invoice: "Facture", order: "Commande",
    proforma: "Devis", project: "Projet", task: "Tâche",
    collaborator: "Collaborateur", equipment: "Équipement",
    user: "Utilisateur", rental: "Location", payment: "Paiement",
    journal_entry: "Écriture", budget: "Budget", contract: "Contrat",
    payroll: "Fiche de paie", leave: "Congé", advance: "Avance",
    declaration: "Déclaration", document: "Document", supplier: "Fournisseur",
    opportunity: "Opportunité", contact: "Contact", kiosk: "Kiosk",
    category: "Catégorie", organisation: "Organisation",
  };
  return entityType ? (map[entityType] ?? entityType) : "Élément";
}

function getDescription(log: AuditLog): string {
  const n = log.entityName ? `« ${log.entityName} »` : "";
  const mod = log.module ? (MODULE_LABELS[log.module] ?? log.module) : "";

  if (log.category === "navigation") {
    if (log.subModule) return `Section « ${log.subModule} » ouverte${mod ? ` — ${mod}` : ""}`;
    if (log.module) return `Module ${mod} ouvert`;
    return "Navigation dans l'application";
  }

  switch (log.action) {
    case "login":               return "Connexion réussie";
    case "logout":              return "Déconnexion";
    case "login_failed":        return "Tentative de connexion échouée";
    case "login_2fa_sent":      return "Code 2FA envoyé";
    case "login_2fa_success":   return "Authentification 2FA réussie";
    case "login_2fa_failed":    return "Code 2FA incorrect";
    case "login_2fa_locked":    return "Compte verrouillé — trop de tentatives 2FA";
    case "2fa_enabled":         return "Double authentification activée";
    case "2fa_disabled":        return "Double authentification désactivée";
    case "org_switch":          return n ? `Organisation changée → ${n}` : "Changement d'organisation";
    case "password_change":     return "Mot de passe modifié";
    case "password_reset_request": return n ? `Réinitialisation MDP demandée pour ${n}` : "Réinitialisation de mot de passe demandée";
    case "password_reset_complete": return "Mot de passe réinitialisé";

    case "create":     return n ? `${entityLabel(log.entityType)} ${n} créé(e)` : `Création dans ${mod || "l'application"}`;
    case "update":     return n ? `${entityLabel(log.entityType)} ${n} modifié(e)` : `Modification dans ${mod || "l'application"}`;
    case "delete":     return n ? `${entityLabel(log.entityType)} ${n} supprimé(e)` : `Suppression dans ${mod || "l'application"}`;
    case "view":       return n ? `${entityLabel(log.entityType)} ${n} consulté(e)` : `Consultation dans ${mod || "l'application"}`;
    case "archive":    return n ? `${entityLabel(log.entityType)} ${n} archivé(e)` : "Archivage";
    case "restore":    return n ? `${entityLabel(log.entityType)} ${n} restauré(e)` : "Restauration";
    case "duplicate":  return n ? `${entityLabel(log.entityType)} ${n} dupliqué(e)` : "Duplication";
    case "export":     return n ? `Export de ${n}` : `Export depuis ${mod || "l'application"}`;
    case "import":     return `Import de données${mod ? ` — ${mod}` : ""}`;
    case "download":   return n ? `Téléchargement de ${n}` : "Téléchargement";
    case "print":      return n ? `Impression de ${n}` : "Impression";
    case "send_email": return n ? `Email envoyé pour ${n}` : "Email envoyé";
    case "validate":   return n ? `Validation de ${n}` : `Validation${mod ? ` — ${mod}` : ""}`;
    case "approve":    return n ? `Approbation de ${n}` : `Approbation${mod ? ` — ${mod}` : ""}`;
    case "reject":     return n ? `Rejet de ${n}` : `Rejet${mod ? ` — ${mod}` : ""}`;
    case "cancel":     return n ? `Annulation de ${n}` : "Annulation";
    case "status_change": return n ? `Statut de ${n} modifié` : "Changement de statut";

    case "invite":              return n ? `Invitation envoyée à ${n}` : "Invitation envoyée";
    case "invitation_sent":     return n ? `Invitation envoyée à ${n}` : "Invitation envoyée";
    case "invitation_accept":   return "Invitation acceptée";
    case "invitation_revoke":   return n ? `Invitation révoquée pour ${n}` : "Invitation révoquée";
    case "activate":            return n ? `Compte de ${n} activé` : "Compte activé";
    case "deactivate":          return n ? `Compte de ${n} désactivé` : "Compte désactivé";
    case "user_activated":      return n ? `Compte de ${n} activé` : "Compte activé";

    case "role_change":        return n ? `Rôle de ${n} modifié` : "Modification de rôle";
    case "permission_change":  return n ? `Permissions de ${n} modifiées` : "Modification de permissions";
    case "department_change":  return n ? `Département de ${n} modifié` : "Changement de département";
    case "project_access_grant":  return n ? `Accès projet accordé à ${n}` : "Accès projet accordé";
    case "project_access_revoke": return n ? `Accès projet retiré à ${n}` : "Accès projet retiré";
    case "client_access_grant":   return n ? `Accès client accordé à ${n}` : "Accès client accordé";
    case "client_access_revoke":  return n ? `Accès client retiré à ${n}` : "Accès client retiré";

    case "invoice_edit":     return n ? `Facture ${n} modifiée` : "Facture modifiée";
    case "invoice_cancel":   return n ? `Facture ${n} annulée` : "Facture annulée";
    case "order_edit":       return n ? `Commande ${n} modifiée` : "Commande modifiée";
    case "order_cancel":     return n ? `Commande ${n} annulée` : "Commande annulée";
    case "payment_record":   return n ? `Paiement enregistré — ${n}` : "Paiement enregistré";
    case "payment_validate": return n ? `Paiement validé — ${n}` : "Paiement validé";

    case "journal_entry_create":   return n ? `Écriture comptable créée : ${n}` : "Écriture comptable créée";
    case "journal_entry_validate": return n ? `Écriture comptable validée : ${n}` : "Écriture comptable validée";
    case "journal_entry_reverse":  return n ? `Contre-passation de ${n}` : "Contre-passation";
    case "period_close":           return n ? `Période clôturée : ${n}` : "Période comptable clôturée";
    case "period_reopen":          return n ? `Période réouverte : ${n}` : "Période comptable réouverte";
    case "bank_reconciliation":    return "Rapprochement bancaire effectué";

    case "salary_view":      return n ? `Salaire de ${n} consulté` : "Consultation de salaire";
    case "salary_change":    return n ? `Salaire de ${n} modifié` : "Modification de salaire";
    case "payroll_generate": return n ? `Paie générée : ${n}` : "Paie générée";
    case "payroll_validate": return n ? `Paie validée : ${n}` : "Paie validée";
    case "payslip_download": return n ? `Bulletin de paie téléchargé : ${n}` : "Bulletin de paie téléchargé";
    case "advance_approve":  return n ? `Avance sur salaire approuvée — ${n}` : "Avance sur salaire approuvée";
    case "leave_approve":    return n ? `Congé approuvé — ${n}` : "Congé approuvé";
    case "contract_change":  return n ? `Contrat de ${n} modifié` : "Contrat modifié";

    case "module_activate":    return n ? `Module « ${n} » activé` : "Module activé";
    case "module_deactivate":  return n ? `Module « ${n} » désactivé` : "Module désactivé";
    case "subscription_change":return "Abonnement modifié";
    case "addon_activate":     return n ? `Add-on « ${n} » activé` : "Add-on activé";
    case "org_settings_change":return "Paramètres de l'organisation modifiés";
    case "banking_change":     return "Coordonnées bancaires modifiées";
    case "fiscal_param_change":return n ? `Paramètre fiscal modifié : ${n}` : "Paramètre fiscal modifié";
    case "declaration_validate":return n ? `Déclaration fiscale validée : ${n}` : "Déclaration fiscale validée";

    case "audit_export":       return "Export du journal d'audit";
    case "audit_view":         return "Événement d'audit consulté";
    case "security_alert":     return "Alerte de sécurité générée";
    case "unauthorized_access":return n ? `Accès non autorisé à ${n}` : "Tentative d'accès non autorisé";
    case "access_denied":      return n ? `Accès refusé à ${n}` : "Accès refusé";

    case "kiosk_create":         return n ? `Kiosk « ${n} » créé` : "Kiosk créé";
    case "kiosk_delete":         return n ? `Kiosk « ${n} » supprimé` : "Kiosk supprimé";
    case "kiosk_token_generate": return "Jeton d'accès kiosk généré";
    case "kiosk_token_revoke":   return "Jeton d'accès kiosk révoqué";
    case "kiosk_token_access":   return "Accès kiosk via jeton";

    case "expert_firm_create":         return n ? `Cabinet expert créé : ${n}` : "Cabinet expert créé";
    case "expert_firm_update":         return n ? `Cabinet expert modifié : ${n}` : "Cabinet expert modifié";
    case "expert_client_link":         return n ? `Client lié au cabinet : ${n}` : "Client lié au cabinet";
    case "expert_client_unlink":       return n ? `Client délié du cabinet : ${n}` : "Client délié du cabinet";
    case "expert_doc_request_create":  return n ? `Demande de document créée : ${n}` : "Demande de document créée";
    case "expert_doc_request_update":  return n ? `Demande de document mise à jour : ${n}` : "Demande de document mise à jour";
    case "expert_member_invite":       return n ? `Membre expert invité : ${n}` : "Membre expert invité";
    case "expert_member_remove":       return n ? `Membre expert retiré : ${n}` : "Membre expert retiré";

    default: return ACTION_LABELS[log.action] ?? log.action;
  }
}

const QUICK_FILTERS = [
  { key: "_all",       label: "Tout",         icon: <Activity className="w-3.5 h-3.5" /> },
  { key: "today",      label: "Aujourd'hui",  icon: <Clock className="w-3.5 h-3.5" /> },
  { key: "7d",         label: "7 jours",      icon: <Clock className="w-3.5 h-3.5" /> },
  { key: "navigation", label: "Navigation",   icon: <Globe className="w-3.5 h-3.5" /> },
  { key: "sensitive",  label: "Sensibles",    icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "deletions",  label: "Suppressions", icon: <Trash2 className="w-3.5 h-3.5" /> },
  { key: "failures",   label: "Échecs",       icon: <XCircle className="w-3.5 h-3.5" /> },
  { key: "exports",    label: "Exports",      icon: <Download className="w-3.5 h-3.5" /> },
  { key: "logins",     label: "Connexions",   icon: <LogIn className="w-3.5 h-3.5" /> },
  { key: "permissions",label: "Permissions",  icon: <Shield className="w-3.5 h-3.5" /> },
];

const SEVERITY_COLORS_CHART = ["#38bdf8","#34d399","#60a5fa","#fbbf24","#f87171"];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

// ─── Panneau détail ───────────────────────────────────────────────────────────

function DetailPanel({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const changes = log.changes ?? [];
  return (
    <Sheet open onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-[560px] sm:max-w-[560px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Détail de l'événement
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={log.severity} />
            <StatusBadge status={log.status} />
            <span className="text-xs text-muted-foreground font-mono">{log.id.slice(0, 8)}…</span>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">

            {/* Identification */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identification</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Date / Heure</dt>
                <dd className="font-medium">{fmt(log.createdAt)}</dd>
                <dt className="text-muted-foreground">Utilisateur</dt>
                <dd className="font-medium truncate">{log.userEmail ?? "—"}</dd>
                <dt className="text-muted-foreground">Rôle</dt>
                <dd>{log.userRole ?? "—"}</dd>
                <dt className="text-muted-foreground">Session</dt>
                <dd className="font-mono text-xs truncate">{log.sessionId ?? "—"}</dd>
              </dl>
            </section>
            <Separator />

            {/* Contexte fonctionnel */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contexte fonctionnel</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Action</dt>
                <dd className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</dd>
                <dt className="text-muted-foreground">Catégorie</dt>
                <dd>{log.category === "audit" ? "Audit" : "Navigation"}</dd>
                <dt className="text-muted-foreground">Module</dt>
                <dd>{log.module ? (MODULE_LABELS[log.module] ?? log.module) : "—"}</dd>
                {log.subModule && <><dt className="text-muted-foreground">Sous-module</dt><dd>{log.subModule}</dd></>}
                {log.page && <><dt className="text-muted-foreground">Page</dt><dd className="font-mono text-xs">{log.page}</dd></>}
                <dt className="text-muted-foreground">Type entité</dt>
                <dd>{log.entityType ?? "—"}</dd>
                {log.entityName && <><dt className="text-muted-foreground">Nom entité</dt><dd className="font-medium">{log.entityName}</dd></>}
                {log.entityId && <><dt className="text-muted-foreground">ID entité</dt><dd className="font-mono text-xs">{log.entityId.slice(0, 16)}…</dd></>}
              </dl>
            </section>

            {/* Modifications */}
            {changes.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modifications ({changes.length} champ{changes.length > 1 ? "s" : ""})</h3>
                  <div className="space-y-2">
                    {changes.map((c, i) => (
                      <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                        <div className="font-medium text-foreground mb-1">{c.label ?? c.field}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5">Avant</div>
                            <div className="bg-red-50 border border-red-100 rounded px-2 py-1 text-xs font-mono text-red-700 break-all">
                              {c.before != null ? String(c.before) : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5">Après</div>
                            <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-xs font-mono text-emerald-700 break-all">
                              {c.after != null ? String(c.after) : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Résultat & erreur */}
            {(log.errorMessage || log.payload) && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Résultat</h3>
                  {log.errorMessage && (
                    <div className="bg-red-50 border border-red-100 rounded p-3 text-sm text-red-700 font-mono mb-2">
                      {log.errorMessage}
                    </div>
                  )}
                  {log.payload && (
                    <details>
                      <summary className="text-xs text-muted-foreground cursor-pointer">Données additionnelles</summary>
                      <pre className="mt-2 bg-muted/40 rounded p-2 text-xs overflow-x-auto max-h-48">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </section>
              </>
            )}

            <Separator />
            {/* Contexte technique */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contexte technique</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Adresse IP</dt>
                <dd className="font-mono text-xs">{log.ipAddress ?? "—"}</dd>
                <dt className="text-muted-foreground">Navigateur</dt>
                <dd>{log.browser ?? "—"}</dd>
                <dt className="text-muted-foreground">OS</dt>
                <dd>{log.os ?? "—"}</dd>
                <dt className="text-muted-foreground">Appareil</dt>
                <dd>{log.device ?? "—"}</dd>
                <dt className="text-muted-foreground">Request ID</dt>
                <dd className="font-mono text-xs truncate">{log.requestId ?? "—"}</dd>
                {log.userAgent && (
                  <>
                    <dt className="text-muted-foreground">User-Agent</dt>
                    <dd className="font-mono text-xs truncate col-span-1" title={log.userAgent}>{log.userAgent.slice(0, 50)}…</dd>
                  </>
                )}
              </dl>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── Timeline utilisateur ─────────────────────────────────────────────────────

function UserTimeline({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery<{ data: AuditLog[] }>({
    queryKey: ["audit/timeline", userId, days],
    queryFn: () => apiFetch(`/api/admin/audit/user/${userId}/timeline?days=${days}`),
    enabled: !!userId,
  });
  const logs = data?.data ?? [];
  return (
    <Sheet open onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Chronologie utilisateur
          </SheetTitle>
          <div className="flex gap-2">
            {[1, 7, 30].map(d => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"}
                className="h-7 text-xs" onClick={() => setDays(d)}>
                {d === 1 ? "Aujourd'hui" : `${d}j`}
              </Button>
            ))}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading && <div className="text-muted-foreground text-sm">Chargement…</div>}
          {!isLoading && logs.length === 0 && <div className="text-muted-foreground text-sm">Aucune activité.</div>}
          <div className="relative">
            {logs.length > 0 && <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />}
            <div className="space-y-3">
              {logs.map(log => {
                const sev = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.medium;
                return (
                  <div key={log.id} className="flex gap-4 pl-8 relative">
                    <div className={`absolute left-0 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-background ${sev.color}`}>
                      {sev.icon}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{fmt(log.createdAt)}</span>
                        <StatusBadge status={log.status} />
                      </div>
                      <div className="text-sm font-medium mt-0.5">{ACTION_LABELS[log.action] ?? log.action}</div>
                      {(log.module || log.entityName) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {log.module && <span>{MODULE_LABELS[log.module] ?? log.module}</span>}
                          {log.entityName && <span> · {log.entityName}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── Section Alertes de sécurité ─────────────────────────────────────────────

function SecurityAlertsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: SecurityAlert[] }>({
    queryKey: ["admin/security-alerts"],
    queryFn: () => apiFetch("/api/admin/security-alerts?unresolved=true"),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/security-alerts/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin/security-alerts"] }),
  });
  const alerts = data?.data ?? [];
  if (isLoading) return null;
  if (alerts.length === 0) return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardContent className="py-4 flex items-center gap-3 text-sm text-emerald-700">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        Aucune alerte de sécurité en cours. Tout est normal.
      </CardContent>
    </Card>
  );
  return (
    <Card className="border-red-200 bg-red-50/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-red-700 text-base">
          <AlertTriangle className="w-5 h-5" />
          {alerts.length} alerte{alerts.length > 1 ? "s" : ""} de sécurité active{alerts.length > 1 ? "s" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(a => (
          <div key={a.id} className="flex items-start gap-3 border rounded-md p-3 bg-background">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <SeverityBadge severity={a.severity} />
                <span className="text-xs text-muted-foreground">{fmt(a.createdAt)}</span>
              </div>
              <div className="text-sm font-medium">{a.message}</div>
              {a.userEmail && <div className="text-xs text-muted-foreground mt-0.5">{a.userEmail}</div>}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
              onClick={() => resolve.mutate(a.id)} disabled={resolve.isPending}>
              Résoudre
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

function AuditDashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["audit/dashboard", days],
    queryFn: () => apiFetch(`/api/admin/audit/dashboard?days=${days}`),
  });

  const kpis = data?.kpis;
  const KPI_CARDS = kpis ? [
    { label: "Total événements",        value: kpis.total,             icon: <ClipboardList className="w-4 h-4" />, color: "text-foreground" },
    { label: "Connexions réussies",     value: kpis.logins,            icon: <LogIn className="w-4 h-4" />,        color: "text-emerald-600" },
    { label: "Échecs / Refus",          value: kpis.failures,          icon: <XCircle className="w-4 h-4" />,      color: "text-red-600" },
    { label: "Actions sensibles",       value: kpis.sensitive,         icon: <AlertTriangle className="w-4 h-4" />,color: "text-amber-600" },
    { label: "Suppressions",            value: kpis.deletions,         icon: <Trash2 className="w-4 h-4" />,       color: "text-red-500" },
    { label: "Exports de données",      value: kpis.exports,           icon: <Download className="w-4 h-4" />,     color: "text-blue-600" },
    { label: "Chgmts permissions",      value: kpis.permissionChanges, icon: <Shield className="w-4 h-4" />,       color: "text-purple-600" },
    { label: "Alertes ouvertes",        value: kpis.openAlerts,        icon: <AlertCircle className="w-4 h-4" />,  color: kpis.openAlerts > 0 ? "text-red-600" : "text-emerald-600" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tableau de bord</h2>
        <div className="flex gap-1.5">
          {[7, 30, 90].map(d => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="h-7 text-xs"
              onClick={() => setDays(d)}>{d} jours</Button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isLoading ? Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 h-16 animate-pulse bg-muted/30 rounded" /></Card>
        )) : KPI_CARDS.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`shrink-0 ${k.color}`}>{k.icon}</div>
              <div className="min-w-0">
                <div className={`text-xl font-bold ${k.color}`}>{k.value.toLocaleString("fr-FR")}</div>
                <div className="text-xs text-muted-foreground leading-tight">{k.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graphiques */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Événements par jour */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Activité quotidienne</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.dailySeries}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, name: string) => [v, name === "total" ? "Événements" : "Échecs"]} labelFormatter={d => `${d}`} />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="total" />
                  <Line type="monotone" dataKey="failures" stroke="#ef4444" strokeWidth={1.5} dot={false} name="failures" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Par sévérité */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Par sévérité</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.bySeverity.map(d => ({ name: SEVERITY_CONFIG[d.severity]?.label ?? d.severity, value: d.n }))}
                    cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelLine={false}
                    fontSize={10}>
                    {data.bySeverity.map((_, i) => <Cell key={i} fill={SEVERITY_COLORS_CHART[i % SEVERITY_COLORS_CHART.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top modules */}
          {data.byModule.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Modules les plus actifs</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.byModule.map(d => ({ name: MODULE_LABELS[d.module] ?? d.module, n: d.n }))} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="n" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top utilisateurs */}
          {data.topUsers.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Utilisateurs les plus actifs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {data.topUsers.map((u, i) => (
                    <div key={u.userId ?? i} className="flex items-center gap-3">
                      <div className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}</div>
                      <div className="flex-1 text-sm truncate">{u.userEmail}</div>
                      <div className="text-sm font-semibold">{u.n.toLocaleString("fr-FR")}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ligne de la liste ────────────────────────────────────────────────────────

function LogRow({ log, onDetail, onTimeline }: {
  log: AuditLog;
  onDetail: (l: AuditLog) => void;
  onTimeline: (userId: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 border rounded-md p-2.5 hover:bg-muted/30 cursor-pointer group"
      onClick={() => onDetail(log)}>
      <div className="text-xs text-muted-foreground w-34 shrink-0 mt-0.5 leading-tight">
        {fmt(log.createdAt)}
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <SeverityBadge severity={log.severity} />
        <StatusBadge status={log.status} />
      </div>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium leading-snug">{getDescription(log)}</div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground">{log.userEmail || "(système)"}</span>
          {log.userRole && <span>· {log.userRole}</span>}
          {log.module && <span>· {MODULE_LABELS[log.module] ?? log.module}</span>}
        </div>
        {log.changes && log.changes.length > 0 && (
          <div className="text-xs text-blue-600 mt-0.5">
            {log.changes.length} champ{log.changes.length > 1 ? "s" : ""} modifié{log.changes.length > 1 ? "s" : ""}
          </div>
        )}
        {log.errorMessage && (
          <div className="text-xs text-red-600 mt-0.5 truncate">{log.errorMessage}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {log.ipAddress && <div className="text-xs text-muted-foreground font-mono">{log.ipAddress}</div>}
        {log.device && <div className="text-xs text-muted-foreground flex items-center gap-1"><Monitor className="w-3 h-3" />{log.device}</div>}
        {log.userId && (
          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-xs opacity-0 group-hover:opacity-100"
            onClick={e => { e.stopPropagation(); onTimeline(log.userId!); }}>
            <Clock className="w-3 h-3 mr-1" />Timeline
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminAuditPage() {
  const [tab, setTab] = useState("events");
  const [quick, setQuick] = useState("_all");
  const [showFilters, setShowFilters] = useState(false);
  const [action, setAction] = useState("_all");
  const [severity, setSeverity] = useState("_all");
  const [status, setStatus] = useState("_all");
  const [module, setModule] = useState("_all");
  const [category, setCategory] = useState("_all");
  const [q, setQ] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [timelineUserId, setTimelineUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: orgUsersRaw } = useQuery({
    queryKey: ["users/list"],
    queryFn: (): Promise<any> => apiFetch("/api/users?limit=200"),
    staleTime: 5 * 60 * 1000,
  });
  const orgUsers: Array<{ id: string; email: string; firstName: string; lastName: string }> =
    Array.isArray(orgUsersRaw) ? orgUsersRaw : (orgUsersRaw?.data ?? []);

  const resetPage = useCallback(() => setPage(1), []);

  const params = new URLSearchParams();
  if (quick !== "_all") params.set("quick", quick);
  if (action !== "_all") params.set("action", action);
  if (severity !== "_all") params.set("severity", severity);
  if (status !== "_all") params.set("status", status);
  if (module !== "_all") params.set("module", module);
  if (category !== "_all") params.set("category", category);
  if (q) params.set("q", q);
  if (userEmail) params.set("userEmail", userEmail);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("page", String(page));
  params.set("limit", "25");

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ["admin/audit", quick, action, severity, status, module, category, q, userEmail, from, to, page],
    queryFn: () => apiFetch<AuditResponse>(`/api/admin/audit?${params.toString()}`),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const filters: Record<string, string> = {};
      if (quick !== "_all") filters.quick = quick;
      if (action !== "_all") filters.action = action;
      if (severity !== "_all") filters.severity = severity;
      if (q) filters.q = q;
      if (from) filters.from = from;
      if (to) filters.to = to;
      const res = await fetch("/api/admin/audit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ format, filters }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `audit-${Date.now()}.${format}`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const activeFiltersCount = [action, severity, status, module, category].filter(v => v !== "_all").length
    + (q ? 1 : 0) + (userEmail ? 1 : 0) + (from || to ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal d'audit</h1>
          <p className="text-muted-foreground mt-1">Traçabilité complète des activités — {total.toLocaleString("fr-FR")} événements</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />Actualiser
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exporting} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("xlsx")} disabled={exporting} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />Excel
          </Button>
        </div>
      </div>

      {/* Alertes de sécurité */}
      <SecurityAlertsSection />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="events" className="gap-1.5"><ClipboardList className="w-4 h-4" />Événements</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="w-4 h-4" />Tableau de bord</TabsTrigger>
        </TabsList>

        {/* ── ONGLET ÉVÉNEMENTS ── */}
        <TabsContent value="events" className="space-y-4">
          {/* Filtres rapides */}
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map(f => (
              <Button key={f.key} size="sm"
                variant={quick === f.key ? "default" : "outline"}
                className="gap-1.5 h-8 text-xs"
                onClick={() => { setQuick(f.key); resetPage(); }}>
                {f.icon}{f.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs ml-auto"
              onClick={() => setShowFilters(v => !v)}>
              <Filter className="w-3.5 h-3.5" />
              Filtres avancés
              {activeFiltersCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Panneau filtres avancés */}
          {showFilters && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px] relative">
                    <Label className="text-xs mb-1 block">Recherche</Label>
                    <Search className="absolute left-3 bottom-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={q} onChange={e => { setQ(e.target.value); resetPage(); }}
                      placeholder="Email, entité…" className="pl-8 h-8 text-sm" />
                  </div>
                  <div className="w-56">
                    <Label className="text-xs mb-1 block">Utilisateur</Label>
                    <Select value={userEmail || "_all"} onValueChange={v => { setUserEmail(v === "_all" ? "" : v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tous les utilisateurs" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Tous les utilisateurs</SelectItem>
                        {(orgUsers ?? []).map((u: { id: string; email: string; firstName: string; lastName: string }) => (
                          <SelectItem key={u.id} value={u.email}>
                            {u.firstName} {u.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-56">
                    <Label className="text-xs mb-1 block">Action</Label>
                    <Select value={action} onValueChange={v => { setAction(v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Toutes les actions" /></SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <SelectItem value="_all">Toutes les actions</SelectItem>
                        {ACTION_GROUPS.map(group => (
                          <SelectGroup key={group.key}>
                            <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
                              {group.label}
                            </SelectLabel>
                            <SelectItem value={group.key} className="text-xs font-medium pl-3">
                              ↳ Tout : {group.label}
                            </SelectItem>
                            {group.actions.map(a => (
                              <SelectItem key={a.key} value={a.key} className="text-xs pl-5">{a.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs mb-1 block">Sévérité</Label>
                    <Select value={severity} onValueChange={v => { setSeverity(v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Toutes</SelectItem>
                        {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs mb-1 block">Statut</Label>
                    <Select value={status} onValueChange={v => { setStatus(v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Tous</SelectItem>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-xs mb-1 block">Module</Label>
                    <Select value={module} onValueChange={v => { setModule(v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Tous les modules</SelectItem>
                        {Object.entries(MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs mb-1 block">Catégorie</Label>
                    <Select value={category} onValueChange={v => { setCategory(v); resetPage(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Toutes</SelectItem>
                        <SelectItem value="audit">Audit</SelectItem>
                        <SelectItem value="navigation">Navigation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div>
                      <Label className="text-xs mb-1 block">Du</Label>
                      <Input type="date" value={from} onChange={e => { setFrom(e.target.value); resetPage(); }} className="w-36 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Au</Label>
                      <Input type="date" value={to} onChange={e => { setTo(e.target.value); resetPage(); }} className="w-36 h-8 text-sm" />
                    </div>
                  </div>
                  {activeFiltersCount > 0 && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-destructive"
                      onClick={() => { setAction("_all"); setSeverity("_all"); setStatus("_all"); setModule("_all"); setCategory("_all"); setQ(""); setUserEmail(""); setFrom(""); setTo(""); setQuick("_all"); resetPage(); }}>
                      <X className="w-3.5 h-3.5" />Réinitialiser
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste + pagination */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  {total.toLocaleString("fr-FR")} événement{total !== 1 ? "s" : ""}
                </CardTitle>
                {pages > 1 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span>Page {page} / {pages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-3 pb-3 px-3">
              {isLoading && <div className="text-muted-foreground text-sm py-4 text-center">Chargement…</div>}
              <div className="space-y-1.5">
                {logs.map(l => (
                  <LogRow key={l.id} log={l}
                    onDetail={setDetailLog}
                    onTimeline={uid => setTimelineUserId(uid)} />
                ))}
                {!isLoading && logs.length === 0 && (
                  <div className="text-center text-muted-foreground py-10 text-sm">
                    Aucun événement ne correspond aux filtres sélectionnés.
                  </div>
                )}
              </div>
              {pages > 1 && (
                <div className="flex justify-center gap-3 pt-4 border-t mt-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground self-center">Page {page} sur {pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                    Suivant<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ONGLET DASHBOARD ── */}
        <TabsContent value="dashboard">
          <AuditDashboard />
        </TabsContent>
      </Tabs>

      {/* Panneau de détail */}
      {detailLog && <DetailPanel log={detailLog} onClose={() => setDetailLog(null)} />}

      {/* Timeline utilisateur */}
      {timelineUserId && <UserTimeline userId={timelineUserId} onClose={() => setTimelineUserId(null)} />}
    </div>
  );
}
