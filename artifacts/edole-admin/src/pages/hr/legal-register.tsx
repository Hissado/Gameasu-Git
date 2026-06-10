import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Download, Search } from "lucide-react";

type RegisterEntry = {
  id: string; matricule?: string; firstName: string; lastName: string; poste?: string; department?: string;
  gender?: string; nationality?: string; birthDate?: string; hireDate?: string; endDate?: string; status: string;
  contractType: string; contractStart?: string; contractEnd?: string;
};

export default function LegalRegister() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ items: RegisterEntry[]; total: number }>({
    queryKey: ["legal-register"],
    queryFn: () => apiFetch("/api/hr/legal-register"),
  });

  const filtered = (data?.items ?? []).filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${e.firstName} ${e.lastName} ${e.poste ?? ""} ${e.department ?? ""} ${e.matricule ?? ""}`.toLowerCase().includes(q);
  });

  function downloadPdf() {
    const token = localStorage.getItem("auth_token");
    const a = document.createElement("a");
    a.href = `/api/hr/legal-register?format=pdf`;
    a.setAttribute("download", "registre-personnel.pdf");
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `/api/hr/legal-register?format=pdf`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "blob";
    xhr.onload = () => { const url = URL.createObjectURL(xhr.response); a.href = url; a.click(); URL.revokeObjectURL(url); };
    xhr.send();
  }

  return (
    <HrShell
      title="Registre du personnel légal"
      subtitle="Document officiel réglementaire — entrées et sorties du personnel"
      actions={<Button size="sm" onClick={downloadPdf}><Download className="w-4 h-4 mr-1" />Télécharger PDF</Button>}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} / {data?.total ?? 0} collaborateur{(data?.total ?? 0) > 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucun résultat.</p></div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-3 text-left">#</th>
                <th className="px-3 py-3 text-left">Matricule</th>
                <th className="px-3 py-3 text-left">Nom & Prénom</th>
                <th className="px-3 py-3 text-left">Poste</th>
                <th className="px-3 py-3 text-left">Département</th>
                <th className="px-3 py-3 text-left">Nationalité</th>
                <th className="px-3 py-3 text-left">Date naissance</th>
                <th className="px-3 py-3 text-left">Entrée</th>
                <th className="px-3 py-3 text-left">Sortie</th>
                <th className="px-3 py-3 text-left">Type contrat</th>
                <th className="px-3 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{e.matricule ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium">{e.lastName} {e.firstName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.poste ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.department ?? "—"}</td>
                  <td className="px-3 py-2.5">{e.nationality ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.birthDate ? new Date(e.birthDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5">{e.hireDate ? new Date(e.hireDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline" className="text-xs">{e.contractType}</Badge></td>
                  <td className="px-3 py-2.5"><Badge variant={e.status === "active" ? "default" : "secondary"} className="text-xs">{e.status === "active" ? "Actif" : "Inactif"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HrShell>
  );
}
