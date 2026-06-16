import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { seedSyscohada } from "./services/syscohada-seed";
import { seedHr } from "./services/hr-seed";
import { startTaxAlertScheduler } from "./services/tax-alerts";
import { ensureCockpitAdmin } from "./services/ensure-admin";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);
initRealtime(httpServer);

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");

  // L'ordre importe : seedSaas (créé ailleurs) crée les organisations, puis
  // les seeds tenant-scoped (HR, SYSCOHADA) bouclent sur ces orgs.
  try {
    await seedHr();
  } catch (e) {
    logger.error({ err: e }, "HR seed failed");
  }

  try {
    await seedSyscohada();
  } catch (e) {
    logger.error({ err: e }, "SYSCOHADA seed failed");
  }

  try {
    await ensureCockpitAdmin();
  } catch (e) {
    logger.error({ err: e }, "ensureCockpitAdmin failed");
  }

  startTaxAlertScheduler();
});
