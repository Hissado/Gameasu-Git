import { Construction } from "lucide-react";
import { Link } from "wouter";

interface Props {
  title: string;
  description?: string;
}

export function AchatsPlaceholder({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
        <Construction className="w-7 h-7 text-orange-600" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {description ?? "Cette section est en cours de développement et sera disponible prochainement."}
      </p>
      <Link href="/achats" className="text-sm text-orange-600 hover:underline font-medium">
        ← Retour à la vue d'ensemble Achats
      </Link>
    </div>
  );
}

export default function AchatsPlaceholderPage() {
  return <AchatsPlaceholder title="Section en cours de développement" />;
}
