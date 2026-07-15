import { Router } from "express";
import { db, userDashboardPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_WIDGETS = [
  { id: "kpis",           enabled: true },
  { id: "quick-links",    enabled: true },
  { id: "clock",          enabled: true },
  { id: "intelligence",   enabled: true },
  { id: "alerts",         enabled: true },
  { id: "upcoming-tasks", enabled: true },
  { id: "chart",          enabled: true },
  { id: "projects",       enabled: true },
  { id: "activity",       enabled: true },
];

router.get("/user-preferences/dashboard", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const [row] = await db
      .select({ widgetConfig: userDashboardPreferencesTable.widgetConfig })
      .from(userDashboardPreferencesTable)
      .where(eq(userDashboardPreferencesTable.userId, userId))
      .limit(1);
    return res.json({ widgetConfig: row?.widgetConfig ?? DEFAULT_WIDGETS });
  } catch (e) {
    next(e);
  }
});

router.put("/user-preferences/dashboard", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { widgetConfig } = req.body as { widgetConfig?: { id: string; enabled: boolean }[] };
    if (!Array.isArray(widgetConfig)) {
      return res.status(400).json({ error: "widgetConfig doit être un tableau" });
    }
    const [row] = await db
      .insert(userDashboardPreferencesTable)
      .values({ userId, widgetConfig })
      .onConflictDoUpdate({
        target: userDashboardPreferencesTable.userId,
        set: { widgetConfig, updatedAt: new Date() },
      })
      .returning();
    return res.json({ widgetConfig: row.widgetConfig });
  } catch (e) {
    next(e);
  }
});

router.delete("/user-preferences/dashboard", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    await db
      .delete(userDashboardPreferencesTable)
      .where(eq(userDashboardPreferencesTable.userId, userId));
    return res.json({ widgetConfig: DEFAULT_WIDGETS });
  } catch (e) {
    next(e);
  }
});

export default router;
