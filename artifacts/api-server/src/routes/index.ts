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
import intelligenceRouter from "./intelligence";
import automationRouter from "./automation";
import attendanceRouter from "./attendance";
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
import customAppRouter, { customAppPublicRouter } from "./customAppRequests";
import { seedSaas } from "@workspace/db/seed-saas";
import { seedIntelligenceDemo } from "@workspace/db/seed-intelligence";
import { seedOperationsDemo } from "@workspace/db/seed-operations";
import { seedInventoryDemo } from "@workspace/db/seed-inventory";
import { seedKiosk } from "@workspace/db/seed-kiosk";
import { requireAuth } from "../middlewares/auth";
import { enforcePasswordChange } from "../middlewares/permissions";
import { seedRbac } from "../lib/rbac/seed";

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
router.use(dailyBriefingRouter);
router.use(pipelineIntelligenceRouter);
router.use(approvalsQueueRouter);
router.use(anomalyDetectionRouter);
router.use(superAdminCockpitRouter);
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
router.use(intelligenceRouter);
router.use(automationRouter);
router.use(attendanceRouter);
router.use(client360Router);
router.use(kioskAdminRouter);
router.use(storageRouter);
router.use(pricingRouter);
router.use(migrationRouter);
router.use(periodCloseRouter);

// Seed RBAC au démarrage (idempotent).
seedRbac()
  .then((s) => console.log(`[rbac] seed OK : ${s.permissions} permissions, ${s.roles} rôles système`))
  .catch((e) => console.warn("[rbac] seed failed:", e?.message));

// Seed Gaméasù SaaS (plans, modules, organisation par défaut). Idempotent.
seedSaas()
  .then(() => console.log("[saas] seed OK : organisation, plans, modules, abonnement"))
  .then(() => seedIntelligenceDemo())
  .then(() => console.log("[intelligence] seed démo OK"))
  .then(() => seedOperationsDemo())
  .then(() => console.log("[operations] seed démo OK"))
  .then(() => seedInventoryDemo())
  .then(() => console.log("[inventory] seed démo OK"))
  .then(() => seedKiosk())
  .catch((e) => console.warn("[saas/intelligence] seed failed:", e?.message));

// Scan d'alertes au démarrage + toutes les 6h
runAlertsScanForAllOrganizations().catch((e) => console.warn("[alerts] initial scan failed:", e?.message));
setInterval(() => { runAlertsScanForAllOrganizations().catch(() => {}); }, 6 * 60 * 60 * 1000);

export default router;
