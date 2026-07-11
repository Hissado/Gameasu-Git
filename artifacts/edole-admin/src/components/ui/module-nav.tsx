import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── URL-routing nav types (ModuleShell) ─────────────────────────
export interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  locked?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── State-driven nav types (VerticalTabsShell) ───────────────────
export interface TabItem {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface TabNavGroup {
  label?: string;
  items: TabItem[];
}

// ── Shared helpers ───────────────────────────────────────────────

function itemIsActive(item: NavItem, location: string) {
  return item.exact
    ? location === item.path
    : location === item.path || location.startsWith(item.path + "/");
}

// ── URL-routing sidebar ──────────────────────────────────────────

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
              if (item.locked) {
                return (
                  <Link
                    key={item.path}
                    href="/abonnement"
                    className="flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12.5px] font-medium transition-all leading-tight text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                  >
                    <item.icon className="w-[13px] h-[13px] shrink-0 opacity-40" />
                    <span className="truncate">{item.name}</span>
                    <Lock className="w-[10px] h-[10px] ml-auto shrink-0 opacity-50" />
                  </Link>
                );
              }
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
                  if (item.locked) {
                    return (
                      <Link
                        key={item.path}
                        href="/abonnement"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                      >
                        <item.icon className="w-[14px] h-[14px] shrink-0 opacity-40" />
                        <span>{item.name}</span>
                        <Lock className="w-3 h-3 ml-auto shrink-0 opacity-50" />
                      </Link>
                    );
                  }
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

// ── State-driven sidebar ─────────────────────────────────────────

function TabNavSidebar({ tabGroups, value, onChange }: {
  tabGroups: TabNavGroup[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <aside className="w-48 shrink-0 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-0.5 space-y-4">
      {tabGroups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 mb-1.5 select-none">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange(item.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-[7px] rounded-lg text-[12.5px] font-medium transition-all leading-tight",
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-[13px] h-[13px] shrink-0" />
                  <span className="truncate text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function MobileTabsDropdown({ tabGroups, value, onChange }: {
  tabGroups: TabNavGroup[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allItems = tabGroups.flatMap(g => g.items);
  const activeItem = allItems.find(i => i.value === value);

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {activeItem && <activeItem.icon className="w-4 h-4 text-primary shrink-0" />}
          <span className="truncate">{activeItem?.label ?? "Navigation"}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl p-2 space-y-3 max-h-[65vh] overflow-y-auto">
          {tabGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 pb-1 select-none">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = item.value === value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => { onChange(item.value); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="w-[14px] h-[14px] shrink-0" />
                      <span>{item.label}</span>
                    </button>
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

// ── ModuleShell (URL routing) ────────────────────────────────────

interface ModuleShellProps {
  title: string;
  subtitle?: string;
  titleIcon?: React.ComponentType<{ className?: string }>;
  navGroups: NavGroup[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ModuleShell({
  title, subtitle, titleIcon: TitleIcon, navGroups, actions, children,
}: ModuleShellProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {TitleIcon && <TitleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />}
            <span className="leading-tight">{title}</span>
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-snug">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>

      <div className="lg:hidden">
        <MobileNavDropdown navGroups={navGroups} />
      </div>

      <div className="hidden lg:flex gap-6 items-start">
        <NavSidebar navGroups={navGroups} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      <div className="lg:hidden">
        {children}
      </div>
    </div>
  );
}

// ── VerticalTabsShell (state-driven) ────────────────────────────

interface VerticalTabsShellProps {
  tabGroups: TabNavGroup[];
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

export function VerticalTabsShell({ tabGroups, value, onChange, children }: VerticalTabsShellProps) {
  return (
    <>
      <div className="lg:hidden mb-4">
        <MobileTabsDropdown tabGroups={tabGroups} value={value} onChange={onChange} />
      </div>
      <div className="hidden lg:flex gap-6 items-start">
        <TabNavSidebar tabGroups={tabGroups} value={value} onChange={onChange} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      <div className="lg:hidden">{children}</div>
    </>
  );
}
