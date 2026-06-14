import React, { useRef, useState } from "react";
import { useGetRental, getGetRentalQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Calendar, Building, Download, PlaySquare } from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";


export default function RentalDetail() {
  const [, params] = useRoute("/rentals/:id");
  const id = params?.id || "";
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: rental, isLoading } = useGetRental(id, {
    query: { enabled: !!id, queryKey: getGetRentalQueryKey(id) }
  });

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1 text-sm">En cours</Badge>;
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 px-3 py-1 text-sm">En attente</Badge>;
      case "confirmed": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 px-3 py-1 text-sm">Confirmé</Badge>;
      case "returned": return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 px-3 py-1 text-sm">Retourné</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 px-3 py-1 text-sm">Annulé</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64 col-span-1" />
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Contrat introuvable</h2>
        <Link href="/rentals"><Button className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour aux locations</Button></Link>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
           <Link href="/rentals">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0">
              <ArrowLeft className="w-4 h-4" />
              Locations
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              Contrat <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md">{rental.referenceNumber}</span>
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building className="w-4 h-4" /> Client: <span className="font-bold text-foreground">{rental.clientName || "Non assigné"}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {getStatusBadge(rental.status)}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={async () => { if (!contentRef.current) return; setSaving(true); try { const { saveDivAsPdf } = await import("@/lib/pdf"); await saveDivAsPdf(contentRef.current, `location-${id}-${new Date().toISOString().slice(0,10)}.pdf`); } finally { setSaving(false); } }}><Download className="w-4 h-4 mr-2"/> {saving ? "PDF…" : "Enregistrer PDF"}</Button>
            {rental.status === 'pending' && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"><PlaySquare className="w-4 h-4 mr-2"/> Démarrer</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 shadow-sm border-border">
          <CardHeader className="bg-slate-50/50 border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Équipements Loués</CardTitle>
            <CardDescription>Détail de la flotte engagée sur ce contrat</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rental.items && rental.items.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-600">Désignation Matériel</TableHead>
                    <TableHead className="text-center font-semibold text-slate-600">Qté</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Tarif Journalier</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Sous-total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rental.items.map((item) => (
                    <TableRow key={item.equipmentId} className="hover:bg-slate-50/30">
                      <TableCell className="font-bold text-slate-800">{item.equipmentName}</TableCell>
                      <TableCell className="text-center font-medium bg-slate-50 border-x border-border/30">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-600">{formatFCFA(item.dailyRate)}</TableCell>
                      <TableCell className="text-right font-bold text-primary bg-primary/5">{formatFCFA(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12">Aucun équipement lié à ce contrat.</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm border-border h-fit">
          <CardHeader className="bg-slate-50/50 border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Synthèse Financière</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
               <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
               <div className="w-full">
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Début</span>
                   <span className="font-bold text-sm">{formatDate(rental.startDate)}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fin</span>
                   <span className="font-bold text-sm">{formatDate(rental.endDate)}</span>
                 </div>
                 <div className="mt-2 text-right text-xs font-medium text-slate-500">
                   Durée totale: <span className="text-slate-800 font-bold ml-1">
                     {Math.max(1, Math.ceil((new Date(rental.endDate).getTime() - new Date(rental.startDate).getTime()) / (1000 * 60 * 60 * 24)))} jours
                   </span>
                 </div>
               </div>
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Coût Total Estimé</div>
              <div className="text-3xl font-bold text-primary tracking-tight">{formatFCFA(rental.totalCost)}</div>
            </div>
            
            {rental.notes && (
              <div className="pt-4 border-t border-border">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes Opérationnelles</div>
                <div className="text-sm text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-100 italic">{rental.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}