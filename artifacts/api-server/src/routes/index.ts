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
import alertsRouter, { runAlertsScan } from "./alerts";
import ticketsRouter from "./tickets";
import fpaRouter from "./fpa";
import adminRouter from "./admin";
import { requireAuth } from "../middlewares/auth";
import { enforcePasswordChange } from "../middlewares/permissions";
import { seedRbac } from "../lib/rbac/seed";

const router: IRouter = Router();

// Routes publiques (login, health)
router.use(healthRouter);
router.use(authRouter);

// Toutes les autres routes nécessitent une authentification + une vérification
// "doit changer son mot de passe" qui bloque tout sauf /auth/me, /auth/logout
// et /auth/change-password (renvoie 423 → le frontend redirige).
router.use(requireAuth);
router.use(enforcePasswordChange);

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

// Seed RBAC au démarrage (idempotent).
seedRbac()
  .then((s) => console.log(`[rbac] seed OK : ${s.permissions} permissions, ${s.roles} rôles système`))
  .catch((e) => console.warn("[rbac] seed failed:", e?.message));

// Scan d'alertes au démarrage + toutes les 6h
runAlertsScan().catch((e) => console.warn("[alerts] initial scan failed:", e?.message));
setInterval(() => { runAlertsScan().catch(() => {}); }, 6 * 60 * 60 * 1000);

export default router;
