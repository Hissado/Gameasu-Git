import React from "react";
import { useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/format";
import { ArrowLeft, Building, Mail, Phone, Globe, MapPin, Briefcase, ShoppingCart, Banknote, User } from "lucide-react";

export default function ClientDetail() {
  const [, params] = useRoute("/crm/clients/:id");
  const id = params?.id || "";
  
  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) }
  });

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800 border-green-200">Actif</Badge>;
      case "inactive": return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Inactif</Badge>;
      case "prospect": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Prospect</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-32" />
        <Card><CardContent className="h-64" /></Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Client introuvable</h2>
        <Link href="/crm/clients"><Button className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'annuaire</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/crm/clients">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-lg text-slate-500 font-bold shadow-sm">
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{client.name}</h1>
              {getStatusBadge(client.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-medium">{client.industry || "Secteur non spécifié"}</p>
          </div>
        </div>
        <Button variant="outline">Modifier la fiche</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email principal</p>
                <p className="text-sm font-medium mt-0.5">{client.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Téléphone</p>
                <p className="text-sm font-medium mt-0.5">{client.phone || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Site Web</p>
                <p className="text-sm font-medium mt-0.5 text-primary hover:underline cursor-pointer">{client.website || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Siège Social</p>
                <p className="text-sm font-medium mt-0.5">{client.address || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Vue 360° du Compte</CardTitle>
              <CardDescription>Synthèse des activités et revenus générés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
                    <Briefcase className="w-4 h-4" /> Projets
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{client.projectsCount || 0}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
                    <ShoppingCart className="w-4 h-4" /> Commandes
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{client.ordersCount || 0}</div>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl col-span-2">
                  <div className="flex items-center gap-2 text-sm text-primary font-bold uppercase tracking-wider mb-2">
                    <Banknote className="w-4 h-4" /> Chiffre d'Affaires Total
                  </div>
                  <div className="text-3xl font-bold text-primary">{formatFCFA(client.totalRevenue || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Contacts Associés</CardTitle>
              <Button variant="outline" size="sm"><User className="w-4 h-4 mr-2"/> Ajouter un contact</Button>
            </CardHeader>
            <CardContent>
              {client.contacts && client.contacts.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {client.contacts.map((contact) => (
                    <div key={contact.id} className="flex justify-between items-center p-3 border border-border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                            {contact.firstName} {contact.lastName}
                            {contact.isPrimary && <Badge className="text-[10px] h-5 bg-blue-100 text-blue-800 border-none hover:bg-blue-100">Principal</Badge>}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground">{contact.role || "Rôle non défini"}</div>
                        </div>
                      </div>
                      <div className="text-sm text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5 text-slate-600"><Mail className="w-3 h-3 text-slate-400"/> {contact.email || "—"}</div>
                        <div className="flex items-center justify-end gap-1.5 text-slate-600"><Phone className="w-3 h-3 text-slate-400"/> {contact.phone || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-8 bg-slate-50 rounded-lg text-center border border-dashed border-slate-200 mt-4">
                  Aucun contact renseigné pour ce client.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}