import React from "react";
import { useListProformas } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ProformasList() {
  const { data, isLoading } = useListProformas();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "validated": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proformas</h1>
          <p className="text-muted-foreground mt-1">Manage proforma invoices</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proformas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading proformas...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No proformas found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((proforma) => (
                    <TableRow key={proforma.id}>
                      <TableCell className="font-medium">{proforma.referenceNumber}</TableCell>
                      <TableCell>{proforma.clientName || "—"}</TableCell>
                      <TableCell>{new Date(proforma.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${getStatusColor(proforma.status)}`}>
                          {proforma.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {proforma.currency || "$"} {proforma.totalAmount?.toLocaleString() || "0"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
