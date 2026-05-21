import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { GaméasùLockup } from "@/components/branding/GameasuLockup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@edole.africa", password: "admin123" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => { login(res.token); setLocation("/"); },
        onError: () => {
          toast({ variant: "destructive", title: "Échec de la connexion", description: "Vérifiez vos identifiants et réessayez." });
        },
      },
    );
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Panneau marque — logo plein cadre, fond clair pour respecter
          fidèlement le navy + or du logo et la finesse des accents é/ù. */}
      <div className="hidden lg:flex flex-col w-1/2 relative overflow-hidden border-r border-[#0F1A3A]/10"
           style={{ background: "linear-gradient(180deg, #FAF6EE 0%, #F4EEDE 100%)" }}>
        <div
          className="absolute inset-0 opacity-[0.10] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #C8A24B66 0, transparent 50%), radial-gradient(circle at 80% 80%, #0F1A3A22 0, transparent 45%)" }}
        />
        <div className="relative flex-1 flex items-center justify-center px-6">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            draggable={false}
            className="w-full h-auto max-h-[88vh] object-contain select-none"
          />
        </div>
        <div className="relative px-12 pb-6 text-xs text-[#0F1A3A]/55">
          © {new Date().getFullYear()} {BRANDING.legalName} — Tous droits réservés.
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border/60">
          <CardHeader className="space-y-2 pb-6">
            <div className="flex lg:hidden justify-center mb-3">
              <GaméasùLockup size="lg" variant="light" />
            </div>
            <CardTitle className="font-display text-[26px] font-bold tracking-[-0.03em]">Espace professionnel</CardTitle>
            <CardDescription>
              Connectez-vous à votre espace de travail {BRANDING.appName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse e-mail professionnelle</FormLabel>
                      <FormControl><Input placeholder="prenom.nom@votre-entreprise.com" autoComplete="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Connexion en cours…" : "Se connecter"}
                </Button>
              </form>
            </Form>

            <div className="mt-8 pt-6 border-t border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Comptes de démonstration</p>
              <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                <div><span className="text-foreground font-semibold">admin@edole.africa</span> · admin123</div>
                <div><span className="text-foreground font-semibold">manager@edole.africa</span> · manager123</div>
                <div><span className="text-foreground font-semibold">commercial@edole.africa</span> · commercial123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
