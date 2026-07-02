import React from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, mediaUrl } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, CheckCircle2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";

type InspectionDetail = {
  id: string;
  type: string;
  notes: string | null;
  hasDispute: boolean;
  disputeNotes: string | null;
  retentionAmount: number | null;
  photos: string[];
  conductedByName: string | null;
  createdAt: string;
};

type CompareData = {
  rentalId: string;
  departure: InspectionDetail | null;
  returnInspection: InspectionDetail | null;
  all: InspectionDetail[];
};

function InspectionPanel({ title, data, color }: { title: string; data: InspectionDetail | null; color: string }) {
  if (!data) {
    return (
      <Card className={`border-2 border-dashed ${color}`}>
        <CardContent className="py-12 text-center">
          <Camera className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-muted-foreground">{title} — Non encore réalisée</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className={`border-b border-border/50 ${color}`}>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          {data.hasDispute && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertTriangle className="w-3 h-3 mr-1" /> Litige
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{formatDate(data.createdAt)} — {data.conductedByName || "Inspecteur inconnu"}</CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {data.notes && (
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Observations</div>
            <p className="text-sm">{data.notes}</p>
          </div>
        )}
        <div>
          <div className="text-xs font-bold uppercase text-slate-500 mb-2">Photos ({data.photos?.length || 0})</div>
          {data.photos && data.photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {data.photos.map((url, i) => (
                <a key={i} href={mediaUrl(url)} target="_blank" rel="noreferrer" className="block aspect-square border border-border rounded overflow-hidden bg-slate-50">
                  <img src={mediaUrl(url)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucune photo enregistrée</p>
          )}
        </div>
        {data.hasDispute && data.disputeNotes && (
          <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
            <div className="text-xs font-bold uppercase text-red-700 mb-1">Détails du litige</div>
            <p className="text-sm text-red-900">{data.disputeNotes}</p>
            {data.retentionAmount && (
              <p className="text-sm font-bold text-red-900 mt-2">Retenue : {formatFCFA(data.retentionAmount)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InspectionCompare() {
  const [, params] = useRoute("/inspections/comparer/:rentalId");
  const rentalId = params?.rentalId || "";
  const { data, isLoading } = useQuery<CompareData>({
    queryKey: ["compare-inspections", rentalId],
    queryFn: () => apiFetch(`/api/rentals/${rentalId}/inspections`),
    enabled: !!rentalId,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/inspections"><Button variant="outline" size="sm" className="h-8 gap-1.5"><ArrowLeft className="w-4 h-4" />Inspections</Button></Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comparaison des états des lieux</h1>
          <p className="text-sm text-muted-foreground mt-1">Contrat : <span className="font-mono">{rentalId.substring(0, 8).toUpperCase()}</span></p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InspectionPanel title="État des lieux — Départ" data={data?.departure || null} color="bg-blue-50" />
            <InspectionPanel title="État des lieux — Retour" data={data?.returnInspection || null} color="bg-purple-50" />
          </div>

          {data?.departure && data?.returnInspection && (
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>Synthèse comparative</CardTitle>
              </CardHeader>
              <CardContent>
                {data.returnInspection.hasDispute ? (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex items-center gap-2 font-bold text-red-700 mb-2">
                      <AlertTriangle className="w-5 h-5" /> Litige ouvert sur ce contrat
                    </div>
                    <p className="text-sm text-red-900">{data.returnInspection.disputeNotes || "Aucune note détaillée"}</p>
                    {data.returnInspection.retentionAmount && (
                      <p className="text-sm font-bold text-red-900 mt-2">Montant retenu : {formatFCFA(data.returnInspection.retentionAmount)}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Aucune anomalie constatée — restitution conforme.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
