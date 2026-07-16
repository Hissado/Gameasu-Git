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

// Derrière le proxy Replit — lit X-Forwarded-For pour obtenir l'IP réelle du client.
app.set("trust proxy", 1);

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

// Les webhooks de passerelles de paiement nécessitent le corps brut (Buffer)
// pour la vérification de signature HMAC. Ces routes doivent être AVANT express.json().
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/api/webhooks/cinetpay", express.raw({ type: "*/*" }));

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

// Middleware d'erreur global — doit être enregistré APRÈS toutes les routes.
// Capture les erreurs async non gérées relayées via next(err) ou les rejets
// de promesse dans Express 5 (qui les propage automatiquement).
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const log = (req as any).log ?? logger;
  const status = typeof (err as any)?.status === "number"
    ? (err as any).status
    : typeof (err as any)?.statusCode === "number"
    ? (err as any).statusCode
    : 500;
  if (status >= 500) {
    log.error({ err }, "Unhandled server error");
  }
  if (!res.headersSent) {
    res.status(status).json({
      error: status < 500
        ? (err instanceof Error ? err.message : "Erreur de requête")
        : "Erreur interne du serveur",
    });
  }
});

export default app;
