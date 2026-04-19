import React from "react";
import { useListPayments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PaymentsList() {
  const { data, isLoading } = useListPayments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">Track received payments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading payments...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {payment.invoiceId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {payment.method.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{payment.reference || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {payment.currency || "$"} {payment.amount.toLocaleString()}
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
