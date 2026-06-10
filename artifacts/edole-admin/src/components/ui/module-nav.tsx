import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface ModuleShellProps {
  title: string;
  subtitle?: string;
  titleIcon?: React.ComponentType<{ className?: string }>;
  navGroups: NavGroup[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function itemIsActive(item: NavItem, location: string) {
  return item.exact
    ? location === item.path
    : location === item.path || location.startsWith(item.path + "/");
}

function NavSidebar({ navGroups }: { navGroups: NavGroup[] }) {
  const [location] = useLocation();
  return (
    <aside className="w-48 shrink-0 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-0.5 space-y-4">
      {navGroups.map(group => (
        <div key={group.label}>
          <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 mb-1.5 select-none">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = itemIsActive(item, location);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12.5px] font-medium transition-all leading-tight",
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-[13px] h-[13px] shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function MobileNavDropdown({ navGroups }: { navGroups: NavGroup[] }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const allItems = navGroups.flatMap(g => g.items);
  const activeItem = allItems.find(i => itemIsActive(i, location));

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {activeItem && <activeItem.icon className="w-4 h-4 text-primary shrink-0" />}
          <span className="truncate">{activeItem?.name ?? "Navigation"}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl p-2 space-y-3 max-h-[65vh] overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 pb-1 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = itemIsActive(item, location);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="w-[14px] h-[14px] shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModuleShell({
  title, subtitle, titleIcon: TitleIcon, navGroups, actions, children,
}: ModuleShellProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* En-tête du module */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            {TitleIcon && <TitleIcon className="w-7 h-7 text-primary shrink-0" />}
            <span>{title}</span>
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>

      {/* Navigation mobile (dropdown) */}
      <div className="lg:hidden">
        <MobileNavDropdown navGroups={navGroups} />
      </div>

      {/* Layout desktop : sidebar gauche + contenu */}
      <div className="hidden lg:flex gap-6 items-start">
        <NavSidebar navGroups={navGroups} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* Contenu mobile */}
      <div className="lg:hidden">
        {children}
      </div>
    </div>
  );
}
