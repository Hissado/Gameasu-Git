import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, "_").slice(0, 50);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error("Type de fichier non autorisé"));
  },
});

router.post("/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Aucun fichier fourni" });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({
    url,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

router.post("/upload/multi", requireAuth, upload.array("files", 10), (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    res.status(400).json({ error: "Aucun fichier fourni" });
    return;
  }
  const urls = files.map((f) => `/uploads/${f.filename}`);
  res.status(201).json({ urls });
});

export default router;
export { UPLOAD_DIR };
