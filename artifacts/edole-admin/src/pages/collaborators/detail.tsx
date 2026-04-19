import React from "react";
import { useGetCollaborator, getGetCollaboratorQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, Calendar, HardHat, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export default function CollaboratorDetail() {
  const [, params] = useRoute("/collaborators/:id");
  const id = params?.id || "";
  
  const { data: collaborator, isLoading } = useGetCollaborator(id, {
    query: { enabled: !!id, queryKey: getGetCollaboratorQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-32" />
        <Card><CardContent className="h-40" /></Card>
      </div>
    );
  }

  if (!collaborator) {
    return (
      <div className="text-center py-12">
        <HardHat className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Collaborateur introuvable</h2>
        <Link href="/collaborators"><Button className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'équipe</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-6">
          <Link href="/collaborators">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <Avatar className="w-20 h-20 border-4 border-background shadow-md">
              <AvatarImage src={collaborator.avatarUrl} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                {collaborator.firstName[0]}{collaborator.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{collaborator.firstName} {collaborator.lastName}</h1>
              <p className="text-sm font-medium text-primary mt-1 uppercase tracking-wider">{collaborator.position || "Fonction non définie"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{collaborator.department || "Département non défini"}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {collaborator.isAvailable ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-4 py-1">Disponible pour affectation</Badge>
          ) : (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-sm px-4 py-1">Actuellement Affecté</Badge>
          )}
          <Button variant="outline" size="sm" className="mt-2">Éditer le profil</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="col-span-1 shadow-sm h-fit border-border">
          <CardHeader className="bg-slate-50/50 border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Informations Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email professionnel</p>
                <p className="text-sm font-medium mt-0.5">{collaborator.email || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Téléphone</p>
                <p className="text-sm font-medium mt-0.5">{collaborator.phone || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date d'intégration</p>
                <p className="text-sm font-medium mt-0.5">{formatDate(collaborator.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-slate-50/50 border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Charge de Travail & Affectations</CardTitle>
              <CardDescription>Bilan de l'activité opérationnelle</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Briefcase className="w-6 h-6"/></div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chantiers Actifs</div>
                    <div className="text-3xl font-bold text-slate-800">{collaborator.currentProjectsCount || 0}</div>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-center">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux d'occupation estimé</div>
                    <div className="text-xl font-bold text-slate-800">{collaborator.isAvailable ? '0%' : '100%'}</div>
                  </div>
                  <Progress value={collaborator.isAvailable ? 0 : 100} className={`h-2 ${collaborator.isAvailable ? '' : '[&>div]:bg-orange-500'}`} />
                </div>
              </div>
              
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-4 border-b border-border pb-2">Affectations récentes</h3>
              <div className="text-sm text-muted-foreground p-8 bg-slate-50 rounded-lg text-center border border-dashed border-slate-200">
                Le détail des affectations par chantier sera affiché ici.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}