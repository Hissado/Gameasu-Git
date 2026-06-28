import { Link } from "wouter";
import { BRANDING } from "@/config/branding";

export function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={BRANDING.appName}
      className="flex items-center justify-start px-3"
      style={{ height: 64 }}
    >
      <img
        src={BRANDING.logoFullTransparent}
        alt={BRANDING.appName}
        draggable={false}
        style={{
          height: 56,
          width: "auto",
          display: "block",
          userSelect: "none",
        }}
      />
    </Link>
  );
}
