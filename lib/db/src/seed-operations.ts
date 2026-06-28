/**
 * Seed démo Operations Command Center.
 * Idempotent : se base sur la présence d'au moins une mission.
 */
import { db } from "./index";
import {
  operationsMissionsTable, operationsChecklistsTable, operationsChecklistItemsTable,
  operationsCheckinsTable, operationsProofsTable, operationsIncidentsTable,
  operationsCostsTable,
} from "./schema/operations";
import { organizationsTable } from "./schema/saas";
import { usersTable } from "./schema/users";
import { clientsTable } from "./schema/clients";
import { projectsTable } from "./schema/projects";
import { eq, sql } from "drizzle-orm";

export async function seedOperationsDemo(): Promise<void> {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(operationsMissionsTable);
  if (c > 0) { console.log("• Seed opérations skip : déjà présent"); return; }

  const [org] = await db.select().from(organizationsTable).limit(1);
  if (!org) return;

  const users = await db.select().from(usersTable).limit(5);
  if (users.length === 0) return;
  const responsible = users[0];

  const clients = await db.select().from(clientsTable).limit(3);
  const projects = await db.select().from(projectsTable).limit(3);

  const now = new Date();
  const inDays = (d: number, h = 9) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x; };

  const samples: Array<any> = [
    {
      reference: "OPS-2026-0001", kind: "delivery",
      title: "Livraison ciment chantier Lomé Plateau",
      description: "Livraison de 50 sacs de ciment + ferraillage.",
      priority: "high", status: "completed",
      originAddress: "Dépôt Gameasu — Lomé Akodéséwa",
      originLat: 6.1319, originLng: 1.2228,
      destinationAddress: "Chantier client — Lomé Plateau",
      destinationLat: 6.1725, destinationLng: 1.2270,
      scheduledStart: inDays(-2, 8), scheduledEnd: inDays(-2, 11),
      actualStart: inDays(-2, 8.5), actualEnd: inDays(-2, 11.5),
      responsibleUserId: responsible.id, clientId: clients[0]?.id, projectId: projects[0]?.id,
      payloadJson: [{ label: "Sacs ciment 50kg", plannedQty: 50, actualQty: 50 }, { label: "Fers à béton", plannedQty: 30, actualQty: 30 }],
      estimatedCostFcfa: "75000", actualCostFcfa: "82000", isBillable: true,
    },
    {
      reference: "OPS-2026-0002", kind: "install",
      title: "Installation groupe électrogène — Kara",
      description: "Pose et mise en service d'un groupe 50 kVA.",
      priority: "urgent", status: "in_progress",
      originAddress: "Atelier Gameasu", destinationAddress: "Site client — Kara",
      destinationLat: 9.5511, destinationLng: 1.1861,
      scheduledStart: inDays(0, 9), scheduledEnd: inDays(0, 17),
      actualStart: inDays(0, 9), responsibleUserId: users[1]?.id ?? responsible.id,
      clientId: clients[1]?.id, projectId: projects[1]?.id,
      teamUserIds: users.slice(1, 3).map((u) => u.id),
      estimatedCostFcfa: "180000",
    },
    {
      reference: "OPS-2026-0003", kind: "intervention",
      title: "Intervention dépannage climatisation",
      description: "SAV — climatisation hors-service salle serveur.",
      priority: "urgent", status: "en_route",
      destinationAddress: "Siège client — Lomé Adidogomé",
      destinationLat: 6.1582, destinationLng: 1.1718,
      scheduledStart: inDays(0, 14), responsibleUserId: users[2]?.id ?? responsible.id,
      clientId: clients[2]?.id, estimatedCostFcfa: "45000",
    },
    {
      reference: "OPS-2026-0004", kind: "collect",
      title: "Collecte matériel chantier terminé",
      description: "Récupération échafaudage et outillage en fin de chantier.",
      priority: "normal", status: "planned",
      destinationAddress: "Chantier achevé — Tsévié",
      destinationLat: 6.4264, destinationLng: 1.2131,
      scheduledStart: inDays(2, 8), scheduledEnd: inDays(2, 12),
      clientId: clients[0]?.id, estimatedCostFcfa: "35000",
    },
    {
      reference: "OPS-2026-0005", kind: "supply",
      title: "Approvisionnement carburant flotte",
      description: "Plein hebdomadaire de la flotte logistique.",
      priority: "normal", status: "assigned",
      destinationAddress: "Station-service partenaire — Lomé",
      scheduledStart: inDays(1, 7), responsibleUserId: users[1]?.id ?? responsible.id,
      estimatedCostFcfa: "150000",
    },
    {
      reference: "OPS-2026-0006", kind: "transfer",
      title: "Transfert outillage Lomé → Atakpamé",
      description: "Transfert inter-dépôts.",
      priority: "low", status: "blocked",
      destinationAddress: "Dépôt Atakpamé",
      destinationLat: 7.5333, destinationLng: 1.1333,
      scheduledStart: inDays(-1, 6), responsibleUserId: users[3]?.id ?? responsible.id,
      estimatedCostFcfa: "60000",
    },
    {
      reference: "OPS-2026-0007", kind: "site_visit",
      title: "Visite technique avant devis",
      description: "Métré et relevé pour préparation offre commerciale.",
      priority: "normal", status: "completed",
      destinationAddress: "Prospect — Aného",
      destinationLat: 6.2273, destinationLng: 1.5980,
      scheduledStart: inDays(-5, 10), scheduledEnd: inDays(-5, 12),
      actualStart: inDays(-5, 10), actualEnd: inDays(-5, 12.5),
      responsibleUserId: users[2]?.id ?? responsible.id, clientId: clients[1]?.id,
    },
  ];

  for (const s of samples) {
    const [m] = await db.insert(operationsMissionsTable).values({
      organizationId: org.id, ...s, createdById: responsible.id,
    }).returning();
    if (!m) continue;

    // Checklists basiques
    const phases: Array<{ phase: string; title: string; items: Array<{ label: string; required?: boolean; done?: boolean }> }> = [
      { phase: "pre_departure", title: "Avant départ", items: [
        { label: "Documents préparés", required: true, done: ["completed", "in_progress", "en_route", "on_site"].includes(s.status) },
        { label: "Chargement vérifié", required: true, done: ["completed", "in_progress", "en_route", "on_site"].includes(s.status) },
        { label: "Véhicule contrôlé", done: s.status === "completed" },
      ]},
      { phase: "arrival", title: "Arrivée sur site", items: [
        { label: "Présence client confirmée", done: ["completed", "in_progress", "on_site"].includes(s.status) },
      ]},
      { phase: "end", title: "Fin de mission", items: [
        { label: "Signature client", required: true, done: s.status === "completed" },
        { label: "Photo preuve", required: true, done: s.status === "completed" },
      ]},
    ];
    for (const p of phases) {
      const doneCount = p.items.filter((i) => i.done).length;
      const [cl] = await db.insert(operationsChecklistsTable).values({
        organizationId: org.id, missionId: m.id, phase: p.phase, title: p.title,
        totalItems: p.items.length, doneItems: doneCount,
        status: doneCount === 0 ? "pending" : doneCount === p.items.length ? "done" : "in_progress",
      }).returning();
      if (cl) {
        await db.insert(operationsChecklistItemsTable).values(p.items.map((it, idx) => ({
          checklistId: cl.id, label: it.label, required: it.required ?? false,
          done: it.done ?? false, doneAt: it.done ? new Date() : null, doneById: it.done ? responsible.id : null,
          ordering: idx,
        })));
      }
    }

    // Check-ins pour missions actives/terminées
    if (["completed", "in_progress", "on_site"].includes(s.status)) {
      await db.insert(operationsCheckinsTable).values({
        organizationId: org.id, missionId: m.id, userId: s.responsibleUserId ?? responsible.id,
        kind: "check_in", lat: s.destinationLat, lng: s.destinationLng,
        accuracyMeters: 12, locationLabel: s.destinationAddress, at: s.actualStart ?? new Date(),
      });
      if (s.status === "completed") {
        await db.insert(operationsCheckinsTable).values({
          organizationId: org.id, missionId: m.id, userId: s.responsibleUserId ?? responsible.id,
          kind: "check_out", lat: s.destinationLat, lng: s.destinationLng,
          accuracyMeters: 12, at: s.actualEnd ?? new Date(),
        });
      }
    }

    // Preuves pour missions terminées
    if (s.status === "completed") {
      await db.insert(operationsProofsTable).values({
        organizationId: org.id, missionId: m.id,
        recipientName: "Responsable de site",
        comment: "Réception conforme.",
        lat: s.destinationLat, lng: s.destinationLng,
        validatedById: s.responsibleUserId ?? responsible.id, status: "valid",
      });
    }

    // Incidents sur quelques missions
    if (s.reference === "OPS-2026-0003") {
      await db.insert(operationsIncidentsTable).values({
        organizationId: org.id, missionId: m.id, kind: "delay", severity: "medium",
        description: "Trafic dense sur l'axe Lomé–Adidogomé, retard estimé 30 min.",
        reportedById: responsible.id, status: "open",
      });
    }
    if (s.reference === "OPS-2026-0006") {
      await db.insert(operationsIncidentsTable).values({
        organizationId: org.id, missionId: m.id, kind: "breakdown", severity: "high",
        description: "Panne mécanique véhicule. En attente de dépannage.",
        reportedById: responsible.id, status: "in_progress",
        correctiveAction: "Équipe technique dépêchée sur place.",
      });
    }

    // Coûts pour missions terminées ou en cours
    if (s.actualCostFcfa || ["in_progress", "completed"].includes(s.status)) {
      const baseAmount = parseFloat(s.estimatedCostFcfa ?? "50000");
      await db.insert(operationsCostsTable).values([
        { organizationId: org.id, missionId: m.id, kind: "fuel", label: "Carburant", amountFcfa: String(Math.round(baseAmount * 0.25)), isEstimate: false },
        { organizationId: org.id, missionId: m.id, kind: "labor", label: "Main-d'œuvre", amountFcfa: String(Math.round(baseAmount * 0.5)), isEstimate: false },
        { organizationId: org.id, missionId: m.id, kind: "transport", label: "Transport", amountFcfa: String(Math.round(baseAmount * 0.25)), isEstimate: false },
      ]);
    }
  }

  console.log(`[operations] seed démo OK (${samples.length} missions)`);
}
