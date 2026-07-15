import { Router } from "express";
import { db, uiTourProgressTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

router.get("/onboarding/tour-progress", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const { moduleKey } = req.query as { moduleKey?: string };

    const where = moduleKey
      ? and(
          eq(uiTourProgressTable.userId, user.id),
          eq(uiTourProgressTable.moduleKey, moduleKey),
        )
      : eq(uiTourProgressTable.userId, user.id);

    const rows = await db
      .select({
        moduleKey: uiTourProgressTable.moduleKey,
        pathKey: uiTourProgressTable.pathKey,
        currentStep: uiTourProgressTable.currentStep,
        isDone: uiTourProgressTable.isDone,
      })
      .from(uiTourProgressTable)
      .where(where);

    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.put("/onboarding/tour-progress", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const { moduleKey, pathKey, currentStep, isDone } = req.body as {
      moduleKey?: string;
      pathKey?: string;
      currentStep?: number;
      isDone?: boolean;
    };

    if (!moduleKey || !pathKey || currentStep === undefined || isDone === undefined) {
      return res.status(400).json({ error: "moduleKey, pathKey, currentStep et isDone sont requis" });
    }

    const [row] = await db
      .insert(uiTourProgressTable)
      .values({ userId: user.id, moduleKey, pathKey, currentStep, isDone })
      .onConflictDoUpdate({
        target: [uiTourProgressTable.userId, uiTourProgressTable.moduleKey, uiTourProgressTable.pathKey],
        set: { currentStep, isDone, updatedAt: new Date() },
      })
      .returning();

    return res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;
