import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard, Building2, Ticket, AlertTriangle,
  ScrollText, Activity, LogOut, ChevronRight,
  BarChart3, Menu, Sparkles, Users, Mail, CreditCard,
  UserCircle, Briefcase, ClipboardList,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.FC<{ className?: string }>; badge?: number };
type NavSection = { label: string; items: NavItem[] };

function useNewAccessRequestsCount() {
  const { data } = useQuery<{ byStatus: Record<string, number> }>({
    queryKey: ["cockpit/access-requests/stats/badge"],
    queryFn: () => apiFetch("/api/cockpit/access-requests/stats"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data?.byStatus?.["new"] ?? 0;
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const newCount = useNewAccessRequestsCount();

  const NAV_SECTIONS: NavSection[] = [
    {
      label: "Vue d'ensemble",
      items: [
        { href: "/",             label: "Tableau de bord",    icon: LayoutDashboard },
        { href: "/reports",      label: "Rapports",           icon: BarChart3 },
      ],
    },
    {
      label: "Gestion SaaS",
      items: [
        { href: "/tenants",          label: "Organisations",      icon: Building2 },
        { href: "/subscriptions",    label: "Abonnements",        icon: CreditCard },
        { href: "/access-requests",  label: "Demandes d'accès",   icon: ClipboardList, badge: newCount },
        { href: "/expert-firms",     label: "Cabinets experts",   icon: Briefcase },
        { href: "/tickets",          label: "Tickets support",    icon: Ticket },
      ],
    },
    {
      label: "Opérations",
      items: [
        { href: "/incidents",    label: "Incidents",          icon: AlertTriangle },
        { href: "/monitoring",   label: "Monitoring",         icon: Activity },
        { href: "/emails",       label: "Emails envoyés",     icon: Mail },
        { href: "/custom-apps",  label: "Apps sur mesure",    icon: Sparkles },
      ],
    },
    {
      label: "Équipe & Sécurité",
      items: [
        { href: "/users",        label: "Équipe Cockpit",     icon: Users },
        { href: "/audit",        label: "Journal d'audit",    icon: ScrollText },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const initials = (() => {
    if (user?.firstName && user?.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    return (user?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  })();

  const displayName = user?.name?.trim() || user?.email || "Super Admin";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-tight tracking-tight">Gameasu</p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Cockpit Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto custom-scrollbar space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    }`}>
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-sidebar-primary" : "opacity-60"}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                      {active && !item.badge && <ChevronRight className="w-3 h-3 text-sidebar-primary opacity-60 shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-sidebar-border shrink-0 space-y-1">
        <Link href="/profile" onClick={() => setMobileOpen(false)}>
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${
            isActive("/profile") ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/40"
          }`}>
            <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-sidebar-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">Super Admin</p>
            </div>
            <UserCircle className={`w-3.5 h-3.5 shrink-0 ${isActive("/profile") ? "text-sidebar-primary" : "text-sidebar-foreground/30"}`} />
          </div>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-red-500/10 transition-colors group"
        >
          <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/40 group-hover:text-red-400" />
          <span className="text-xs text-sidebar-foreground/50 group-hover:text-red-400">Déconnexion</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background border-b">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Gameasu Cockpit</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
