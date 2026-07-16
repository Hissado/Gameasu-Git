/**
 * Phase 22 — Quick-actions mobile-first.
 *
 * Hub d'actions rapides pour usage terrain mobile : pointage, briefing,
 * recherche, créer tâche, mes tâches du jour, anomalies, approbations.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Sun, Search, Sparkles, CheckSquare, Activity, Bell, ClipboardList,
  Flame, MessageSquare, MapPin, Plus,
} from "lucide-react";
import { useClockMutation, useMyAttendanceToday } from "@/lib/attendance";

function Tile({ to, icon: Icon, label, sub, accent }: { to: string; icon: any; label: string; sub?: string; accent?: string }) {
  return (
    <Link href={to}>
      <Card className="cursor-pointer hover:shadow-md transition active:scale-[0.97]">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{label}</p>
            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function QuickActions() {
  const today = useMyAttendanceToday();
  const clock = useClockMutation();
  const approvals = useQuery<any>({ queryKey: ["qa-approvals"], queryFn: () => apiFetch("/api/approvals/queue") });
  const anomalies = useQuery<any>({ queryKey: ["qa-anomalies"], queryFn: () => apiFetch("/api/anomalies/scan") });
  const digest = useQuery<any>({ queryKey: ["qa-digest"], queryFn: () => apiFetch("/api/notifications/digest") });

  const session = today.data?.session;
  const isCheckedIn = session?.status === "open" && session?.clockInAt && !session?.clockOutAt;

  const onClock = async (type: "clock-in" | "clock-out") => {
    try {
      let geo: any = {};
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
        });
        geo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyMeters: pos.coords.accuracy };
      } catch {}
      await clock.mutateAsync({ type, ...geo });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Accès rapide</p>
        <h1 className="text-2xl font-bold tracking-tight">Que voulez-vous faire ?</h1>
      </div>

      {/* Pointage proéminent */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <p className="font-bold">Pointage</p>
            </div>
            {session && <Badge variant="outline" className={isCheckedIn ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted/50"}>{isCheckedIn ? "Présent" : session.status === "closed" ? "Journée close" : "Hors site"}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={clock.isPending || !!isCheckedIn}
              onClick={() => onClock("clock-in")}
              className="rounded-lg border-2 border-primary bg-primary text-primary-foreground px-3 py-3 font-bold text-sm disabled:opacity-50 active:scale-[0.97]">
              <MapPin className="w-4 h-4 inline mr-1" />Arrivée
            </button>
            <button
              disabled={clock.isPending || !isCheckedIn || !session}
              onClick={() => onClock("clock-out")}
              className="rounded-lg border-2 border bg-slate-700 text-white px-3 py-3 font-bold text-sm disabled:opacity-50 active:scale-[0.97]">
              Départ
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Cockpit du jour */}
      <div className="grid grid-cols-2 gap-2">
        <Tile to="/briefing" icon={Sun} label="Briefing du jour" accent="bg-amber-100 text-amber-700" />
        <Tile to="/assistant" icon={Sparkles} label="Assistant IA" accent="bg-violet-100 text-violet-700" />
        <Tile to="/recherche" icon={Search} label="Recherche" accent="bg-blue-100 text-blue-700" />
        <Tile to="/notifications/synthese" icon={Bell} label="Digest" sub={digest.data?.totalUnread ? `${digest.data.totalUnread} non lus` : undefined} accent="bg-rose-100 text-rose-700" />
      </div>

      {/* Tâches & opérations */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold mb-2">Opérations</p>
        <div className="grid grid-cols-2 gap-2">
          <Tile to="/tasks/focus" icon={Flame} label="Focus tâches" accent="bg-red-100 text-red-700" />
          <Tile to="/tasks" icon={ClipboardList} label="Toutes mes tâches" />
          <Tile to="/approbations" icon={CheckSquare} label="Approbations" sub={approvals.data?.total ? `${approvals.data.total} à traiter` : undefined} accent="bg-emerald-100 text-emerald-700" />
          <Tile to="/anomalies" icon={Activity} label="Anomalies" sub={anomalies.data?.total ? `${anomalies.data.total} détectées` : undefined} accent="bg-orange-100 text-orange-700" />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold mb-2">Communication</p>
        <div className="grid grid-cols-2 gap-2">
          <Tile to="/messaging" icon={MessageSquare} label="Messagerie" />
          <Tile to="/tasks/new" icon={Plus} label="Créer une tâche" accent="bg-primary/10 text-primary" />
        </div>
      </div>
    </div>
  );
}
