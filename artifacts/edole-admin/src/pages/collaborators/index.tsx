import React from "react";
import { useListCollaborators, useGetCollaboratorsWorkload } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function CollaboratorsList() {
  const { data: collaborators, isLoading } = useListCollaborators();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collaborators</h1>
          <p className="text-muted-foreground mt-1">Manage your team and their assignments</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Collaborator
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading collaborators...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No collaborators found.
                    </TableCell>
                  </TableRow>
                ) : (
                  collaborators?.data?.map((collab) => (
                    <TableRow key={collab.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={collab.avatarUrl} />
                            <AvatarFallback>{collab.firstName[0]}{collab.lastName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="font-medium">
                            {collab.firstName} {collab.lastName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{collab.position || "—"}</TableCell>
                      <TableCell>{collab.department || "—"}</TableCell>
                      <TableCell>
                        {collab.isAvailable ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800">Available</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Busy</Badge>
                        )}
                      </TableCell>
                      <TableCell>{collab.currentProjectsCount || 0}</TableCell>
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
