import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre profil, vos préférences et vos accès</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations du profil</CardTitle>
            <CardDescription>Mettez à jour vos coordonnées professionnelles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" defaultValue={user?.firstName || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" defaultValue={user?.lastName || ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Adresse e-mail professionnelle</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input id="phone" type="tel" placeholder="+237 6XX XXX XXX" />
            </div>
            <Button className="mt-2">Enregistrer les modifications</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences de notification</CardTitle>
            <CardDescription>Choisissez comment vous souhaitez être alerté.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="space-y-0.5">
                <Label className="text-base">Alertes par e-mail</Label>
                <p className="text-sm text-muted-foreground">Recevez un récapitulatif quotidien de l'activité.</p>
              </div>
              <div className="h-6 w-11 bg-primary rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="space-y-0.5">
                <Label className="text-base">Notifications SMS</Label>
                <p className="text-sm text-muted-foreground">Soyez alerté par SMS en cas d'incident urgent.</p>
              </div>
              <div className="h-6 w-11 bg-muted rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Notifications navigateur</Label>
                <p className="text-sm text-muted-foreground">Affichez les alertes en temps réel dans l'application.</p>
              </div>
              <div className="h-6 w-11 bg-primary rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences régionales</CardTitle>
            <CardDescription>Langue, devise et fuseau horaire utilisés dans la plateforme.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Langue</p>
              <p className="font-medium">Français</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Devise</p>
              <p className="font-medium">Franc CFA (FCFA)</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Fuseau horaire</p>
              <p className="font-medium">Afrique/Douala (UTC+1)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zone sensible</CardTitle>
            <CardDescription>Actions irréversibles sur votre compte.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive">Désactiver mon compte</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
