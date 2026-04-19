import React from "react";
import { useListLogisticsOperations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function LogisticsList() {
  const { data, isLoading } = useListLogisticsOperations();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-yellow-100 text-yellow-800";
      case "in_transit": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics</h1>
          <p className="text-muted-foreground mt-1">Track deliveries and pickups</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logistics Operations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading logistics...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No logistics operations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {op.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${getStatusColor(op.status)}`}>
                          {op.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{op.responsibleName || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={op.address}>
                        {op.address || "—"}
                      </TableCell>
                      <TableCell>{op.scheduledAt ? new Date(op.scheduledAt).toLocaleDateString() : "—"}</TableCell>
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
