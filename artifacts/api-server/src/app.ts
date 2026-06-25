import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./routes/uploads";
import { requireAuth } from "./middlewares/auth";

const app: Express = express();

// En-têtes de sécurité HTTP (helmet) : protège contre clickjacking, MIME-sniffing,
// fuite de referrer, etc. C'est une API JSON (+ médias /uploads), donc :
// - contentSecurityPolicy désactivée (pertinente pour des pages HTML, pas du JSON) ;
// - crossOriginResourcePolicy "cross-origin" pour que le frontend puisse charger
//   les médias servis sous /uploads ;
// - HSTS appliqué uniquement en production (évite de forcer HTTPS en dev local).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
  }),
);

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

// Le webhook Stripe nécessite le corps brut (Buffer) pour la vérification de signature.
// Cette route doit être AVANT express.json().
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Fichiers téléversés : accès uniquement pour utilisateurs authentifiés.
// Aucun contrôle d'autorisation par ressource n'est encore implémenté ;
// seul un Bearer token valide donne accès aux médias.
// Servis sous DEUX chemins :
//   /uploads/…     — chemin historique (compat données existantes)
//   /api/uploads/… — chemin routé par le proxy Replit (seul /api est proxifié vers ce serveur)
app.use("/uploads", requireAuth, express.static(UPLOAD_DIR));
app.use("/api/uploads", requireAuth, express.static(UPLOAD_DIR));
app.use("/api", router);

export default app;
