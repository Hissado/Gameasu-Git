import { Lock } from "lucide-react";
import { usePermissions } from "@/lib/permissions";

export function ReadOnlyBanner() {
  const perms = usePermissions();
  if (!perms.isReadOnly) return null;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium">
      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
      <span>
        <strong>Mode Lecture Seule</strong> — En tant qu'auditeur, vous pouvez consulter les données mais pas les modifier.
      </span>
    </div>
  );
}
