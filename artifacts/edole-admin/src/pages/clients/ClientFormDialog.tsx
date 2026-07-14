import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2, Loader2, Plus, Trash2, UserPlus, Star,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientFull {
  id: string;
  name: string;
  commercialName?: string | null;
  type?: string | null;
  status: string;
  priority?: string | null;
  email?: string | null;
  email2?: string | null;
  phone?: string | null;
  phone2?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  contactTitle?: string | null;
  contactName?: string | null;
  contactFunction?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
  quartier?: string | null;
  rue?: string | null;
  postalCode?: string | null;
  gpsLat?: string | null;
  gpsLng?: string | null;
  address?: string | null;
  billingAddress?: Record<string, string> | null;
  shippingAddress?: Record<string, string> | null;
  ifu?: string | null;
  rccm?: string | null;
  vatNumber?: string | null;
  statisticNumber?: string | null;
  industry?: string | null;
  companySize?: string | null;
  foundedDate?: string | null;
  employeeCount?: number | null;
  preferredCurrency?: string | null;
  preferredLanguage?: string | null;
  assignedUserId?: string | null;
  source?: string | null;
  category?: string | null;
  segment?: string | null;
  acquisitionChannel?: string | null;
  potential?: string | null;
  firstContactDate?: string | null;
  conversionDate?: string | null;
  creditLimit?: string | null;
  paymentTermsDays?: number | null;
  paymentConditions?: string | null;
  preferredPaymentMode?: string | null;
  vatExempt?: boolean | null;
  discountRate?: string | null;
  specialConditions?: string | null;
  contacts?: ContactRow[];
}

interface ContactRow {
  id?: string;
  title?: string;
  firstName: string;
  lastName: string;
  function?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  role?: string;
  isPrimary?: string;
  notes?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const CLIENT_TYPES = [
  { value: "entreprise", label: "Entreprise" },
  { value: "particulier", label: "Particulier" },
  { value: "administration", label: "Administration / Collectivité" },
  { value: "ong", label: "ONG / Association" },
];

const CLIENT_STATUSES = [
  { value: "prospect", label: "Prospect" },
  { value: "lead", label: "Lead qualifié" },
  { value: "client", label: "Client actif" },
  { value: "vip", label: "Client VIP" },
  { value: "inactive", label: "Inactif" },
];

const PRIORITIES = [
  { value: "haute", label: "Haute" },
  { value: "normale", label: "Normale" },
  { value: "basse", label: "Basse" },
];

const COMPANY_SIZES = [
  { value: "tpe", label: "TPE (1–9 salariés)" },
  { value: "pme", label: "PME (10–249 salariés)" },
  { value: "eti", label: "ETI (250–4999 salariés)" },
  { value: "ge", label: "GE (5000+ salariés)" },
];

const SOURCES = [
  "Bouche-à-oreille", "Salon / Événement", "LinkedIn", "Site web",
  "Appel entrant", "Partenaire", "Publicité", "Démarchage", "Autre",
];

const SEGMENTS = ["Strategic", "Premium", "Standard", "Opportuniste"];

const POTENTIALS = [
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "fort", label: "Fort" },
];

const PAYMENT_MODES = [
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money (Flooz/Mixx)" },
  { value: "carte", label: "Carte bancaire" },
];

const CURRENCIES = ["XOF", "EUR", "USD", "GBP", "XAF"];

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "ar", label: "Arabe" },
  { value: "pt", label: "Portugais" },
];

const COUNTRIES = [
  "Togo", "Côte d'Ivoire", "Ghana", "Bénin", "Sénégal", "Cameroun",
  "Mali", "Burkina Faso", "Niger", "Nigeria", "Gabon", "Congo",
  "République Démocratique du Congo", "France", "Chine", "Autre",
];

const TITLES = ["M.", "Mme", "Dr.", "Pr.", "Me"];

