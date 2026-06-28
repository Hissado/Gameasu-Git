import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Loader2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function CollaboratorsRedirect() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["collaborators-redirect-first"],
    queryFn: () => apiFetch("/api/collaborators?limit=1"),
  });

  useEffect(() => {
    const firstId = data?.data?.[0]?.id;
    if (firstId) {
      setLocation(`/collaborators/${firstId}`, { replace: true });
    }
  }, [data, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoading && data?.data?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center text-muted-foreground">
        <UsersRound className="w-14 h-14 opacity-20" />
        <p className="text-lg font-semibold text-foreground">Aucun collaborateur</p>
        <p className="text-sm max-w-xs">
          Commencez par ajouter votre premier collaborateur pour accéder aux profils.
        </p>
        <Link href="/hr">
          <Button variant="outline">Retour à l'équipe &amp; RH</Button>
        </Link>
      </div>
    );
  }

  return null;
}
