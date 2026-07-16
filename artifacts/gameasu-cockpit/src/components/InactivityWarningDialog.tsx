import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const WARNING_SECONDS = 2 * 60;

export function InactivityWarningDialog() {
  const { showInactivityWarning, extendSession, logout } = useAuth();
  const [remaining, setRemaining] = useState(WARNING_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (showInactivityWarning) {
      setRemaining(WARNING_SECONDS);
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRemaining(WARNING_SECONDS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [showInactivityWarning]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const countdown = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <Dialog open={showInactivityWarning}>
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            Session bientôt expirée
          </DialogTitle>
          <DialogDescription className="pt-1 space-y-1">
            <span className="block">
              Votre session Cockpit va expirer dans{" "}
              <span className="font-semibold text-foreground tabular-nums">{countdown}</span>{" "}
              en raison d'une période d'inactivité.
            </span>
            <span className="block text-xs">
              Enregistrez votre travail ou restez connecté.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Se déconnecter maintenant
          </Button>
          <Button size="sm" onClick={() => extendSession()}>
            Rester connecté
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
