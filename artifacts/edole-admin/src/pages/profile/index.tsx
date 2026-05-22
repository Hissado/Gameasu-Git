import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Save, Loader2, User, Phone, MapPin, AlertCircle, ShieldCheck, Briefcase } from "lucide-react";
import { formatDate, formatFCFA } from "@/lib/format";
import { toast } from "sonner";

type Collaborator = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  position?: string;
  department?: string;
  hireDate?: string;
  employmentStatus?: string;
  address?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string } | null;
  baseSalary?: string;
  employeeNumber?: string;
  nationalId?: string;
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  terminated: "Contrat terminé",
  retired: "Retraité",
};

export default function MyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: collab, isLoading, error } = useQuery<Collaborator>({
    queryKey: ["hr-me-profile"],
    queryFn: () => apiFetch("/api/hr/me/profile"),
  });

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (collab && !initialized) {
      setPhone(collab.phone || "");
      setAddress(collab.address || "");
      setEcName(collab.emergencyContact?.name || "");
      setEcPhone(collab.emergencyContact?.phone || "");
      setEcRelation(collab.emergencyContact?.relation || "");
      setAvatarPreview(collab.avatarUrl || null);
      setInitialized(true);
    }
  }, [collab, initialized]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/hr/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          address: address || null,
          emergencyContact: (ecName || ecPhone || ecRelation)
            ? { name: ecName, phone: ecPhone, relation: ecRelation }
            : null,
          avatarUrl: avatarPreview || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Profil mis à jour avec succès");
      queryClient.invalidateQueries({ queryKey: ["hr-me-profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erreur lors de la mise à jour");
    },
  });

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "?";

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !collab) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Aucun profil collaborateur lié</h2>
            <p className="text-sm text-muted-foreground">
              Votre compte utilisateur n'est pas encore associé à un profil collaborateur.
              Contactez votre administrateur RH pour lier votre compte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mon Profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles et de contact.</p>
      </div>

      {/* Carte identité (lecture seule) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Informations de compte
          </CardTitle>
          <CardDescription>Ces informations sont gérées par l'administration RH.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {/* Avatar + Identité */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              <Avatar className="w-20 h-20 ring-2 ring-border">
                {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                title="Changer la photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{collab.firstName} {collab.lastName}</h2>
              <p className="text-sm text-primary font-medium mt-0.5">{collab.position || "Poste non défini"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{collab.department || "Département non défini"}</p>
              <div className="flex items-center gap-2 mt-2">
                {collab.employmentStatus && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                    {EMPLOYMENT_LABELS[collab.employmentStatus] || collab.employmentStatus}
                  </Badge>
                )}
                {collab.employeeNumber && (
                  <Badge variant="outline" className="font-mono text-xs">Matricule {collab.employeeNumber}</Badge>
                )}
              </div>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
          {avatarPreview && avatarPreview !== collab.avatarUrl && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nouvelle photo sélectionnée — cliquez sur "Enregistrer" pour l'appliquer.
            </div>
          )}

          {/* Infos RH (lecture seule) */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Email
              </p>
              <p className="font-medium">{collab.email || "—"}</p>
            </div>
            {collab.hireDate && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date d'embauche</p>
                <p className="font-medium">{formatDate(collab.hireDate)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire auto-modification */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Mes informations modifiables
          </CardTitle>
          <CardDescription>Mettez à jour vos coordonnées et votre contact d'urgence.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Coordonnées */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Coordonnées
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+228 90 00 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Votre adresse complète…"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Contact d'urgence */}
          <div className="border-t border-border/50 pt-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              Contact d'urgence
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ecName">Nom complet</Label>
                <Input
                  id="ecName"
                  value={ecName}
                  onChange={e => setEcName(e.target.value)}
                  placeholder="ex : Fatou Diallo"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ecPhone">Téléphone</Label>
                  <Input
                    id="ecPhone"
                    value={ecPhone}
                    onChange={e => setEcPhone(e.target.value)}
                    placeholder="+228 91 00 00 00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ecRelation">Lien de parenté</Label>
                  <Input
                    id="ecRelation"
                    value={ecRelation}
                    onChange={e => setEcRelation(e.target.value)}
                    placeholder="ex : Épouse, Père…"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer les modifications
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
