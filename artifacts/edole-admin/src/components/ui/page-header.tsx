import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          {Icon && <Icon className="w-7 h-7 text-primary shrink-0" />}
          <span>{title}</span>
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

interface StatusTabsProps<T extends string> {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}

export function StatusTabs<T extends string>({ tabs, active, onChange, className }: StatusTabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-0.5 overflow-x-auto", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium rounded-lg whitespace-nowrap transition-all",
            active === tab.key
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className={cn(
              "text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1",
              active === tab.key ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
