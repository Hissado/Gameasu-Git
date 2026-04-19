import React from "react";
import { useListInspections } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function InspectionsList() {
  const { data, isLoading } = useListInspections();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inspections</h1>
          <p className="text-muted-foreground mt-1">Equipment departure and return inspections</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inspection Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading inspections...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rental ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Conducted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Disputes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No inspections found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-medium">{inspection.rentalId.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {inspection.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{inspection.conductedByName || "—"}</TableCell>
                      <TableCell>{new Date(inspection.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {inspection.hasDispute ? (
                          <Badge variant="destructive">Dispute Reported</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">Clear</Badge>
                        )}
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
