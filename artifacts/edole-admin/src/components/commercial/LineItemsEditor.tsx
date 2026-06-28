import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatFCFA } from "@/lib/format";
import { Plus, Trash2, Package, Wrench, FileText, ChevronDown } from "lucide-react";

export type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPriceFcfa: number;
  discountPct: number;
  taxRatePct: number;
  totalFcfa: number;
  position: number;
  productId?: string | null;
};

type Product = { id: string; sku: string; name: string; sellingPriceFcfa: string; taxRatePct: string; unit: string };
type Service = { id: string; code: string; name: string; unitPrice: string; unit: string; category?: string };

export function computeLineTotal(qty: number, unitPrice: number, discountPct: number, taxRatePct: number): number {
  const baseHT = unitPrice * qty * (1 - discountPct / 100);
  return Math.round(baseHT * (1 + taxRatePct / 100));
}

export function computeTotals(lines: LineItem[]) {
  const subtotalHT = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100), 0);
  const totalDiscount = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (l.discountPct / 100), 0);
  const totalTVA = lines.reduce((s, l) => {
    const baseHT = l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100);
    return s + baseHT * (l.taxRatePct / 100);
  }, 0);
  const totalTTC = subtotalHT + totalTVA;
  return {
    subtotalHT: Math.round(subtotalHT),
    totalDiscount: Math.round(totalDiscount),
    totalTVA: Math.round(totalTVA),
    totalTTC: Math.round(totalTTC),
  };
}

interface Props {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  disabled?: boolean;
  defaultTaxRate?: number;
}

