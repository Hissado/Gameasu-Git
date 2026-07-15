import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import crmRouter from "./crm";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import collaboratorsRouter from "./collaborators";
import equipmentRouter from "./equipment";
import rentalsRouter from "./rentals";
import ordersRouter from "./orders";
import messagingRouter from "./messaging";
import dashboardRouter from "./dashboard";
import uploadsRouter from "./uploads";
import reportsRouter from "./reports";
import equipmentMovementsRouter from "./equipment-movements";
import accountingRouter from "./accounting";
import hrRouter from "./hr";
import servicesRouter from "./services";
import engagementsRouter from "./engagements";
import documentsRouter from "./documents";
import marketingRouter from "./marketing";
import alertsRouter, { runAlertsScanForAllOrganizations } from "./alerts";
import ticketsRouter from "./tickets";
import fpaRouter from "./fpa";
import adminRouter from "./admin";
import organizationsRouter from "./organizations";
import subscriptionsRouter from "./subscriptions";
import billingPaymentsRouter from "./billing-payments";
import billingStripeRouter from "./billing-stripe";
import billingAddonsRouter, { seedAddonCatalog } from "./billing-addons";
import intelligenceRouter from "./intelligence";
import automationRouter from "./automation";
import attendanceRouter from "./attendance";
import attendanceReportsRouter, { sendMonthlyAttendanceReport } from "./attendance-reports";
import timesheetsRouter from "./timesheets";
import client360Router from "./client360";
import payrollRouter from "./payroll";
import payrollExtendedRouter from "./payroll-extended";
import payrollV2Router from "./payroll-v2";
import hrContractTemplatesRouter from "./hr-contract-templates";
import hrOnboardingRouter from "./hr-onboarding";
import hrExpensesRouter from "./hr-expenses";
import hrBenefitsRouter from "./hr-benefits";
import hrReportsRouter from "./hr-reports";
import hrBankRequestsRouter from "./hr-bank-requests";
import hrClaimsRouter from "./hr-claims";
import suggestionsRouter from "./suggestions";
import recruitmentRouter from "./recruitment";
import projectIntelligenceRouter from "./projectIntelligence";
import documentsIntelligenceRouter from "./documentsIntelligence";
import financeIntelligenceRouter from "./financeIntelligence";
import hrIntelligenceRouter from "./hrIntelligence";
import notificationsIntelligenceRouter from "./notificationsIntelligence";
import universalSearchRouter from "./universalSearch";
import assistantRouter from "./assistant";
import dailyBriefingRouter from "./dailyBriefing";
import pipelineIntelligenceRouter from "./pipelineIntelligence";
import approvalsQueueRouter from "./approvalsQueue";
import anomalyDetectionRouter from "./anomalyDetection";
import superAdminCockpitRouter from "./superAdminCockpit";
import cockpitAdminRouter from "./cockpitAdmin";
import cockpitTeamRouter from "./cockpitTeam";
import superAdminStructuresRouter, { publicOnboardingRouter } from "./superAdminStructures";
import marketingPublicRouter from "./marketing-public";
import orgTunerRouter from "./orgTuner";
import operationsRouter from "./operations";
import kioskAdminRouter, { kioskPublicRouter } from "./kiosk";
import storageRouter from "./storage";
import inventoryRouter from "./inventory";
import analyticsManagementRouter from "./analyticsManagement";
import pricingRouter, { pricingPublicRouter } from "./pricing";
import ordersPublicRouter from "./orders-public";
import migrationRouter from "./migration";
import periodCloseRouter from "./period-close.js";
import purchasesRouter from "./purchases";
import customAppRouter, { customAppPublicRouter } from "./customAppRequests";
import expertFirmsRouter from "./expert-firms";
import expertInvitationPublicRouter from "./expert-invitation-public";
import { accessRequestPublicRouter, accessRequestCockpitRouter } from "./access-requests";
import btpPayrollRouter from "./btp-payroll";
import taxControlRouter from "./tax-control";
import assistantIaRouter from "./assistant-ia";
import billingManualPaymentsRouter from "./billing-manual-payments";
import tourProgressRouter from "./tour-progress";
import userPreferencesRouter from "./user-preferences";
import billingCinetpayRouter, { cinetpayPublicRouter } from "./billing-cinetpay";
import billingPromoRouter from "./billing-promo";
import partnerProgramRouter, { partnerPublicRouter } from "./partner-program";
import registerPublicRouter from "./register-public";
import { seedSaas } from "@workspace/db/seed-saas";
import { seedHissado } from "@workspace/db/seed-hissado";
import { seedHissado as seedHissadoDemo } from "../services/seed-hissado";
import { seedIntelligenceDemo } from "@workspace/db/seed-intelligence";
import { seedOperationsDemo } from "@workspace/db/seed-operations";
import { seedInventoryDemo } from "@workspace/db/seed-inventory";
import { seedKiosk } from "@workspace/db/seed-kiosk";
import { requireAuth } from "../middlewares/auth";
import { enforcePasswordChange } from "../middlewares/permissions";
import { seedRbac } from "../lib/rbac/seed";
import { db, organizationsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Routes publiques (login, health, tracking marketing, formulaires, partage pricing)
router.use(healthRouter);
router.use(authRouter);
router.use(publicOnboardingRouter);
router.use(kioskPublicRouter);
router.use(storageRouter);
router.use(marketingPublicRouter);
router.use(pricingPublicRouter);
router.use(ordersPublicRouter);
router.use(customAppPublicRouter);
router.use(expertInvitationPublicRouter);
router.use(accessRequestPublicRouter);
router.use(cinetpayPublicRouter);
router.use(partnerPublicRouter);
router.use(registerPublicRouter);

// Toutes les autres routes nécessitent une authentification + une vérification
// "doit changer son mot de passe" qui bloque tout sauf /auth/me, /auth/logout
// et /auth/change-password (renvoie 423 → le frontend redirige).
router.use(requireAuth);
router.use(enforcePasswordChange);

router.use(projectIntelligenceRouter); // monté avant tasksRouter pour que /tasks/priority ne soit pas capté par /tasks/:id
router.use(documentsIntelligenceRouter); // monté avant documentsRouter
router.use(financeIntelligenceRouter);
router.use(hrIntelligenceRouter);
router.use(notificationsIntelligenceRouter); // monté avant /notifications
router.use(universalSearchRouter);
router.use(assistantRouter);
router.use(assistantIaRouter);
router.use(dailyBriefingRouter);
router.use(pipelineIntelligenceRouter);
router.use(approvalsQueueRouter);
router.use(anomalyDetectionRouter);
router.use(superAdminCockpitRouter);
router.use(accessRequestCockpitRouter);
router.use(customAppRouter);
router.use(cockpitAdminRouter);
router.use(cockpitTeamRouter);
router.use(superAdminStructuresRouter);
router.use(orgTunerRouter);
router.use(operationsRouter);
router.use(inventoryRouter);
router.use(analyticsManagementRouter);
router.use(payrollRouter);
router.use(payrollExtendedRouter);
router.use(payrollV2Router);
router.use(hrContractTemplatesRouter);
router.use(hrOnboardingRouter);
router.use(hrExpensesRouter);
router.use(hrBenefitsRouter);
router.use(hrBankRequestsRouter);
router.use(hrReportsRouter);
router.use(recruitmentRouter);
router.use(usersRouter);
router.use(clientsRouter);
router.use(crmRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(collaboratorsRouter);
router.use(equipmentRouter);
router.use(rentalsRouter);
router.use(ordersRouter);
router.use(messagingRouter);
router.use(dashboardRouter);
router.use(uploadsRouter);
router.use(reportsRouter);
router.use(equipmentMovementsRouter);
router.use(accountingRouter);
router.use(hrRouter);
router.use(hrClaimsRouter);
router.use(suggestionsRouter);
router.use(tourProgressRouter);
router.use(userPreferencesRouter);
router.use(servicesRouter);
router.use(engagementsRouter);
router.use(documentsRouter);
router.use(marketingRouter);
router.use(alertsRouter);
router.use(ticketsRouter);
router.use(fpaRouter);
router.use(adminRouter);
router.use(organizationsRouter);
router.use(subscriptionsRouter);
router.use(billingPaymentsRouter);
router.use(billingStripeRouter);
router.use(billingAddonsRouter);
router.use(intelligenceRouter);
router.use(automationRouter);
router.use(attendanceRouter);
router.use(attendanceReportsRouter);
router.use(timesheetsRouter);
router.use(client360Router);
router.use(kioskAdminRouter);
router.use(storageRouter);
router.use(pricingRouter);
router.use(migrationRouter);
router.use(periodCloseRouter);
router.use(purchasesRouter);
router.use(expertFirmsRouter);
router.use(btpPayrollRouter);
router.use(billingManualPaymentsRouter);
router.use(billingCinetpayRouter);
router.use(billingPromoRouter);
router.use(partnerProgramRouter);
router.use(taxControlRouter);

// Seed RBAC au démarrage (idempotent).
seedRbac()
  .then((s) => console.log(`[rbac] seed OK : ${s.permissions} permissions, ${s.roles} rôles système`))
  .catch((e) => console.warn("[rbac] seed failed:", e?.message));

// Seed Gameasu SaaS. Le catalogue (plans + modules) est TOUJOURS semé
// (référence indispensable, idempotent). Les données de démonstration
// (organisation démo, intelligence, opérations, inventaire, kiosk) ne sont
// semées que si SEED_DEMO_DATA=true : ainsi, en production comme après une
// réinitialisation usine, la base reste vide et propre au redémarrage.
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === "true";
seedSaas({ includeDemoData: SEED_DEMO_DATA })
  .then(() =>
    console.log(
      `[saas] seed OK : plans, modules${SEED_DEMO_DATA ? ", organisation démo, abonnement" : " (catalogue uniquement)"}`,
    ),
  )
  .then(() => (SEED_DEMO_DATA ? seedIntelligenceDemo().then(() => console.log("[intelligence] seed démo OK")) : undefined))
  .then(() => (SEED_DEMO_DATA ? seedOperationsDemo().then(() => console.log("[operations] seed démo OK")) : undefined))
  .then(() => (SEED_DEMO_DATA ? seedInventoryDemo().then(() => console.log("[inventory] seed démo OK")) : undefined))
  .then(() => (SEED_DEMO_DATA ? seedKiosk() : undefined))
  .then(() => seedAddonCatalog().then(() => console.log("[addons] catalogue add-ons semé")))
  .catch((e) => console.warn("[saas/intelligence] seed failed:", e?.message));

// Seed Hissado Consulting — organisation démo permanente (idempotent : skip si déjà présente).
seedHissado()
  .then(() => console.log("[hissado] seed OK"))
  .then(() => {
    if (process.env.SEED_HISSADO_DEMO === "true") {
      console.log("[hissado-demo] SEED_HISSADO_DEMO=true — démarrage seed données démo complètes…");
      return seedHissadoDemo().then((r) => {
        console.log("[hissado-demo] seed OK", (r as any).counts);
      });
    }
  })
  .catch((e) => console.warn("[hissado] seed failed:", e?.message));

// Scan d'alertes au démarrage + toutes les 6h
runAlertsScanForAllOrganizations().catch((e) => console.warn("[alerts] initial scan failed:", e?.message));
setInterval(() => { runAlertsScanForAllOrganizations().catch(() => {}); }, 6 * 60 * 60 * 1000);

// ── Rapport mensuel de présence : envoi automatique le 1er de chaque mois ────
// Stratégie robuste :
//   1. Vérification toutes les heures si on est le 1er du mois (toute la journée,
//      pas seulement à 7h) — couvre les redémarrages après l'heure cible.
//   2. Verrou mémoire (YYYY-MM) pour éviter plusieurs envois au cours du même processus.
//   3. Verrou DB par org (lecture notificationsTable) pour éviter les doublons en cas
//      de redémarrage du serveur le 1er : si une notification type="report_sent"
//      existe déjà pour cette org depuis le 1er du mois cible, on saute cette org.

let _lastAttendanceReportKey: string | null = null; // verrou mémoire "YYYY-MM"

function scheduleMonthlyAttendanceReports() {
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCDate() !== 1) return; // seulement le 1er du mois (toute la journée)

    // Rapport du mois précédent (ex. : le 1er août → rapport de juillet)
    const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const year = prevDate.getUTCFullYear();
    const month = prevDate.getUTCMonth() + 1;
    const memKey = `${year}-${String(month).padStart(2, "0")}`;
    if (_lastAttendanceReportKey === memKey) return; // déjà lancé dans ce processus

    try {
      const orgs = await db
        .select({ id: organizationsTable.id, name: organizationsTable.name })
        .from(organizationsTable)
        .where(eq(organizationsTable.isActive, true));

      let totalSent = 0;
      let anyOrgSent = false;
      for (const org of orgs) {
        try {
          // Verrou DB : est-ce que ce rapport a déjà été envoyé pour cette org ce mois-ci ?
          const [existing] = await db
            .select({ id: notificationsTable.id })
            .from(notificationsTable)
            .where(
              and(
                eq(notificationsTable.organizationId, org.id),
                eq(notificationsTable.type, "report_sent"),
                eq(notificationsTable.entityType, `attendance:monthly:${memKey}`),
              ),
            )
            .limit(1);

          if (existing) {
            console.log(`[attendance-reports] org=${org.name} — rapport ${memKey} déjà envoyé, skip`);
            anyOrgSent = true; // au moins une org avait déjà son rapport
            continue;
          }

          const result = await sendMonthlyAttendanceReport(org.id, year, month);
          totalSent += result.sent;
          if (result.sent > 0 || result.skipped > 0) {
            console.log(`[attendance-reports] org=${org.name} → sent=${result.sent} skipped=${result.skipped}`);
            anyOrgSent = true;
          }
          if (result.errors.length > 0) {
            console.warn(`[attendance-reports] org=${org.name} errors:`, result.errors.slice(0, 3));
          }
        } catch (e: any) {
          console.warn(`[attendance-reports] org=${org.name} failed:`, e?.message);
        }
      }

      // Verrouille le processus uniquement si au moins une org a été traitée
      // (évite de verrouiller prématurément si toutes les orgs ont échoué)
      if (anyOrgSent || totalSent > 0) {
        _lastAttendanceReportKey = memKey;
      }

      if (totalSent > 0) {
        console.log(`[attendance-reports] rapport ${memKey} terminé — ${totalSent} e-mails envoyés`);
      }
    } catch (e: any) {
      console.warn("[attendance-reports] erreur cron rapport mensuel:", e?.message);
    }
  }, 60 * 60 * 1000); // vérification toutes les heures
}

scheduleMonthlyAttendanceReports();

export default router;
