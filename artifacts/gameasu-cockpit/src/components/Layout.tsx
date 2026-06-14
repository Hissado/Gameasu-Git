import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Building2, Ticket, AlertTriangle,
  ScrollText, Activity, LogOut, Shield, ChevronRight,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.FC<{ className?: string }> };

const NAV: NavItem[] = [
  { href: "/",          label: "Tableau de bord",  icon: LayoutDashboard },
  { href: "/tenants",   label: "Organisations",     icon: Building2 },
  { href: "/tickets",   label: "Tickets support",   icon: Ticket },
  { href: "/incidents", label: "Incidents",         icon: AlertTriangle },
  { href: "/audit",     label: "Journal d'audit",   icon: ScrollText },
  { href: "/monitoring",label: "Monitoring",        icon: Activity },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground leading-tight">Gaméasù</p>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Cockpit Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-sidebar-primary" : "opacity-70"}`} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 text-sidebar-primary opacity-70" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-sidebar-accent/40">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {user?.name?.[0]?.toUpperCase() ?? user?.email[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? user?.email}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">Super Admin</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto p-1 rounded hover:bg-sidebar-accent transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/50 hover:text-sidebar-foreground" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
