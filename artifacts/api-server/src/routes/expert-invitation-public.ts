/**
 * Routes publiques (sans auth) pour l'invitation et l'acceptation de cabinets experts.
 *
 *  GET  /expert/invitation/:token   — valide le token, renvoie les infos du cabinet et de l'invitation
 *  POST /expert/invitation/accept   — accepte l'invitation : crée l'user admin + active le cabinet
 *
 * Ces routes DOIVENT être enregistrées AVANT router.use(requireAuth) dans routes/index.ts.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  expertFirmInvitationsTable,
  expertFirmsTable,
  expertFirmMembersTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import crypto from "node:crypto";

const router = Router();

// ── GET /expert/invitation/:token ────────────────────────────────────────────
router.get("/expert/invitation/:token", async (req, res, next) => {
  try {
    const token = req.params.token as string;
    const now = new Date();

    const rows = await db
      .select({
        id: expertFirmInvitationsTable.id,
        email: expertFirmInvitationsTable.email,
        status: expertFirmInvitationsTable.status,
        expiresAt: expertFirmInvitationsTable.expiresAt,
        firmName: expertFirmsTable.name,
        firmCountry: expertFirmsTable.country,
        firmPlan: expertFirmsTable.plan,
        firmIsActive: expertFirmsTable.isActive,
      })
      .from(expertFirmInvitationsTable)
      .innerJoin(expertFirmsTable, eq(expertFirmsTable.id, expertFirmInvitationsTable.firmId))
      .where(eq(expertFirmInvitationsTable.token, token))
      .limit(1);

    const inv = rows[0];
    if (!inv) {
      return res.status(404).json({ error: "Lien d'invitation invalide ou introuvable." });
    }
    if (inv.status === "accepted") {
      return res.status(410).json({ error: "Cette invitation a déjà été acceptée. Connectez-vous directement." });
    }
    if (inv.expiresAt < now) {
      return res.status(410).json({ error: "Ce lien a expiré (validité 72h). Demandez un nouvel envoi depuis le Cockpit." });
    }

    return res.json({
      email: inv.email,
      expiresAt: inv.expiresAt,
      firm: {
        name: inv.firmName,
        country: inv.firmCountry,
        plan: inv.firmPlan,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /expert/invitation/accept ───────────────────────────────────────────
router.post("/expert/invitation/accept", async (req, res, next) => {
  try {
    const { token, firstName, lastName, password } = req.body as {
      token: string;
      firstName: string;
      lastName: string;
      password: string;
    };

    if (!token || !firstName?.trim() || !lastName?.trim() || !password) {
      return res.status(400).json({ error: "token, firstName, lastName et password sont requis." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères." });
    }

    const now = new Date();

    // Verify invitation
    const rows = await db
      .select()
      .from(expertFirmInvitationsTable)
      .where(
        and(
          eq(expertFirmInvitationsTable.token, token),
          eq(expertFirmInvitationsTable.status, "pending"),
          gt(expertFirmInvitationsTable.expiresAt, now),
        ),
      )
      .limit(1);

    const inv = rows[0];
    if (!inv) {
      return res.status(410).json({
        error: "Ce lien est invalide, déjà utilisé ou expiré. Contactez votre administrateur Gaméasù.",
      });
    }

    // Verify email is not already registered
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, inv.email.toLowerCase()))
      .limit(1);
    if (existingUser) {
      return res.status(409).json({
        error: "Un compte existe déjà avec cette adresse email. Connectez-vous directement.",
      });
    }

    // Load the firm
    const [firm] = await db
      .select()
      .from(expertFirmsTable)
      .where(eq(expertFirmsTable.id, inv.firmId))
      .limit(1);
    if (!firm) {
      return res.status(404).json({ error: "Cabinet introuvable." });
    }

    // Hash the password
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    // Create the org for the firm if it doesn't have one yet
    let orgId = firm.organizationId;
    if (!orgId) {
      const orgSlug = firm.slug + "-cabinet";
      const [org] = await db
        .insert(organizationsTable)
        .values({
          name: firm.name,
          slug: orgSlug,
          country: firm.country,
          contactEmail: firm.email ?? inv.email,
          isActive: true,
        })
        .returning({ id: organizationsTable.id });
      orgId = org.id;

      // Link firm to org
      await db
        .update(expertFirmsTable)
        .set({ organizationId: orgId, isActive: true })
        .where(eq(expertFirmsTable.id, firm.id));
    } else {
      // Firm already has an org — just activate it
      await db
        .update(expertFirmsTable)
        .set({ isActive: true })
        .where(eq(expertFirmsTable.id, firm.id));
    }

    // Create the admin user for the firm
    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: orgId,
        email: inv.email.toLowerCase(),
        password: hashed,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: "admin",
        isActive: true,
        mustChangePassword: false,
        acceptedAt: now,
      })
      .returning();

    // Create expert firm member with role owner
    await db.insert(expertFirmMembersTable).values({
      firmId: firm.id,
      userId: user.id,
      role: "owner",
      joinedAt: now,
    });

    // Mark invitation as accepted
    await db
      .update(expertFirmInvitationsTable)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(expertFirmInvitationsTable.id, inv.id));

    // Generate a session token for immediate login
    const sessionToken = Buffer.from(`${user.id}:${user.email}`).toString("base64");

    return res.status(201).json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      firm: {
        id: firm.id,
        name: firm.name,
        slug: firm.slug,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
