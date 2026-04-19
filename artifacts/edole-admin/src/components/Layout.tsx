import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Briefcase,
  Wrench,
  Truck,
  ClipboardCheck,
  ShoppingCart,
  FileText,
  CreditCard,
  MessageSquare,
  PhoneCall,
  Settings,
  Bell,
  Search,
  UserCircle,
  LogOut
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_GROUPS = [
  {
    title: "Dashboard",
    items: [
      { name: "Overview", path: "/", icon: LayoutDashboard },
    ]
  },
  {
    title: "Operations",
    items: [
      { name: "Projects", path: "/projects", icon: FolderKanban },
      { name: "Tasks", path: "/tasks", icon: CheckSquare },
      { name: "Equipment", path: "/equipment", icon: Wrench },
      { name: "Rentals", path: "/rentals", icon: Truck },
      { name: "Inspections", path: "/inspections", icon: ClipboardCheck },
      { name: "Logistics", path: "/logistics", icon: Truck },
    ]
  },
  {
    title: "CRM & HR",
    items: [
      { name: "CRM Home", path: "/crm", icon: Briefcase },
      { name: "Collaborators", path: "/collaborators", icon: Users },
      { name: "Users", path: "/users", icon: UserCircle },
    ]
  },
  {
    title: "Finance",
    items: [
      { name: "Orders", path: "/orders", icon: ShoppingCart },
      { name: "Proformas", path: "/proformas", icon: FileText },
      { name: "Invoices", path: "/invoices", icon: FileText },
      { name: "Payments", path: "/payments", icon: CreditCard },
    ]
  },
  {
    title: "Communication",
    items: [
      { name: "Messaging", path: "/messaging", icon: MessageSquare },
      { name: "Calls", path: "/calls", icon: PhoneCall },
    ]
  }
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center text-sidebar-primary-foreground font-bold">
            E
          </div>
          <span className="font-bold tracking-wider text-sm">EDOLE ADMIN</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="mb-6 px-4">
              <h3 className="text-xs font-semibold text-sidebar-foreground/50 mb-2 uppercase tracking-wider px-2">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item, j) => {
                  const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <li key={j}>
                      <Link
                        href={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center text-muted-foreground bg-muted rounded-md px-3 py-1.5 w-64 focus-within:ring-2 focus-within:ring-ring transition-shadow">
            <Search className="w-4 h-4 mr-2" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-4">
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card"></span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center outline-none">
                  <Avatar className="w-8 h-8 border border-border">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">AD</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
