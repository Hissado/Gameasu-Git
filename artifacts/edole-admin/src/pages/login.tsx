import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { HardHat, ShieldCheck, BarChart3 } from "lucide-react";
import logo from "@/assets/edole-logo.png";

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
    defaultValues: {
      email: "admin@edole.africa",
      password: "admin123",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token);
          setLocation("/");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Échec de la connexion",
            description: "Vérifiez vos identifiants et réessayez.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(24 100% 50%) 0, transparent 40%), radial-gradient(circle at 80% 80%, hsl(24 100% 50%) 0, transparent 35%)" }} />
        <div className="relative">
          <div className="bg-white inline-flex rounded-md p-3 shadow-2xl">
            <img src={logo} alt="EDOLE" className="h-10 object-contain" />
          </div>
        </div>

        <div className="relative space-y-8 max-w-md">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold mb-3">Le numérique au service du BTP</p>
            <h2 className="text-4xl font-bold leading-tight">
              Pilotez vos chantiers, votre matériel et vos équipes depuis une seule plateforme.
            </h2>
            <p className="text-sm text-sidebar-foreground/60 mt-4 leading-relaxed">
              EDOLE accompagne les entreprises du Bâtiment et des Travaux Publics en Afrique francophone — du devis au paiement, du chantier à la maintenance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4">
            {[
              { icon: HardHat, label: "Suivi opérationnel des chantiers en temps réel" },
              { icon: BarChart3, label: "Tableau de bord financier consolidé en FCFA" },
              { icon: ShieldCheck, label: "Conformité, traçabilité et contrôle d'accès" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-sidebar-foreground/85">
                <div className="w-9 h-9 rounded-md bg-sidebar-accent border border-sidebar-border flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-sidebar-foreground/40">
          © {new Date().getFullYear()} EDOLE Africa — Tous droits réservés.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border/60">
          <CardHeader className="space-y-2 pb-6">
            <div className="flex lg:hidden justify-center mb-2">
              <img src={logo} alt="EDOLE" className="h-10 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Espace professionnel</CardTitle>
            <CardDescription>
              Connectez-vous avec votre compte EDOLE pour accéder à la plateforme.
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
                      <FormControl>
                        <Input placeholder="prenom.nom@edole.africa" autoComplete="email" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                      </FormControl>
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