export function LineItemsEditor({ lines, onChange, disabled = false, defaultTaxRate = 18 }: Props) {
  const [productOpen, setProductOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ["products-picker"],
    queryFn: () => apiFetch<{ data: Product[] }>("/api/inventory/products?limit=200").catch(() => ({ data: [] as Product[] })),
    staleTime: 60_000,
  });
  const { data: servicesData } = useQuery({
    queryKey: ["services-picker"],
    queryFn: () => apiFetch<{ data: Service[] }>("/api/services?limit=200").catch(() => ({ data: [] as Service[] })),
    staleTime: 60_000,
  });

  const products = productsData?.data ?? [];
  const services = servicesData?.data ?? [];

  const addBlankLine = () => {
    onChange([...lines, {
      description: "",
      quantity: 1,
      unitPriceFcfa: 0,
      discountPct: 0,
      taxRatePct: defaultTaxRate,
      totalFcfa: 0,
      position: lines.length,
    }]);
  };

  const addFromProduct = (product: Product) => {
    const unitPrice = Number(product.sellingPriceFcfa);
    const taxRate = Number(product.taxRatePct);
    onChange([...lines, {
      description: product.name,
      quantity: 1,
      unitPriceFcfa: unitPrice,
      discountPct: 0,
      taxRatePct: taxRate,
      totalFcfa: computeLineTotal(1, unitPrice, 0, taxRate),
      position: lines.length,
      productId: product.id,
    }]);
    setProductOpen(false);
  };

  const addFromService = (service: Service) => {
    const unitPrice = Number(service.unitPrice);
    onChange([...lines, {
      description: service.name,
      quantity: 1,
      unitPriceFcfa: unitPrice,
      discountPct: 0,
      taxRatePct: defaultTaxRate,
      totalFcfa: computeLineTotal(1, unitPrice, 0, defaultTaxRate),
      position: lines.length,
    }]);
    setServiceOpen(false);
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = lines.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, [field]: value };
      next.totalFcfa = computeLineTotal(
        field === "quantity" ? Number(value) : Number(l.quantity),
        field === "unitPriceFcfa" ? Number(value) : Number(l.unitPriceFcfa),
        field === "discountPct" ? Number(value) : Number(l.discountPct),
        field === "taxRatePct" ? Number(value) : Number(l.taxRatePct),
      );
      return next;
    });
    onChange(updated);
  };

  const removeLine = (idx: number) => {
    onChange(lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i })));
  };

  const totals = computeTotals(lines);

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {products.length > 0 && (
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Package className="w-3.5 h-3.5" /> Produit <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher un produit…" className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Aucun produit trouvé</CommandEmpty>
                    <CommandGroup>
                      {products.map(p => (
                        <CommandItem key={p.id} value={p.name} onSelect={() => addFromProduct(p)}
                          className="text-xs flex justify-between cursor-pointer">
                          <span className="truncate">{p.name}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{formatFCFA(Number(p.sellingPriceFcfa))}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {services.length > 0 && (
            <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Wrench className="w-3.5 h-3.5" /> Service <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher un service…" className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Aucun service trouvé</CommandEmpty>
                    <CommandGroup>
                      {services.map(s => (
                        <CommandItem key={s.id} value={s.name} onSelect={() => addFromService(s)}
                          className="text-xs flex justify-between cursor-pointer">
                          <span className="truncate">{s.name}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{formatFCFA(Number(s.unitPrice))}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={addBlankLine}>
            <FileText className="w-3.5 h-3.5" /> Ligne libre
          </Button>
        </div>
      )}

      {lines.length > 0 ? (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Description</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">Qté</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-28">PU HT</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">Remise</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">TVA</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-28">Total TTC</th>
                {!disabled && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-muted/20 group">
                  <td className="px-1 py-1">
                    {disabled
                      ? <span className="px-1 py-0.5 block">{line.description}</span>
                      : <Input value={line.description} onChange={e => updateLine(idx, "description", e.target.value)}
                          className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white" placeholder="Description…" />
                    }
                  </td>
                  <td className="px-1 py-1">
                    {disabled
                      ? <span className="text-right block px-1">{line.quantity}</span>
                      : <Input type="number" min="0.001" step="any" value={line.quantity}
                          onChange={e => updateLine(idx, "quantity", Number(e.target.value))}
                          className="h-7 text-xs text-right bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white" />
                    }
                  </td>
                  <td className="px-1 py-1">
                    {disabled
                      ? <span className="text-right block px-1">{formatFCFA(line.unitPriceFcfa)}</span>
                      : <Input type="number" min="0" step="1" value={line.unitPriceFcfa}
                          onChange={e => updateLine(idx, "unitPriceFcfa", Number(e.target.value))}
                          className="h-7 text-xs text-right bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white" />
                    }
                  </td>
                  <td className="px-1 py-1">
                    {disabled
                      ? <span className="text-right block px-1">{line.discountPct}%</span>
                      : <Input type="number" min="0" max="100" step="0.5" value={line.discountPct}
                          onChange={e => updateLine(idx, "discountPct", Number(e.target.value))}
                          className="h-7 text-xs text-right bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white" />
                    }
                  </td>
                  <td className="px-1 py-1">
                    {disabled
                      ? <span className="text-right block px-1">{line.taxRatePct}%</span>
                      : <Input type="number" min="0" max="100" step="0.5" value={line.taxRatePct}
                          onChange={e => updateLine(idx, "taxRatePct", Number(e.target.value))}
                          className="h-7 text-xs text-right bg-transparent border-transparent hover:border-input focus:border-input focus:bg-white" />
                    }
                  </td>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">
                    {formatFCFA(line.totalFcfa)}
                  </td>
                  {!disabled && (
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => removeLine(idx)}
                        className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive rounded transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !disabled && (
          <div className="border-2 border-dashed rounded-md p-8 text-center text-muted-foreground text-sm">
            <Plus className="w-6 h-6 mx-auto mb-2 opacity-30" />
            Aucune ligne — utilisez les boutons ci-dessus pour ajouter des produits, services ou lignes libres
          </div>
        )
      )}

      {lines.length > 0 && (
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total HT</span>
              <span className="tabular-nums">{formatFCFA(totals.subtotalHT)}</span>
            </div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Total remises</span>
                <span className="tabular-nums">− {formatFCFA(totals.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>TVA</span>
              <span className="tabular-nums">{formatFCFA(totals.totalTVA)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
              <span>Total TTC</span>
              <span className="tabular-nums text-[#2563EB]">{formatFCFA(totals.totalTTC)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
