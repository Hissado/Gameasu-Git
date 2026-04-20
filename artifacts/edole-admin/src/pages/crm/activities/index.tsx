import React from "react";
import { useListActivities } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { PhoneCall, Mail, Users, FileText, CheckSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ActivitiesList() {
  const { data, isLoading } = useListActivities();

  const getActivityTypeInfo = (type: string) => {
    switch (type) {
      case "call": return { label: "Appel", icon: <PhoneCall className="w-3 h-3 mr-1" />, class: "bg-blue-50 text-blue-700 border-blue-200" };
      case "email": return { label: "Email", icon: <Mail className="w-3 h-3 mr-1" />, class: "bg-slate-100 text-slate-700 border-slate-200" };
      case "meeting": return { label: "Réunion", icon: <Users className="w-3 h-3 mr-1" />, class: "bg-purple-50 text-purple-700 border-purple-200" };
      case "note": return { label: "Note", icon: <FileText className="w-3 h-3 mr-1" />, class: "bg-yellow-50 text-yellow-700 border-yellow-200" };
      case "task": return { label: "Tâche", icon: <CheckSquare className="w-3 h-3 mr-1" />, class: "bg-green-50 text-green-700 border-green-200" };
      default: return { label: type, icon: null, class: "bg-slate-100 text-slate-700" };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Journal d'Activités</h1>
          <p className="text-sm text-muted-foreground mt-1">Interactions commerciales</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Activité
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Historique</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Rechercher une activité..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Type</TableHead>
                  <TableHead className="font-semibold text-slate-600">Sujet</TableHead>
                  <TableHead className="font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600">Créé par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Aucune activité enregistrée.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((activity) => {
                    const info = getActivityTypeInfo(activity.type);
                    return (
                      <TableRow key={activity.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <Badge variant="outline" className={`flex w-fit items-center px-2 py-0.5 ${info.class}`}>
                            {info.icon} {info.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{activity.subject}</TableCell>
                        <TableCell className="text-sm">{formatDate(activity.createdAt)}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-600">{activity.userName || "—"}</TableCell>
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