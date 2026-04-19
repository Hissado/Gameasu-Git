import React from "react";
import { useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClientDetail() {
  const [, params] = useRoute("/crm/clients/:id");
  const id = params?.id || "";
  
  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading client details...</div>;
  }

  if (!client) {
    return <div className="p-8 text-center text-muted-foreground">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground mt-1">{client.industry || "No industry specified"}</p>
        </div>
        <Badge variant="outline" className="capitalize px-3 py-1 text-sm">{client.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{client.email || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="font-medium">{client.phone || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Website</div>
              <div className="font-medium">{client.website || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Address</div>
              <div className="font-medium">{client.address || "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Projects</div>
                <div className="text-2xl font-bold">{client.projectsCount || 0}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Orders</div>
                <div className="text-2xl font-bold">{client.ordersCount || 0}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg col-span-2">
                <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-primary">${client.totalRevenue?.toLocaleString() || 0}</div>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Contacts</h3>
            {client.contacts && client.contacts.length > 0 ? (
              <div className="space-y-3">
                {client.contacts.map((contact) => (
                  <div key={contact.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {contact.firstName} {contact.lastName}
                        {contact.isPrimary && <Badge className="text-[10px] h-5">Primary</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{contact.role || "—"}</div>
                    </div>
                    <div className="text-sm text-right">
                      <div>{contact.email}</div>
                      <div className="text-muted-foreground">{contact.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">
                No contacts added yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
