import app from "./app";
import { logger } from "./lib/logger";
import { seedSyscohada } from "./services/syscohada-seed";
import { seedHr } from "./services/hr-seed";

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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Initialise le plan comptable SYSCOHADA, journaux, exercice et trésorerie
  // par défaut. Idempotent : aucune action si tout est déjà seedé.
  try {
    await seedSyscohada();
  } catch (e) {
    logger.error({ err: e }, "SYSCOHADA seed failed");
  }

  try {
    await seedHr();
  } catch (e) {
    logger.error({ err: e }, "HR seed failed");
  }
});
