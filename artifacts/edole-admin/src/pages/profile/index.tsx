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
import { Separator } from "@/components/ui/separator";
import {
  Camera, Save, Loader2, User, Phone, MapPin, AlertCircle,
  ShieldCheck, Briefcase, Mail, Building2, CalendarDays,
  Hash, UserCheck, Info,
} from "lucide-react";
import { formatDate } from "@/lib/format";
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
  employeeNumber?: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrateur",
  admin: "Administrateur",
  manager: "Manager",
  commercial: "Commercial",
  collaborator: "Collaborateur",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  terminated: "Contrat terminé",
  retired: "Retraité",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  on_leave: "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
  retired: "bg-gray-100 text-gray-600",
};

export default function MyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [accountDirty, setAccountDirty] = useState(false);

  const [address, setAddress] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const [collabInitialized, setCollabInitialized] = useState(false);

  React.useEffect(() => {
    if (!accountDirty) {
      setEmail(user?.email ?? "");
      setPhone(user?.phone ?? "");
      setAvatarPreview(user?.avatarUrl ?? null);
    }
  }, [user?.email, user?.phone, user?.avatarUrl]);

  const { data: collab, isLoading: collabLoading } = useQuery<Collaborator>({
    queryKey: ["hr-me-profile"],
    queryFn: () => apiFetch("/api/hr/me/profile"),
    retry: false,
  });

  React.useEffect(() => {
    if (collab && !collabInitialized) {
      setAddress(collab.address || "");
      setEcName(collab.emergencyContact?.name || "");
      setEcPhone(collab.emergencyContact?.phone || "");
      setEcRelation(collab.emergencyContact?.relation || "");
      setCollabInitialized(true);
    }
  }, [collab, collabInitialized]);

  const accountMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || null,
          phone: phone || null,
          avatarUrl: avatarPreview || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Informations de compte mises à jour");
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      setAccountDirty(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erreur lors de la mise à jour");
    },
  });

  const collabMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/hr/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address || null,
          emergencyContact: (ecName || ecPhone || ecRelation)
            ? { name: ecName, phone: ecPhone, relation: ecRelation }
            : null,
        }),
      }),
    onSuccess: () => {
      toast.success("Profil collaborateur mis à jour");
      queryClient.invalidateQueries({ queryKey: ["hr-me-profile"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erreur lors de la mise à jour");
    },
  });

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(dataUrl);
        setAccountDirty(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "?";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Utilisateur";
  const roleLabel = ROLE_LABELS[user?.role ?? ""] || user?.role || "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles et de contact.</p>
      </div>

      {/* ── Carte compte utilisateur ── */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Mon compte
          </CardTitle>
          <CardDescription>Photo, téléphone et informations d'identification.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Avatar + Identité */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Avatar className="w-20 h-20 ring-2 ring-border">
                {avatarPreview && <AvatarImage src={avatarPreview} />}
                <AvatarFallback className="text-2xl bg-[#0F1A3A] text-[#2563EB] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                title="Changer la photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-foreground leading-tight">{fullName}</h2>
              <Badge variant="outline" className="mt-1.5 text-xs font-medium">{roleLabel}</Badge>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </div>
              </div>
            </div>
          </div>

          {avatarPreview && avatarPreview !== (user?.avatarUrl ?? null) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nouvelle photo sélectionnée — enregistrez pour l'appliquer.
            </div>
          )}

          <Separator />

          {/* Champs éditables */}
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-email" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Adresse e-mail
              </Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setAccountDirty(true); }}
                placeholder="prenom.nom@exemple.com"
              />
              <p className="text-[11px] text-muted-foreground">Cet e-mail est aussi votre identifiant de connexion.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-phone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Téléphone
              </Label>
              <Input
                id="user-phone"
                value={phone}
                onChange={e => { setPhone(e.target.value); setAccountDirty(true); }}
                placeholder="+228 90 00 00 00"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => accountMutation.mutate()}
              disabled={accountMutation.isPending || !accountDirty}
              size="sm"
            >
              {accountMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Profil collaborateur ── */}
      {collabLoading ? (
        <Card className="border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </CardContent>
        </Card>
      ) : collab ? (
        <>
          {/* Infos RH (lecture seule) */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Profil collaborateur
              </CardTitle>
              <CardDescription>Informations gérées par le département RH.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {collab.position && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Poste
                    </p>
                    <p className="font-medium">{collab.position}</p>
                  </div>
                )}
                {collab.department && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Département
                    </p>
                    <p className="font-medium">{collab.department}</p>
                  </div>
                )}
                {collab.hireDate && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Date d'embauche
                    </p>
                    <p className="font-medium">{formatDate(collab.hireDate)}</p>
                  </div>
                )}
                {collab.employeeNumber && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Matricule
                    </p>
                    <p className="font-mono font-medium">{collab.employeeNumber}</p>
                  </div>
                )}
                {collab.employmentStatus && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Statut</p>
                    <Badge
                      className={`border-0 text-xs ${STATUS_COLORS[collab.employmentStatus] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {STATUS_LABELS[collab.employmentStatus] || collab.employmentStatus}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulaire auto-modification collaborateur */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Mes informations modifiables
              </CardTitle>
              <CardDescription>Adresse et contact d'urgence — modifiables par vous-même.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Adresse
                </Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Votre adresse complète…"
                  rows={2}
                />
              </div>

              <div className="border-t border-border/50 pt-4">
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

              <div className="flex justify-end pt-1">
                <Button onClick={() => collabMutation.mutate()} disabled={collabMutation.isPending} size="sm">
                  {collabMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Pas de collaborateur lié → note discrète, sans bloquer */
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/70" />
          <p>
            Ce compte n'est pas encore associé à un profil collaborateur RH.
            Les champs RH (poste, département, contact d'urgence…) seront disponibles une fois le lien établi par l'administration.
          </p>
        </div>
      )}
    </div>
  );
}
