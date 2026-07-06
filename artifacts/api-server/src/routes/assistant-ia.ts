import { Router } from "express";
import { db } from "@workspace/db";
import {
  aiAssistantsTable,
  aiKnowledgeBaseTable,
  aiConversationsTable,
  aiMessagesTable,
  organizationsTable,
} from "@workspace/db";
import { eq, and, desc, count, gte, sql } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

function getOpenAI(): OpenAI | null {
  const apiKey = process.env["OPENAI_API_KEY"];
  const baseURL = process.env["OPENAI_BASE_URL"];
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL });
}

async function getOrCreateAssistant(organizationId: string) {
  const existing = await db
    .select()
    .from(aiAssistantsTable)
    .where(eq(aiAssistantsTable.organizationId, organizationId))
    .limit(1);
  if (existing.length > 0) return existing[0]!;

  const [org] = await db
    .select({ name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId));

  const [created] = await db
    .insert(aiAssistantsTable)
    .values({
      organizationId,
      name: `Assistant ${org?.name ?? ""}`.trim(),
      greetingMessage: `Bonjour ! Je suis l'assistant de ${org?.name ?? "votre organisation"}. Comment puis-je vous aider ?`,
      offHoursMessage: "Nos bureaux sont actuellement fermés. Laissez votre message et nous vous répondrons dès que possible.",
    })
    .returning();
  return created!;
}

function buildSystemPrompt(
  assistant: typeof aiAssistantsTable.$inferSelect,
  kbItems: Array<typeof aiKnowledgeBaseTable.$inferSelect>,
  orgName: string,
): string {
  const styleMap: Record<string, string> = {
    formal: "très formel et professionnel",
    neutral: "neutre et courtois",
    casual: "décontracté et amical",
  };
  const style = styleMap[assistant.formalityLevel] ?? "professionnel";
  let prompt = `Tu es ${assistant.name}, l'assistant virtuel IA de ${orgName}.
Ton rôle est d'aider les clients et prospects de cette organisation.
Ton ton est ${style}. Tu réponds en ${assistant.language === "fr" ? "français" : assistant.language}.
${assistant.greetingMessage ? `Message d'accueil : ${assistant.greetingMessage}` : ""}
Règles :
- Ne divulgue jamais de données financières sensibles, RH ou personnelles non autorisées.
- Ne communique jamais d'informations appartenant à une autre organisation.
- Si tu ne sais pas répondre, propose de transférer à un humain.
- Sois concis (environ ${assistant.maxResponseLength} mots max).
${assistant.allowAppointmentBooking ? "- Tu peux proposer et confirmer des rendez-vous." : ""}
${assistant.allowTicketCreation ? "- Tu peux créer des tickets de support." : ""}
${assistant.allowLeadCreation ? "- Tu peux enregistrer de nouveaux prospects/leads." : ""}
${assistant.systemPromptExtra ? `\nInstructions supplémentaires :\n${assistant.systemPromptExtra}` : ""}`;

  if (kbItems.length > 0) {
    prompt += "\n\n=== BASE DE CONNAISSANCE ===\n";
    const typeLabels: Record<string, string> = {
      faq: "FAQ",
      document: "Documents",
      info: "Informations générales",
      procedure: "Procédures",
      policy: "Politiques",
    };
    const grouped: Record<string, typeof kbItems> = {};
    for (const item of kbItems) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type]!.push(item);
    }
    for (const [type, items] of Object.entries(grouped)) {
      prompt += `\n## ${typeLabels[type] ?? type}\n`;
      for (const item of items) {
        prompt += `### ${item.title}\n${item.content}\n\n`;
      }
    }
  }
  return prompt;
}

