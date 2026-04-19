import React from "react";
import { useGetRental, getGetRentalQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RentalDetail() {
  const [, params] = useRoute("/rentals/:id");
  const id = params?.id || "";
  
  const { data: rental, isLoading } = useGetRental(id, {
    query: { enabled: !!id, queryKey: getGetRentalQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading rental details...</div>;
  }

  if (!rental) {
    return <div className="p-8 text-center text-muted-foreground">Rental not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rental {rental.referenceNumber}</h1>
          <p className="text-muted-foreground mt-1">Client: {rental.clientName || "—"}</p>
        </div>
        <Badge variant="outline" className="capitalize px-3 py-1 text-sm">{rental.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Equipment Items</CardTitle>
          </CardHeader>
          <CardContent>
            {rental.items && rental.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Daily Rate</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rental.items.map((item) => (
                    <TableRow key={item.equipmentId}>
                      <TableCell className="font-medium">{item.equipmentName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.dailyRate}</TableCell>
                      <TableCell className="text-right font-medium">${item.subtotal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No items associated with this rental.</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Rental Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Start Date</div>
              <div className="font-medium">{new Date(rental.startDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">End Date</div>
              <div className="font-medium">{new Date(rental.endDate).toLocaleDateString()}</div>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">Total Cost</div>
              <div className="text-2xl font-bold text-primary">${rental.totalCost?.toLocaleString() || "0"}</div>
            </div>
            {rental.notes && (
              <div className="pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground mb-1">Notes</div>
                <div className="text-sm">{rental.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
