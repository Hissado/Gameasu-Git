import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Invoice status badge ─────────────────────────────────────────────────────

export const INV_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Brouillon",            cls: "bg-muted text-muted-foreground border" },
  review:             { label: "À revoir",             cls: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_approval:  { label: "En att. approbation",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  approved:           { label: "Approuvée",            cls: "bg-teal-50 text-teal-700 border-teal-200" },
  pending:            { label: "À payer",              cls: "bg-orange-50 text-orange-700 border-orange-200" },
  partially_paid:     { label: "Part. payée",          cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid:               { label: "Payée",                cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue:            { label: "En retard",            cls: "bg-red-50 text-red-700 border-red-200 font-bold" },
  rejected:           { label: "Refusée",              cls: "bg-red-100 text-red-800 border-red-300" },
  cancelled:          { label: "Annulée",              cls: "bg-muted/50 text-muted-foreground/60 border" },
};

export const INV_STATUS_ORDER = [
  "draft", "review", "awaiting_approval", "approved", "pending",
  "partially_paid", "paid", "overdue", "rejected", "cancelled",
];

export function StatusBadgePurchases({ status }: { status: string }) {
  const s = INV_STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── PO status badge ──────────────────────────────────────────────────────────

export const PO_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Brouillon",    cls: "bg-muted text-muted-foreground border" },
  sent:               { label: "Envoyé",       cls: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed:          { label: "Confirmé",     cls: "bg-teal-50 text-teal-700 border-teal-200" },
  partially_received: { label: "Part. reçu",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  received:           { label: "Reçu",         cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  facture:            { label: "Facturé",       cls: "bg-purple-50 text-purple-700 border-purple-200" },
  cancelled:          { label: "Annulé",        cls: "bg-muted/50 text-muted-foreground/60 border" },
};

export function StatusBadgePO({ status }: { status: string }) {
  const s = PO_STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── Payment status badge ─────────────────────────────────────────────────────

export const PAY_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  programme:  { label: "Programmé",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  en_attente: { label: "En attente",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  confirme:   { label: "Confirmé",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  echoue:     { label: "Échoué",      cls: "bg-red-50 text-red-700 border-red-200" },
  annule:     { label: "Annulé",      cls: "bg-muted/50 text-muted-foreground/60 border" },
};

export function StatusBadgePayment({ status }: { status: string }) {
  const s = PAY_STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHODS: Record<string, string> = {
  virement: "Virement bancaire",
  especes: "Espèces",
  cheque: "Chèque",
  carte: "Carte bancaire",
  mixx: "Mixx",
  flooz: "Flooz",
  autre: "Autre",
};

// ─── VendorSelect ─────────────────────────────────────────────────────────────

export type Supplier = { id: string; name: string; code: string };

export function VendorSelect({
  value, onValueChange, placeholder = "Sélectionner un fournisseur…",
}: { value: string; onValueChange: (v: string) => void; placeholder?: string }) {
  const { data } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
    staleTime: 60_000,
  });
  const suppliers = data?.data ?? [];
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {suppliers.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── BankAccountSelect ────────────────────────────────────────────────────────

export type BankAccount = { id: string; name: string; type: string };

export function BankAccountSelect({
  value, onValueChange, placeholder = "Compte bancaire (optionnel)",
}: { value: string; onValueChange: (v: string) => void; placeholder?: string }) {
  const { data } = useQuery<{ data: BankAccount[] }>({
    queryKey: ["bank-accounts-list"],
    queryFn: () => apiFetch("/api/accounting/bank-accounts"),
    staleTime: 120_000,
  });
  const accounts = data?.data ?? [];
  return (
    <Select value={value || "_none"} onValueChange={(v) => onValueChange(v === "_none" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">— Aucun compte —</SelectItem>
        {accounts.map(a => (
          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