// ── GET /api/assistant-ia/config ─────────────────────────────────────────────
router.get("/api/assistant-ia/config", async (req, res) => {
  const orgId = req.user!.organizationId;
  try {
    const assistant = await getOrCreateAssistant(orgId);
    res.json(assistant);
  } catch (err) {
    req.log.error({ err }, "assistant-ia config GET failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── PUT /api/assistant-ia/config ─────────────────────────────────────────────
router.put("/api/assistant-ia/config", async (req, res) => {
  const orgId = req.user!.organizationId;
  try {
    const assistant = await getOrCreateAssistant(orgId);
    const b = req.body as Record<string, unknown>;
    const updates: Partial<typeof aiAssistantsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if ("name" in b)                     updates.name                    = b["name"] as string;
    if ("description" in b)              updates.description             = b["description"] as string | null;
    if ("isActive" in b)                 updates.isActive                = Boolean(b["isActive"]);
    if ("language" in b)                 updates.language                = b["language"] as string;
    if ("secondaryLanguages" in b)       updates.secondaryLanguages      = b["secondaryLanguages"] as string[];
    if ("voiceGender" in b)              updates.voiceGender             = b["voiceGender"] as "female" | "male" | "neutral";
    if ("voiceStyle" in b)               updates.voiceStyle              = b["voiceStyle"] as "professional" | "warm" | "dynamic" | "institutional";
    if ("formalityLevel" in b)           updates.formalityLevel          = b["formalityLevel"] as string;
    if ("greetingMessage" in b)          updates.greetingMessage         = b["greetingMessage"] as string | null;
    if ("offHoursMessage" in b)          updates.offHoursMessage         = b["offHoursMessage"] as string | null;
    if ("availableHours" in b)           updates.availableHours          = b["availableHours"];
    if ("allowAppointmentBooking" in b)  updates.allowAppointmentBooking = Boolean(b["allowAppointmentBooking"]);
    if ("allowTicketCreation" in b)      updates.allowTicketCreation     = Boolean(b["allowTicketCreation"]);
    if ("allowLeadCreation" in b)        updates.allowLeadCreation       = Boolean(b["allowLeadCreation"]);
    if ("maxResponseLength" in b)        updates.maxResponseLength       = Number(b["maxResponseLength"]);
    if ("systemPromptExtra" in b)        updates.systemPromptExtra       = b["systemPromptExtra"] as string | null;
    if ("transferKeywords" in b)         updates.transferKeywords        = b["transferKeywords"] as string[];
    if ("phoneNumber" in b)              updates.phoneNumber             = b["phoneNumber"] as string | null;

    const [updated] = await db
      .update(aiAssistantsTable)
      .set(updates)
      .where(and(eq(aiAssistantsTable.id, assistant.id), eq(aiAssistantsTable.organizationId, orgId)))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "assistant-ia config PUT failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /api/assistant-ia/knowledge ──────────────────────────────────────────
router.get("/api/assistant-ia/knowledge", async (req, res) => {
  const orgId = req.user!.organizationId;
  try {
    const items = await db
      .select()
      .from(aiKnowledgeBaseTable)
      .where(eq(aiKnowledgeBaseTable.organizationId, orgId))
      .orderBy(aiKnowledgeBaseTable.sortOrder, aiKnowledgeBaseTable.createdAt);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "knowledge GET failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── POST /api/assistant-ia/knowledge ─────────────────────────────────────────
router.post("/api/assistant-ia/knowledge", async (req, res) => {
  const orgId = req.user!.organizationId;
  const { title, content, type, category, tags, isActive, sortOrder } = req.body as Record<string, unknown>;
  if (!title || !content) return res.status(400).json({ error: "title et content requis" });
  try {
    const assistant = await getOrCreateAssistant(orgId);
    const [item] = await db
      .insert(aiKnowledgeBaseTable)
      .values({
        organizationId: orgId,
        assistantId: assistant.id,
        title: title as string,
        content: content as string,
        type: (type as "faq" | "document" | "info" | "procedure" | "policy") ?? "faq",
        category: (category as string | null) ?? null,
        tags: (tags as string[]) ?? [],
        isActive: isActive !== false,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "knowledge POST failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── PUT /api/assistant-ia/knowledge/:id ──────────────────────────────────────
router.put("/api/assistant-ia/knowledge/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const id = req.params["id"] as string;
  const b = req.body as Record<string, unknown>;
  const updates: Partial<typeof aiKnowledgeBaseTable.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if ("title" in b)     updates.title     = b["title"] as string;
  if ("content" in b)   updates.content   = b["content"] as string;
  if ("type" in b)      updates.type      = b["type"] as "faq" | "document" | "info" | "procedure" | "policy";
  if ("category" in b)  updates.category  = b["category"] as string | null;
  if ("tags" in b)      updates.tags      = b["tags"] as string[];
  if ("isActive" in b)  updates.isActive  = Boolean(b["isActive"]);
  if ("sortOrder" in b) updates.sortOrder = Number(b["sortOrder"]);
  try {
    const [updated] = await db
      .update(aiKnowledgeBaseTable)
      .set(updates)
      .where(and(eq(aiKnowledgeBaseTable.id, id), eq(aiKnowledgeBaseTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Introuvable" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "knowledge PUT failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── DELETE /api/assistant-ia/knowledge/:id ───────────────────────────────────
router.delete("/api/assistant-ia/knowledge/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const id = req.params["id"] as string;
  try {
    await db
      .delete(aiKnowledgeBaseTable)
      .where(and(eq(aiKnowledgeBaseTable.id, id), eq(aiKnowledgeBaseTable.organizationId, orgId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "knowledge DELETE failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── POST /api/assistant-ia/chat ──────────────────────────────────────────────
router.post("/api/assistant-ia/chat", async (req, res) => {
  const orgId = req.user!.organizationId;
  const { conversationId, message, clientName, channel = "chat" } = req.body as Record<string, unknown>;
  if (!message) return res.status(400).json({ error: "message requis" });
  try {
    const openai = getOpenAI();
    const assistant = await getOrCreateAssistant(orgId);
    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId));
    const kbItems = await db
      .select()
      .from(aiKnowledgeBaseTable)
      .where(and(eq(aiKnowledgeBaseTable.organizationId, orgId), eq(aiKnowledgeBaseTable.isActive, true)))
      .orderBy(aiKnowledgeBaseTable.sortOrder);

    let convId = conversationId as string | null;
    if (!convId) {
      const [conv] = await db
        .insert(aiConversationsTable)
        .values({
          organizationId: orgId,
          assistantId: assistant.id,
          channel: (channel as "chat" | "phone" | "whatsapp" | "email") ?? "chat",
          clientName: (clientName as string | null) ?? null,
          status: "active",
        })
        .returning();
      convId = conv!.id;
    }

    const history = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, convId))
      .orderBy(aiMessagesTable.createdAt)
      .limit(20);

    await db.insert(aiMessagesTable).values({
      conversationId: convId,
      role: "user",
      content: message as string,
    });

    let reply: string;
    if (openai) {
      const systemPrompt = buildSystemPrompt(assistant, kbItems, org?.name ?? "");
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message as string },
      ];
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 600,
      });
      reply = completion.choices[0]?.message?.content?.trim()
        ?? "Je n'ai pas pu générer une réponse. Veuillez réessayer.";
    } else {
      reply = `Bonjour ! Je suis ${assistant.name}. L'IA n'est pas encore activée sur cet environnement (clé OpenAI manquante), mais votre assistant est bien configuré. Ajoutez la variable OPENAI_API_KEY pour activer les réponses intelligentes.`;
    }

    await db.insert(aiMessagesTable).values({
      conversationId: convId,
      role: "assistant",
      content: reply,
    });

    await db
      .update(aiConversationsTable)
      .set({
        messageCount: sql`${aiConversationsTable.messageCount} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(aiConversationsTable.id, convId));

    res.json({ conversationId: convId, reply });
  } catch (err) {
    req.log.error({ err }, "assistant-ia chat failed");
    res.status(500).json({ error: "Erreur lors de la génération de la réponse" });
  }
});

// ── GET /api/assistant-ia/conversations ──────────────────────────────────────
router.get("/api/assistant-ia/conversations", async (req, res) => {
  const orgId = req.user!.organizationId;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const offset = Number(req.query["offset"] ?? 0);
  try {
    const conversations = await db
      .select()
      .from(aiConversationsTable)
      .where(eq(aiConversationsTable.organizationId, orgId))
      .orderBy(desc(aiConversationsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "conversations GET failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /api/assistant-ia/conversations/:id ───────────────────────────────────
router.get("/api/assistant-ia/conversations/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const id = req.params["id"] as string;
  try {
    const [conv] = await db
      .select()
      .from(aiConversationsTable)
      .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.organizationId, orgId)));
    if (!conv) return res.status(404).json({ error: "Introuvable" });
    const messages = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, id))
      .orderBy(aiMessagesTable.createdAt);
    res.json({ ...conv, messages });
  } catch (err) {
    req.log.error({ err }, "conversation detail GET failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── DELETE /api/assistant-ia/conversations/:id ────────────────────────────────
router.delete("/api/assistant-ia/conversations/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const id = req.params["id"] as string;
  try {
    await db
      .delete(aiConversationsTable)
      .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.organizationId, orgId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "conversation DELETE failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /api/assistant-ia/stats ───────────────────────────────────────────────
router.get("/api/assistant-ia/stats", async (req, res) => {
  const orgId = req.user!.organizationId;
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totals] = await db
      .select({
        total:       count(),
        completed:   count(sql`CASE WHEN ${aiConversationsTable.status} = 'completed' THEN 1 END`),
        transferred: count(sql`CASE WHEN ${aiConversationsTable.status} = 'transferred' THEN 1 END`),
        tickets:     count(sql`CASE WHEN ${aiConversationsTable.actionTaken} = 'ticket_created' THEN 1 END`),
        leads:       count(sql`CASE WHEN ${aiConversationsTable.actionTaken} = 'lead_created' THEN 1 END`),
        appointments:count(sql`CASE WHEN ${aiConversationsTable.actionTaken} = 'appointment_set' THEN 1 END`),
      })
      .from(aiConversationsTable)
      .where(and(eq(aiConversationsTable.organizationId, orgId), gte(aiConversationsTable.createdAt, since30d)));

    const dailyRaw = await db
      .select({
        day:   sql<string>`DATE(${aiConversationsTable.createdAt})`,
        total: count(),
      })
      .from(aiConversationsTable)
      .where(and(eq(aiConversationsTable.organizationId, orgId), gte(aiConversationsTable.createdAt, since30d)))
      .groupBy(sql`DATE(${aiConversationsTable.createdAt})`)
      .orderBy(sql`DATE(${aiConversationsTable.createdAt})`);

    const [kbCount] = await db
      .select({ total: count() })
      .from(aiKnowledgeBaseTable)
      .where(eq(aiKnowledgeBaseTable.organizationId, orgId));

    const total = Number(totals?.total ?? 0);
    const completed = Number(totals?.completed ?? 0);

    res.json({
      period: "30j",
      totalConversations: total,
      completedConversations: completed,
      transferredConversations: Number(totals?.transferred ?? 0),
      ticketsCreated: Number(totals?.tickets ?? 0),
      leadsCreated: Number(totals?.leads ?? 0),
      appointmentsSet: Number(totals?.appointments ?? 0),
      resolutionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      knowledgeBaseItems: Number(kbCount?.total ?? 0),
      dailyActivity: dailyRaw.map((r) => ({ day: r.day, total: Number(r.total) })),
    });
  } catch (err) {
    req.log.error({ err }, "stats GET failed");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
