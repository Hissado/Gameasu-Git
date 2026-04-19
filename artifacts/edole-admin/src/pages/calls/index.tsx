import React from "react";
import { useListCallSessions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneCall, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "En cours", cls: "bg-green-50 text-green-700 border-green-200" },
  completed: { label: "Terminé", cls: "bg-muted text-muted-foreground border-border" },
  missed: { label: "Manqué", cls: "bg-red-50 text-red-700 border-red-200" },
  ringing: { label: "Sonnerie", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const TYPE_LABEL: Record<string, string> = {
  audio: "Audio",
  video: "Vidéo",
  conference: "Conférence",
};

const formatDuration = (s?: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}min ${r.toString().padStart(2, "0")}s`;
};

export default function CallsList() {
  const { data, isLoading } = useListCallSessions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historique des appels</h1>
          <p className="text-muted-foreground mt-1">Journal des communications audio et vidéo internes</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PhoneCall className="w-4 h-4 mr-2" />
          Démarrer un appel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions enregistrées</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des appels…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Initiateur</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Date et heure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun appel enregistré pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((call: any) => {
                    const st = STATUS_LABEL[call.status] || { label: call.status, cls: "bg-muted text-muted-foreground" };
                    return (
                      <TableRow key={call.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">{TYPE_LABEL[call.type] || call.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{call.initiatorName || "—"}</TableCell>
                        <TableCell className="text-sm">{formatDuration(call.durationSeconds)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(call.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
