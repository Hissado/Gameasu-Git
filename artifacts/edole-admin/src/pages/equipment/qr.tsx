import React from "react";
import { useListEquipment } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EquipmentQRCodes() {
  const { data, isLoading } = useListEquipment();

  const print = () => window.print();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="flex items-start justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Étiquettes QR — Équipements</h1>
          <p className="text-sm text-muted-foreground mt-1">Étiquetage du parc matériel</p>
        </div>
        <Button onClick={print} className="bg-primary hover:bg-primary/90">
          <Printer className="w-4 h-4 mr-2" /> Imprimer
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border/50 no-print">
          <CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Étiquettes</CardTitle>
          <CardDescription>Chaque QR code contient l'identifiant unique de l'équipement, scannable pour accéder à sa fiche.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(data?.data || []).map((eq) => {
                const payload = JSON.stringify({ id: eq.id, code: eq.code, name: eq.name });
                return (
                  <div key={eq.id} className="border-2 border rounded-md p-4 flex flex-col items-center gap-2 break-inside-avoid">
                    <QRCodeSVG value={payload} size={140} level="M" />
                    <div className="text-center">
                      <div className="font-bold text-sm">{eq.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{eq.code || eq.id.substring(0, 8)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
