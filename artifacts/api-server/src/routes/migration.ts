/**
 * Migration & Import API — Gaméasù
 * Endpoints pour télécharger les templates, uploader/parser/valider/importer des fichiers.
 */
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import {
  importSessionsTable, importMappingsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  MODULES,
  getModule,
  parseCSV,
  suggestMapping,
  applyMapping,
  validateRows,
  executeImport,
  storeParsedFile,
  getParsedFile,
  deleteParsedFile,
} from "../lib/migration-engine.js";
import { generateTemplate } from "../lib/migration-templates.js";

const router = Router();

// Multer — upload vers /tmp/migration-uploads
const upload = multer({
  dest: "/tmp/migration-uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(ext)) cb(null, true);
    else cb(new Error("Seuls les fichiers Excel (.xlsx) et CSV sont acceptés."));
  },
});

// ── GET /migration/modules ─────────────────────────────────────────────────────

router.get("/migration/modules", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const sessions = await db.select({
      module: importSessionsTable.module,
      status: importSessionsTable.status,
      importedRows: importSessionsTable.importedRows,
      createdAt: importSessionsTable.createdAt,
    }).from(importSessionsTable)
      .where(eq(importSessionsTable.organizationId, orgId))
      .orderBy(desc(importSessionsTable.createdAt));

    const latestByModule = new Map<string, typeof sessions[0]>();
    for (const s of sessions) {
      if (!latestByModule.has(s.module)) latestByModule.set(s.module, s);
    }

    const modules = MODULES.map(m => ({
      ...m,
      fields: m.fields.length,
      requiredFields: m.fields.filter(f => f.required).length,
      lastImport: latestByModule.get(m.id) ?? null,
    }));

    const completed = modules.filter(m => m.lastImport?.status === "done").length;
    res.json({
      modules,
      progress: { total: modules.length, completed, pct: Math.round((completed / modules.length) * 100) },
    });
  } catch (e) { next(e); }
});

// ── GET /migration/templates/:module ─────────────────────────────────────────

router.get("/migration/templates/:module", requireAuth, async (req, res, next) => {
  try {
    const mod = getModule(req.params.module);
    if (!mod) { res.status(404).json({ error: "Module introuvable" }); return; }
    await generateTemplate(mod, res);
  } catch (e) { next(e); }
});

// ── POST /migration/upload — parse file, return headers + preview ─────────────

router.post("/migration/upload", requireAuth, requireManagerOrAbove, upload.single("file"), async (req, res, next) => {
  const tmpPath = (req.file as Express.Multer.File | undefined)?.path;
  try {
    const moduleId = req.body.module as string;
    if (!moduleId) { res.status(400).json({ error: "Paramètre module manquant" }); return; }
    const mod = getModule(moduleId);
    if (!mod) { res.status(400).json({ error: `Module inconnu : ${moduleId}` }); return; }
    if (!req.file) { res.status(400).json({ error: "Aucun fichier reçu" }); return; }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let headers: string[] = [];
    let rows: string[][] = [];

    if (ext === ".csv") {
      const content = await fs.readFile(tmpPath!, "utf-8");
      const parsed = parseCSV(content);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(tmpPath!);
      // Find first non-instruction sheet (skip sheets named "Instructions" or "Procédure")
      let ws = wb.worksheets.find(s => !["Instructions", "Procédure", "instructions"].includes(s.name)) ?? wb.worksheets[0];
      if (!ws) throw new Error("Fichier Excel vide");

      // Find header row (first row with at least 2 non-empty cells)
      let headerRowIdx = 1;
      for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
        const row = ws.getRow(r);
        const vals = Array.from({ length: row.cellCount }, (_, i) => {
          const v = row.getCell(i + 1).value;
          return v ? String(v).trim() : "";
        });
        if (vals.filter(v => v).length >= 2) { headerRowIdx = r; break; }
      }

      const headerRow = ws.getRow(headerRowIdx);
      headers = Array.from({ length: headerRow.cellCount }, (_, i) => {
        const v = headerRow.getCell(i + 1).value;
        return v ? String(v).trim().replace(" *", "") : "";
      }).filter(h => h);

      ws.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIdx) return;
        const cells = Array.from({ length: headers.length }, (_, i) => {
          const v = row.getCell(i + 1).value;
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (typeof v === "object" && "result" in v) return String((v as ExcelJS.CellFormulaValue).result ?? "");
          if (typeof v === "object" && "richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map(t => t.text).join("").trim();
          return String(v).trim();
        });
        if (cells.some(c => c)) rows.push(cells);
      });
    }

    if (tmpPath) await fs.unlink(tmpPath).catch(() => {});

    const fileId = storeParsedFile({ module: moduleId, headers, rows });
    const suggested = suggestMapping(headers, mod);
    const preview = rows.slice(0, 5).map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    });

    res.json({
      fileId,
      fileName: req.file.originalname,
      headers,
      rowCount: rows.length,
      preview,
      suggestedMapping: suggested,
      module: { id: mod.id, label: mod.label, fields: mod.fields },
    });
  } catch (e) {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => {});
    next(e);
  }
});

