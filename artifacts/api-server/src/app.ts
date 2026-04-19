import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./routes/uploads";
import { requireAuth } from "./middlewares/auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers téléversés : accès uniquement pour utilisateurs authentifiés.
// Aucun contrôle d'autorisation par ressource n'est encore implémenté ;
// seul un Bearer token valide donne accès aux médias.
app.use("/uploads", requireAuth, express.static(UPLOAD_DIR));
app.use("/api", router);

export default app;
