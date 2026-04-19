import React from "react";
import { useListCallSessions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneCall, Plus } from "lucide-react";

export default function CallsList() {
  const { data, isLoading } = useListCallSessions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-gray-100 text-gray-800";
      case "missed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Sessions</h1>
          <p className="text-muted-foreground mt-1">Log of all incoming and outgoing calls</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PhoneCall className="w-4 h-4 mr-2" />
          Start Call
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading calls...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiator</TableHead>
                  <TableHead>Duration (s)</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No call sessions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {call.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`capitalize ${getStatusColor(call.status)}`}>
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{call.initiatorName || "—"}</TableCell>
                      <TableCell>{call.durationSeconds || "—"}</TableCell>
                      <TableCell>{new Date(call.createdAt).toLocaleString()}</TableCell>
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