// ── Valeurs initiales ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  type: "entreprise", name: "", commercialName: "", status: "prospect", priority: "normale",
  contactTitle: "", contactName: "", contactFunction: "",
  phone: "", phone2: "", whatsapp: "", email: "", email2: "", website: "", logoUrl: "",
  country: "Togo", region: "", city: "", commune: "", quartier: "", rue: "", postalCode: "",
  gpsLat: "", gpsLng: "", address: "",
  ifu: "", rccm: "", vatNumber: "", statisticNumber: "",
  industry: "", companySize: "", foundedDate: "", employeeCount: "",
  preferredCurrency: "XOF", preferredLanguage: "fr",
  source: "", category: "", segment: "", acquisitionChannel: "", potential: "",
  firstContactDate: "", conversionDate: "", assignedUserId: "",
  creditLimit: "", paymentTermsDays: "30", paymentConditions: "",
  preferredPaymentMode: "", vatExempt: false, discountRate: "", specialConditions: "",
};

const EMPTY_CONTACT: ContactRow = {
  title: "", firstName: "", lastName: "", function: "",
  email: "", phone: "", whatsapp: "", role: "", isPrimary: "false", notes: "",
};

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  client?: ClientFull | null;
  onSuccess?: (client: ClientFull) => void;
}

export function ClientFormDialog({ open, onClose, client, onSuccess }: Props) {
  const qc = useQueryClient();
  const isEdit = !!client;
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  // Charger les utilisateurs (commerciaux) pour l'attribution
  const { data: usersData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["users-list-simple"],
    queryFn: () => apiFetch("/api/users?limit=100"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setTab("general");
    if (client) {
      setForm({
        type: client.type || "entreprise",
        name: client.name || "",
        commercialName: client.commercialName || "",
        status: client.status || "prospect",
        priority: client.priority || "normale",
        contactTitle: client.contactTitle || "",
        contactName: client.contactName || "",
        contactFunction: client.contactFunction || "",
        phone: client.phone || "",
        phone2: client.phone2 || "",
        whatsapp: client.whatsapp || "",
        email: client.email || "",
        email2: client.email2 || "",
        website: client.website || "",
        logoUrl: client.logoUrl || "",
        country: client.country || "Togo",
        region: client.region || "",
        city: client.city || "",
        commune: client.commune || "",
        quartier: client.quartier || "",
        rue: client.rue || "",
        postalCode: client.postalCode || "",
        gpsLat: client.gpsLat || "",
        gpsLng: client.gpsLng || "",
        address: client.address || "",
        ifu: client.ifu || "",
        rccm: client.rccm || "",
        vatNumber: client.vatNumber || "",
        statisticNumber: client.statisticNumber || "",
        industry: client.industry || "",
        companySize: client.companySize || "",
        foundedDate: client.foundedDate || "",
        employeeCount: client.employeeCount ? String(client.employeeCount) : "",
        preferredCurrency: client.preferredCurrency || "XOF",
        preferredLanguage: client.preferredLanguage || "fr",
        source: client.source || "",
        category: client.category || "",
        segment: client.segment || "",
        acquisitionChannel: client.acquisitionChannel || "",
        potential: client.potential || "",
        firstContactDate: client.firstContactDate || "",
        conversionDate: client.conversionDate || "",
        assignedUserId: client.assignedUserId || "",
        creditLimit: client.creditLimit || "",
        paymentTermsDays: client.paymentTermsDays ? String(client.paymentTermsDays) : "30",
        paymentConditions: client.paymentConditions || "",
        preferredPaymentMode: client.preferredPaymentMode || "",
        vatExempt: !!client.vatExempt,
        discountRate: client.discountRate || "",
        specialConditions: client.specialConditions || "",
      });
      setContacts(client.contacts?.map(c => ({ ...c })) ?? []);
    } else {
      setForm({ ...EMPTY_FORM });
      setContacts([]);
    }
  }, [open, client]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Contacts helpers
  const addContact = () => setContacts(cs => [...cs, { ...EMPTY_CONTACT }]);
  const removeContact = (i: number) => setContacts(cs => cs.filter((_, idx) => idx !== i));
  const setContact = (i: number, k: string, v: string) =>
    setContacts(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        ...data,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : null,
        creditLimit: data.creditLimit || null,
        paymentTermsDays: data.paymentTermsDays ? Number(data.paymentTermsDays) : 30,
        discountRate: data.discountRate || null,
        vatExempt: data.vatExempt,
        assignedUserId: data.assignedUserId || null,
        contacts,
      };
      if (isEdit) {
        const updated = await apiFetch(`/api/clients/${client!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }) as ClientFull;
        // Mettre à jour les contacts séparément
        await syncContacts(client!.id, contacts);
        return updated;
      } else {
        const created = await apiFetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }) as ClientFull;
        if (contacts.length > 0) {
          await syncContacts(created.id, contacts);
        }
        return created;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["clients-ws"] });
      qc.invalidateQueries({ queryKey: ["client-detail", client?.id] });
      toast.success(isEdit ? "Fiche client mise à jour" : "Client créé avec succès");
      onSuccess?.(result);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5 text-orange-600" />
            {isEdit ? `Modifier — ${client!.name}` : "Nouveau client / tiers"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full grid grid-cols-6 h-9 mb-5">
              <TabsTrigger value="general" className="text-xs">Général</TabsTrigger>
              <TabsTrigger value="adresse" className="text-xs">Adresse</TabsTrigger>
              <TabsTrigger value="admin" className="text-xs">Administratif</TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs">Commercial</TabsTrigger>
              <TabsTrigger value="finance" className="text-xs">Finance</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs">
                Contacts {contacts.length > 0 && <Badge className="ml-1 text-[9px] h-4 px-1 bg-orange-100 text-orange-700">{contacts.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── Onglet Général ── */}
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Type de tiers</Label>
                  <Select value={form.type} onValueChange={v => set("type", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Statut</Label>
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Raison sociale / Nom *</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nom officiel ou raison sociale" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Nom commercial / Enseigne</Label>
                  <Input value={form.commercialName} onChange={e => set("commercialName", e.target.value)} placeholder="Ex. « BTP Gabo »" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Priorité</Label>
                  <Select value={form.priority} onValueChange={v => set("priority", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Contact principal</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Titre</Label>
                    <Select value={form.contactTitle} onValueChange={v => set("contactTitle", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Nom complet</Label>
                    <Input value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Prénom Nom" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Fonction / Poste</Label>
                    <Input value={form.contactFunction} onChange={e => set("contactFunction", e.target.value)} placeholder="DG, DAF, Acheteur…" className="h-8 text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Coordonnées</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Email principal</Label>
                    <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@société.com" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Email secondaire</Label>
                    <Input type="email" value={form.email2} onChange={e => set("email2", e.target.value)} placeholder="compta@société.com" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Téléphone</Label>
                    <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+228 XX XX XX XX" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Téléphone 2</Label>
                    <Input value={form.phone2} onChange={e => set("phone2", e.target.value)} placeholder="+228 XX XX XX XX" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">WhatsApp</Label>
                    <Input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="+228 XX XX XX XX" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Site web</Label>
                    <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://…" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Onglet Adresse ── */}
            <TabsContent value="adresse" className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Adresse principale</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Pays</Label>
                    <Select value={form.country} onValueChange={v => set("country", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Région / Province</Label>
                    <Input value={form.region} onChange={e => set("region", e.target.value)} placeholder="Ex. Maritime, Plateaux…" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Ville</Label>
                    <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Lomé, Kpalimé…" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Commune / Arrondissement</Label>
                    <Input value={form.commune} onChange={e => set("commune", e.target.value)} placeholder="Golfe 1, Kloto…" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Quartier</Label>
                    <Input value={form.quartier} onChange={e => set("quartier", e.target.value)} placeholder="Bè, Djidjolé…" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Code postal</Label>
                    <Input value={form.postalCode} onChange={e => set("postalCode", e.target.value)} placeholder="BP…" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Rue / Avenue / Boulevard</Label>
                    <Input value={form.rue} onChange={e => set("rue", e.target.value)} placeholder="Av. Sarakawa, N°12…" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Adresse libre (complément)</Label>
                    <Textarea value={form.address} onChange={e => set("address", e.target.value)} rows={2} className="text-sm" placeholder="Précisions, repères, boîte postale…" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">GPS Latitude</Label>
                    <Input value={form.gpsLat} onChange={e => set("gpsLat", e.target.value)} placeholder="6.1375" className="h-8 text-sm font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">GPS Longitude</Label>
                    <Input value={form.gpsLng} onChange={e => set("gpsLng", e.target.value)} placeholder="1.2123" className="h-8 text-sm font-mono" />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Onglet Administratif ── */}
            <TabsContent value="admin" className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Identifiants fiscaux & légaux</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">IFU / NIF (numéro fiscal)</Label>
                    <Input value={form.ifu} onChange={e => set("ifu", e.target.value)} placeholder="000XXXXXXX" className="h-8 text-sm font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">RCCM (registre commerce)</Label>
                    <Input value={form.rccm} onChange={e => set("rccm", e.target.value)} placeholder="TG-LOM-XXXX-XX-XXXXX" className="h-8 text-sm font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Numéro TVA</Label>
                    <Input value={form.vatNumber} onChange={e => set("vatNumber", e.target.value)} placeholder="TG XXXXXXXXXXXXXXX" className="h-8 text-sm font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Numéro statistique</Label>
                    <Input value={form.statisticNumber} onChange={e => set("statisticNumber", e.target.value)} placeholder="XXXXXXXXXXXXX" className="h-8 text-sm font-mono" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Informations société</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Secteur d'activité</Label>
                    <Input value={form.industry} onChange={e => set("industry", e.target.value)} placeholder="BTP, Mines, Agro-alimentaire, Services…" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Taille de l'entreprise</Label>
                    <Select value={form.companySize} onValueChange={v => set("companySize", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>{COMPANY_SIZES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Effectif (nbre de salariés)</Label>
                    <Input type="number" value={form.employeeCount} onChange={e => set("employeeCount", e.target.value)} placeholder="250" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Date de création</Label>
                    <Input type="date" value={form.foundedDate} onChange={e => set("foundedDate", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Devise préférée</Label>
                    <Select value={form.preferredCurrency} onValueChange={v => set("preferredCurrency", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Langue de communication</Label>
                    <Select value={form.preferredLanguage} onValueChange={v => set("preferredLanguage", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Onglet Commercial ── */}
            <TabsContent value="commercial" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Commercial responsable</Label>
                  <Select value={form.assignedUserId || "__none__"} onValueChange={v => set("assignedUserId", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {(usersData?.data ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Source d'acquisition</Label>
                  <Select value={form.source} onValueChange={v => set("source", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Segment</Label>
                  <Select value={form.segment} onValueChange={v => set("segment", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Catégorie client</Label>
                  <Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Grand compte, PME, Start-up…" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Potentiel</Label>
                  <Select value={form.potential} onValueChange={v => set("potential", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{POTENTIALS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Canal d'acquisition</Label>
                  <Input value={form.acquisitionChannel} onChange={e => set("acquisitionChannel", e.target.value)} placeholder="Inbound, Outbound, Partenaire…" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">1er contact</Label>
                  <Input type="date" value={form.firstContactDate} onChange={e => set("firstContactDate", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Date de conversion</Label>
                  <Input type="date" value={form.conversionDate} onChange={e => set("conversionDate", e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </TabsContent>

            {/* ── Onglet Finance ── */}
            <TabsContent value="finance" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Plafond de crédit (FCFA)</Label>
                  <Input type="number" value={form.creditLimit} onChange={e => set("creditLimit", e.target.value)} placeholder="0" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Délai de paiement (jours)</Label>
                  <Input type="number" value={form.paymentTermsDays} onChange={e => set("paymentTermsDays", e.target.value)} placeholder="30" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Conditions de paiement</Label>
                  <Input value={form.paymentConditions} onChange={e => set("paymentConditions", e.target.value)} placeholder="30 jours fin de mois, À vue…" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Mode de paiement préféré</Label>
                  <Select value={form.preferredPaymentMode} onValueChange={v => set("preferredPaymentMode", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Remise globale (%)</Label>
                  <Input type="number" min={0} max={100} step={0.5} value={form.discountRate} onChange={e => set("discountRate", e.target.value)} placeholder="0" className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Checkbox
                    id="vatExempt"
                    checked={form.vatExempt}
                    onCheckedChange={v => set("vatExempt", !!v)}
                  />
                  <Label htmlFor="vatExempt" className="text-sm cursor-pointer">
                    Client exonéré de TVA
                  </Label>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Conditions particulières</Label>
                  <Textarea
                    value={form.specialConditions}
                    onChange={e => set("specialConditions", e.target.value)}
                    rows={3}
                    className="text-sm"
                    placeholder="Clauses spéciales, accords de confidentialité, remises exceptionnelles…"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Onglet Contacts ── */}
            <TabsContent value="contacts" className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Personnes de contact du client (responsables, DG, DAF, acheteurs…)</p>
                <Button size="sm" variant="outline" onClick={addContact} className="h-7 gap-1 text-xs">
                  <UserPlus className="w-3.5 h-3.5" /> Ajouter
                </Button>
              </div>

              {contacts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                  <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun contact. Cliquez sur « Ajouter » pour enregistrer les interlocuteurs clés.
                </div>
              )}

              {contacts.map((c, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                  {c.isPrimary === "true" && (
                    <Badge className="absolute top-2 right-8 text-[9px] px-1.5 bg-amber-100 text-amber-700">
                      <Star className="w-2.5 h-2.5 mr-0.5" /> Principal
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-rose-500"
                    onClick={() => removeContact(i)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Titre</Label>
                      <Select value={c.title || ""} onValueChange={v => setContact(i, "title", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Prénom *</Label>
                      <Input value={c.firstName} onChange={e => setContact(i, "firstName", e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Nom *</Label>
                      <Input value={c.lastName} onChange={e => setContact(i, "lastName", e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Fonction</Label>
                      <Input value={c.function || ""} onChange={e => setContact(i, "function", e.target.value)} placeholder="DG, DAF, Acheteur…" className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Email</Label>
                      <Input type="email" value={c.email || ""} onChange={e => setContact(i, "email", e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-0.5 block">Téléphone</Label>
                      <Input value={c.phone || ""} onChange={e => setContact(i, "phone", e.target.value)} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`primary-${i}`}
                      checked={c.isPrimary === "true"}
                      onCheckedChange={v => {
                        if (v) {
                          setContacts(cs => cs.map((c2, j) => ({ ...c2, isPrimary: j === i ? "true" : "false" })));
                        } else {
                          setContact(i, "isPrimary", "false");
                        }
                      }}
                    />
                    <Label htmlFor={`primary-${i}`} className="text-xs cursor-pointer text-muted-foreground">
                      Contact principal
                    </Label>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 pb-5 pt-2 border-t">
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Annuler</Button>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name.trim()}
            className="h-8 text-sm bg-orange-600 hover:bg-orange-700 text-white"
          >
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
            {isEdit ? "Enregistrer les modifications" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sync contacts (create/update/delete) ──────────────────────────────────────

async function syncContacts(clientId: string, contacts: ContactRow[]) {
  for (const c of contacts) {
    if (!c.firstName.trim() && !c.lastName.trim()) continue;
    if (c.id) {
      await apiFetch(`/api/clients/${clientId}/contacts/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      }).catch(() => null);
    } else {
      await apiFetch(`/api/clients/${clientId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, clientId }),
      }).catch(() => null);
    }
  }
}
