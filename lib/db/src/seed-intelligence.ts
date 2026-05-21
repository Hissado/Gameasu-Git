/**
 * Seed démo : couche d'intelligence Gaméasù.
 * Crée scores, risques, insights, recommandations, résumés et pointages
 * de démonstration pour rendre l'expérience visiblement intelligente.
 * Idempotent — n'ajoute rien si des lignes existent déjà.
 */
import { db } from "./index";
import {
  organizationsTable,
  smartScoresTable, riskFlagsTable, insightsTable, recommendationsTable,
  attendanceSessionsTable, attendanceRecordsTable, attendanceFlagsTable,
  collaboratorsTable, clientsTable, projectsTable, tasksTable,
} from "./schema";
import { eq, isNull } from "drizzle-orm";

function todayMinus(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}
function dateOnly(d: Date) { return d.toISOString().slice(0, 10); }

export async function seedIntelligenceDemo() {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, "nexora-demo")).limit(1);
  if (!org) {
    console.log("• Seed intelligence skip : pas d'organisation nexora-demo");
    return;
  }
  const orgId = org.id;

  // Skip si déjà seedé
  const existing = await db.select().from(smartScoresTable).where(eq(smartScoresTable.organizationId, orgId)).limit(1);
  if (existing[0]) {
    console.log("• Seed intelligence skip : déjà présent");
    return;
  }

  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt)).limit(10);
  const projects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt)).limit(10);
  const tasks = await db.select().from(tasksTable).limit(10);
  const collabs = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt)).limit(20);

  console.log(`• Seed intelligence : ${clients.length} clients, ${projects.length} projets, ${tasks.length} tâches, ${collabs.length} collaborateurs`);

  // ─── Scores santé clients ─────────────────────────────────────
  const tier = (v: number) => v >= 80 ? "excellent" : v >= 60 ? "high" : v >= 40 ? "medium" : v >= 20 ? "low" : "critical";
  const scoreRows: Array<typeof smartScoresTable.$inferInsert> = [];
  clients.forEach((c, i) => {
    const v = [72, 88, 54, 38][i % 4];
    scoreRows.push({
      organizationId: orgId, entityType: "client", entityId: c.id, scoreType: "health",
      value: v, tier: tier(v), computedBy: "heuristic",
      factors: [
        { key: "payment_speed", label: "Délai de paiement", weight: 30, value: v - 5, reason: "Moyenne 18 jours après échéance" },
        { key: "engagement", label: "Engagement commercial", weight: 25, value: v + 3, reason: "3 projets actifs, 12 échanges/mois" },
        { key: "revenue_share", label: "Part du CA", weight: 25, value: v, reason: "Top 10 client" },
        { key: "incidents", label: "Incidents récents", weight: 20, value: 100 - v, reason: i === 3 ? "2 réclamations ouvertes" : "Aucun" },
      ],
    });
  });
  projects.forEach((p, i) => {
    const v = [85, 62, 41][i % 3];
    scoreRows.push({
      organizationId: orgId, entityType: "project", entityId: p.id, scoreType: "risk",
      value: v, tier: tier(v), computedBy: "heuristic",
      factors: [
        { key: "schedule", label: "Respect du planning", weight: 40, value: v, reason: i === 1 ? "Retard de 8 jours sur jalon 2" : "Dans les temps" },
        { key: "budget", label: "Tenue budgétaire", weight: 30, value: v + 5, reason: "Consommé à 62%" },
        { key: "team_capacity", label: "Capacité équipe", weight: 30, value: v - 3, reason: "1 ressource clé en surcharge" },
      ],
    });
  });
  tasks.forEach((t, i) => {
    const v = [95, 70, 45, 30][i % 4];
    scoreRows.push({
      organizationId: orgId, entityType: "task", entityId: t.id, scoreType: "priority",
      value: v, tier: tier(v), computedBy: "heuristic",
      factors: [
        { key: "due_proximity", label: "Proximité échéance", weight: 50, value: v },
        { key: "blockers", label: "Blocages", weight: 30, value: i === 2 ? 80 : 20, reason: i === 2 ? "Dépend de validation client" : "Aucun" },
        { key: "criticality", label: "Criticité projet", weight: 20, value: v - 10 },
      ],
    });
  });
  if (scoreRows.length) await db.insert(smartScoresTable).values(scoreRows);

  // ─── Drapeaux de risque ───────────────────────────────────────
  const riskRows: Array<typeof riskFlagsTable.$inferInsert> = [];
  if (clients[2]) riskRows.push({
    organizationId: orgId, entityType: "client", entityId: clients[2].id, severity: "high",
    category: "financial", title: "Encours impayé en hausse",
    description: `${clients[2].name} cumule 3 factures échues depuis plus de 45 jours.`,
    metadata: { overdueAmount: 8_750_000, currency: "XOF" },
  });
  if (projects[1]) riskRows.push({
    organizationId: orgId, entityType: "project", entityId: projects[1].id, severity: "medium",
    category: "operational", title: "Glissement de planning détecté",
    description: "La tendance des 14 derniers jours projette un retard de 12 jours sur la livraison.",
    metadata: { drift_days: 12 },
  });
  if (projects[0]) riskRows.push({
    organizationId: orgId, entityType: "project", entityId: projects[0].id, severity: "low",
    category: "commercial", title: "Opportunité d'upsell détectée",
    description: "Le client a évoqué 2x le besoin d'une option de maintenance prolongée.",
  });
  riskRows.push({
    organizationId: orgId, entityType: "workspace", severity: "medium",
    category: "hr", title: "Surcharge sur 2 collaborateurs clés",
    description: "Aïssatou et Kofi accumulent plus de 50h hebdo depuis 3 semaines.",
  });
  if (riskRows.length) await db.insert(riskFlagsTable).values(riskRows);

  // ─── Insights ─────────────────────────────────────────────────
  const insightRows: Array<typeof insightsTable.$inferInsert> = [
    {
      organizationId: orgId, kind: "trend", scope: "finance", audienceRole: "direction",
      title: "Taux de recouvrement en hausse de +12 %",
      body: "Les paiements clients sont plus rapides ce mois-ci, notamment sur les clients du segment BTP.",
      severity: "success", actionLabel: "Voir le reporting", actionUrl: "/fpa",
      metadata: { delta_pct: 12 },
    },
    {
      organizationId: orgId, kind: "anomaly", scope: "client", audienceRole: "commercial",
      scopeId: clients[2]?.id ?? null,
      title: "Client à risque d'attrition",
      body: "Baisse de 60 % des échanges et 2 réclamations non clôturées sur 30 jours.",
      severity: "warning", actionLabel: "Ouvrir la fiche client", actionUrl: clients[2] ? `/clients/${clients[2].id}` : undefined,
    },
    {
      organizationId: orgId, kind: "opportunity", scope: "workspace", audienceRole: "manager",
      title: "3 prospects chauds non traités depuis 7 jours",
      body: "Score d'engagement > 70 — relance à programmer en priorité.",
      severity: "info", actionLabel: "Ouvrir le pipeline", actionUrl: "/crm",
    },
    {
      organizationId: orgId, kind: "reminder", scope: "rh", audienceRole: "rh",
      title: "5 collaborateurs n'ont pas encore pointé aujourd'hui",
      body: "Vérifier les oublis avant la clôture de la journée.",
      severity: "info", actionLabel: "Ouvrir le pointage", actionUrl: "/attendance",
    },
  ];
  await db.insert(insightsTable).values(insightRows);

  // ─── Recommandations ───────────────────────────────────────────
  const recoRows: Array<typeof recommendationsTable.$inferInsert> = [
    {
      organizationId: orgId, entityType: "client", entityId: clients[0]?.id ?? null,
      action: "propose_contract",
      title: "Proposer un contrat-cadre de maintenance",
      reason: "Le client a manifesté 2 fois un besoin de service récurrent.",
      priority: "high", impact: "commercial",
      ctaLabel: "Ouvrir la fiche client", ctaUrl: clients[0] ? `/clients/${clients[0].id}` : undefined,
      metadata: { confidence: 78, suggestedAmount: 4_500_000, currency: "XOF" },
    },
    {
      organizationId: orgId, entityType: "client", entityId: clients[1]?.id ?? null,
      action: "switch_billing_cycle",
      title: "Activer la facturation hebdomadaire",
      reason: "Les délais moyens sont passés sous 14 jours — un cycle de facturation plus court accélèrera la trésorerie.",
      priority: "medium", impact: "financial",
      metadata: { confidence: 65 },
    },
    {
      organizationId: orgId, entityType: "project", entityId: projects[1]?.id ?? null,
      action: "rebalance_resources",
      title: "Réallouer 0,5 ETP du projet A vers le projet B",
      reason: "Le projet A a 14 jours d'avance, le projet B accumule un retard.",
      priority: "high", impact: "operational",
      ctaLabel: "Voir le projet", ctaUrl: projects[1] ? `/projects/${projects[1].id}` : undefined,
      metadata: { confidence: 71 },
    },
    {
      organizationId: orgId, entityType: "client", entityId: clients[2]?.id ?? null,
      action: "escalate_steerco",
      title: "Organiser un comité de pilotage immédiat",
      reason: "Score santé en chute libre (-18 pts en 30 j).",
      priority: "urgent", impact: "retention",
      ctaLabel: "Ouvrir la fiche client", ctaUrl: clients[2] ? `/clients/${clients[2].id}` : undefined,
      metadata: { confidence: 82 },
    },
  ];
  await db.insert(recommendationsTable).values(recoRows);

  // ─── Pointages démo (14 jours sur 5 collab) ───────────────────
  if (collabs.length > 0) {
    const subset = collabs.slice(0, 5);
    for (let d = 13; d >= 0; d--) {
      const day = todayMinus(d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekend
      for (const c of subset) {
        const dept = (c as any).departmentId ?? null;
        const lateMinutes = Math.random() < 0.2 ? Math.round(Math.random() * 30) + 5 : 0;
        const clockIn = new Date(day); clockIn.setHours(8, 30 + lateMinutes, 0, 0);
        const breakStart = new Date(day); breakStart.setHours(12, 30, 0, 0);
        const breakDur = 45 + Math.round(Math.random() * 30);
        const breakEnd = new Date(breakStart.getTime() + breakDur * 60_000);
        const clockOut = new Date(day); clockOut.setHours(17, 30, 0, 0);
        const total = Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000);
        const eff = total - breakDur;
        const isLate = lateMinutes > 0;
        const [sess] = await db.insert(attendanceSessionsTable).values({
          organizationId: orgId,
          collaboratorId: c.id,
          userId: (c as any).userId ?? null,
          departmentId: dept,
          workDate: dateOnly(day),
          status: "closed",
          clockInAt: clockIn,
          clockOutAt: clockOut,
          totalMinutes: total,
          breakMinutes: breakDur,
          effectiveMinutes: eff,
          isLate,
          isEarlyLeave: false,
        }).returning();

        // Coordonnées Lomé (centre) + jitter
        const lat = 6.1319 + (Math.random() - 0.5) * 0.02;
        const lng = 1.2228 + (Math.random() - 0.5) * 0.02;
        const events = [
          { kind: "clock_in", t: clockIn },
          { kind: "break_start", t: breakStart },
          { kind: "break_end", t: breakEnd },
          { kind: "clock_out", t: clockOut },
        ];
        await db.insert(attendanceRecordsTable).values(events.map((e) => ({
          organizationId: orgId,
          sessionId: sess.id,
          collaboratorId: c.id,
          userId: (c as any).userId ?? null,
          kind: e.kind,
          occurredAt: e.t,
          latitude: lat.toFixed(7),
          longitude: lng.toFixed(7),
          accuracyMeters: 25,
          locationLabel: "Lomé - Siège Gaméasù Demo",
          sourceDevice: "demo-seed",
          status: "validated",
        })));

        if (isLate && d <= 5) {
          await db.insert(attendanceFlagsTable).values({
            organizationId: orgId,
            collaboratorId: c.id,
            sessionId: sess.id,
            kind: "late",
            severity: lateMinutes > 20 ? "medium" : "low",
            workDate: dateOnly(day),
            description: `Arrivée tardive de ${lateMinutes} minutes`,
          });
        }
      }
    }
  }

  console.log(`✓ Seed intelligence terminé : ${scoreRows.length} scores, ${riskRows.length} risques, ${insightRows.length} insights, ${recoRows.length} recos, pointages démo créés`);
}
