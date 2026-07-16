import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock, LogIn, LogOut, Coffee, PlayCircle,
  ChevronRight, Loader2, CheckCircle2, UserX,
} from "lucide-react";
import {
  useMyAttendanceToday, useClockMutation,
  captureGeolocation, formatMinutes,
} from "@/lib/attendance";
import { toast } from "sonner";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function useElapsedLabel(sinceIso: string | null | undefined): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sinceIso) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [sinceIso]);
  void tick;
  if (!sinceIso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60_000));
  return formatMinutes(mins);
}

export function QuickClockWidget() {
  const { data, isLoading } = useMyAttendanceToday();
  const clock = useClockMutation();

  const session        = data?.session;
  const records        = data?.records ?? [];
  const collaborator   = data?.collaborator ?? null;
  const clockInRec     = records.find(r => r.kind === "clock_in");
  const clockOutRec    = [...records].reverse().find(r => r.kind === "clock_out");
  const lastKind       = records[records.length - 1]?.kind;

  const isClosed      = session?.status === "closed";
  const onBreak       = lastKind === "break_start";
  const canClockIn    = collaborator !== null && !records.some(r => r.kind === "clock_in");
  const isActive      = collaborator !== null && !!session && !isClosed && !!clockInRec;
  const canClockOut   = isActive && !onBreak;
  const canBreakStart = isActive && !onBreak;
  const canBreakEnd   = onBreak;

  const elapsed = useElapsedLabel(isActive ? clockInRec?.occurredAt : null);

  async function handleClock(kind: "clock_in" | "clock_out" | "break_start" | "break_end") {
    const geo = await captureGeolocation();
    try {
      await clock.mutateAsync({
        kind,
        latitude:       geo?.latitude,
        longitude:      geo?.longitude,
        accuracyMeters: geo?.accuracyMeters,
      });
      const labels: Record<string, string> = {
        clock_in:    "Arrivée pointée avec succès",
        clock_out:   "Départ pointé avec succès",
        break_start: "Pause enregistrée",
        break_end:   "Reprise enregistrée",
      };
      toast.success(labels[kind] ?? "Pointage enregistré");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du pointage";
      toast.error(msg);
    }
  }

  // ── Status ───────────────────────────────────────────────────
  let statusNode: React.ReactNode;
  let dotColor = "bg-slate-300";

  if (isLoading) {
    statusNode = <span className="text-xs text-muted-foreground">Chargement…</span>;
  } else if (collaborator === null) {
    dotColor = "bg-muted";
    statusNode = (
      <span className="text-xs text-muted-foreground">
        Aucun profil collaborateur lié à ce compte.
      </span>
    );
  } else if (isClosed) {
    dotColor = "bg-slate-400";
    statusNode = (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-muted text-muted-foreground border border font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Journée clôturée
        </Badge>
        <span className="text-xs text-muted-foreground">
          {fmtTime(clockInRec?.occurredAt)} → {fmtTime(clockOutRec?.occurredAt)}
        </span>
      </div>
    );
  } else if (onBreak) {
    dotColor = "bg-amber-400 animate-pulse";
    statusNode = (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-medium">
          <Coffee className="w-3 h-3 mr-1" /> En pause
        </Badge>
        <span className="text-xs text-muted-foreground">Arrivée {fmtTime(clockInRec?.occurredAt)}</span>
      </div>
    );
  } else if (isActive) {
    dotColor = "bg-emerald-500 animate-pulse";
    statusNode = (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
          En service
        </Badge>
        <span className="text-xs text-muted-foreground">
          depuis {fmtTime(clockInRec?.occurredAt)}
        </span>
      </div>
    );
  } else {
    dotColor = "bg-slate-300";
    statusNode = (
      <Badge variant="outline" className="text-muted-foreground font-medium">
        Non pointé
      </Badge>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Pointage du jour</span>
        </div>
        <Link
          href="/presences"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Voir tout <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <CardContent className="p-5">
        {/* ── Status row ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
            <div>{statusNode}</div>
          </div>

          {/* Live timer */}
          {isActive && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground leading-none">
                {elapsed}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">en service</p>
            </div>
          )}
        </div>

        {/* ── Action buttons ─────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">

          {/* No collaborator profile */}
          {!isLoading && collaborator === null && (
            <div className="flex items-center gap-2 w-full py-0.5">
              <UserX className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                Le pointage nécessite un profil collaborateur.{" "}
                <Link href="/presences" className="text-primary hover:underline">
                  Accéder à Présence &amp; Pointage →
                </Link>
              </p>
            </div>
          )}

          {/* Clock In */}
          {canClockIn && (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 min-w-[140px]"
              onClick={() => handleClock("clock_in")}
              disabled={clock.isPending}
            >
              {clock.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LogIn className="w-4 h-4" />}
              Pointer l'arrivée
            </Button>
          )}

          {/* Break start */}
          {canBreakStart && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => handleClock("break_start")}
              disabled={clock.isPending}
            >
              <Coffee className="w-4 h-4" />
              Pause
            </Button>
          )}

          {/* Break end */}
          {canBreakEnd && (
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90 text-white flex-1 min-w-[160px]"
              onClick={() => handleClock("break_end")}
              disabled={clock.isPending}
            >
              {clock.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <PlayCircle className="w-4 h-4" />}
              Reprendre le travail
            </Button>
          )}

          {/* Clock Out */}
          {canClockOut && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 flex-1 min-w-[140px]"
              onClick={() => handleClock("clock_out")}
              disabled={clock.isPending}
            >
              {clock.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LogOut className="w-4 h-4" />}
              Pointer le départ
            </Button>
          )}

          {/* Day closed */}
          {!isLoading && isClosed && (
            <p className="text-xs text-muted-foreground text-center w-full py-1">
              Journée enregistrée ✓ ·{" "}
              <Link href="/presences" className="text-primary hover:underline">
                Consulter le détail
              </Link>
            </p>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Chargement du statut…
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
