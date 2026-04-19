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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
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

export default router;