// ── POST /migration/validate ──────────────────────────────────────────────────

router.post("/migration/validate", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const { fileId, mapping } = req.body as { fileId: string; mapping: Record<string, string> };
    if (!fileId || !mapping) { res.status(400).json({ error: "fileId et mapping requis" }); return; }

    const file = getParsedFile(fileId);
    if (!file) { res.status(404).json({ error: "Session de fichier expirée. Veuillez re-uploader le fichier." }); return; }

    const mod = getModule(file.module);
    if (!mod) { res.status(400).json({ error: "Module inconnu" }); return; }

    const nonEmptyRows = file.rows.filter(r => !r.every(c => !c.trim()));
    const { errors, validCount, errorCount } = validateRows(file.rows, file.headers, mapping, mod);

    const unmappedRequired = mod.fields
      .filter(f => f.required && !Object.values(mapping).includes(f.key))
      .map(f => f.label);

    res.json({
      totalRows: nonEmptyRows.length,
      validRows: validCount,
      errorRows: errorCount,
      errors: errors.slice(0, 100),
      errorCount: errors.filter(e => e.severity === "error").length,
      warningCount: errors.filter(e => e.severity === "warning").length,
      unmappedRequired,
      canImport: unmappedRequired.length === 0 && errors.filter(e => e.severity === "error").length === 0,
    });
  } catch (e) { next(e); }
});

// ── POST /migration/execute ───────────────────────────────────────────────────

router.post("/migration/execute", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const { fileId, mapping, saveMappingName } = req.body as { fileId: string; mapping: Record<string, string>; saveMappingName?: string };
    if (!fileId || !mapping) { res.status(400).json({ error: "fileId et mapping requis" }); return; }

    const file = getParsedFile(fileId);
    if (!file) { res.status(404).json({ error: "Session expirée. Veuillez re-uploader." }); return; }

    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;

    // Create session record (status = importing)
    const [session] = await db.insert(importSessionsTable).values({
      organizationId: orgId,
      userId,
      module: file.module,
      status: "importing",
      totalRows: file.rows.filter(r => !r.every(c => !c.trim())).length,
      mappingUsed: mapping,
    }).returning({ id: importSessionsTable.id });

    let importResult;
    let finalStatus = "done";
    try {
      importResult = await executeImport(file, mapping, orgId, db);
    } catch (e) {
      finalStatus = "error";
      importResult = { imported: 0, skipped: 0, errors: [{ row: 0, message: (e as Error).message }], ids: [] };
    }

    // Update session
    await db.update(importSessionsTable).set({
      status: finalStatus,
      importedRows: importResult.imported,
      validRows: importResult.imported,
      errorRows: importResult.skipped,
      errors: importResult.errors,
      summary: {
        imported: importResult.imported,
        skipped: importResult.skipped,
        totalIds: importResult.ids.length,
      },
      completedAt: new Date(),
    }).where(eq(importSessionsTable.id, session.id));

    // Save mapping if requested
    if (saveMappingName?.trim()) {
      await db.insert(importMappingsTable).values({
        organizationId: orgId,
        module: file.module,
        name: saveMappingName.trim(),
        mapping,
      }).onConflictDoNothing();
    }

    deleteParsedFile(fileId);

    res.json({
      sessionId: session.id,
      status: finalStatus,
      imported: importResult.imported,
      skipped: importResult.skipped,
      errors: importResult.errors.slice(0, 50),
    });
  } catch (e) { next(e); }
});

// ── GET /migration/sessions ───────────────────────────────────────────────────

router.get("/migration/sessions", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const sessions = await db.select().from(importSessionsTable)
      .where(eq(importSessionsTable.organizationId, orgId))
      .orderBy(desc(importSessionsTable.createdAt))
      .limit(100);
    res.json({ sessions });
  } catch (e) { next(e); }
});

// ── GET /migration/sessions/:id ───────────────────────────────────────────────

router.get("/migration/sessions/:id", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [session] = await db.select().from(importSessionsTable)
      .where(and(eq(importSessionsTable.id, req.params.id), eq(importSessionsTable.organizationId, orgId)));
    if (!session) { res.status(404).json({ error: "Session introuvable" }); return; }
    res.json(session);
  } catch (e) { next(e); }
});

// ── GET /migration/mappings — saved column mappings ───────────────────────────

router.get("/migration/mappings", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { module } = req.query as { module?: string };
    const q = module
      ? db.select().from(importMappingsTable).where(and(eq(importMappingsTable.organizationId, orgId), eq(importMappingsTable.module, module)))
      : db.select().from(importMappingsTable).where(eq(importMappingsTable.organizationId, orgId));
    const mappings = await q;
    res.json({ mappings });
  } catch (e) { next(e); }
});

export default router;
