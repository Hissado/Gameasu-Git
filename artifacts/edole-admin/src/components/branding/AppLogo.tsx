import { BRANDING } from "@/config/branding";

export function AppLogo({ className = "h-8", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={showWordmark ? BRANDING.logoFull : BRANDING.logoMark} alt={BRANDING.appName} className={className} draggable={false} />
    </span>
  );
}

export function AppWordmark({ className = "text-xl font-bold tracking-tight" }: { className?: string }) {
  return <span className={className}>{BRANDING.appName}</span>;
}

export function AppTagline({ lang = "fr", className = "text-sm text-muted-foreground" }: { lang?: "fr" | "en"; className?: string }) {
  return <span className={className}>{lang === "fr" ? BRANDING.appTaglineFr : BRANDING.appTaglineEn}</span>;
}
