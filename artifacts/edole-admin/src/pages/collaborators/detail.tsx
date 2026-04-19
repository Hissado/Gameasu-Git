import React from "react";
import { useGetCollaborator, getGetCollaboratorQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function CollaboratorDetail() {
  const [, params] = useRoute("/collaborators/:id");
  const id = params?.id || "";
  
  const { data: collaborator, isLoading } = useGetCollaborator(id, {
    query: { enabled: !!id, queryKey: getGetCollaboratorQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading collaborator details...</div>;
  }

  if (!collaborator) {
    return <div className="p-8 text-center text-muted-foreground">Collaborator not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-border">
            <AvatarImage src={collaborator.avatarUrl} />
            <AvatarFallback className="text-xl">{collaborator.firstName[0]}{collaborator.lastName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{collaborator.firstName} {collaborator.lastName}</h1>
            <p className="text-muted-foreground mt-1">{collaborator.position || "No position"} • {collaborator.department || "No department"}</p>
          </div>
        </div>
        {collaborator.isAvailable ? (
          <Badge variant="outline" className="bg-green-100 text-green-800 px-3 py-1">Available</Badge>
        ) : (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 px-3 py-1">Busy</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{collaborator.email || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="font-medium">{collaborator.phone || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Joined</div>
              <div className="font-medium">{new Date(collaborator.createdAt).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Workload & Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Active Projects</div>
                <div className="text-2xl font-bold">{collaborator.currentProjectsCount || 0}</div>
              </div>
            </div>
            {/* Extended workload details could be mapped here if available from a separate endpoint */}
            <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">
              Detailed task assignments will appear here.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
