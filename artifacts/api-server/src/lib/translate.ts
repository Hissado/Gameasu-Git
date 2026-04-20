import OpenAI from "openai";
import { logger } from "./logger";

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (_client) return _client;
  const apiKey = process.env["OPENAI_API_KEY"];
  const baseURL = process.env["OPENAI_BASE_URL"];
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "français",
  en: "anglais",
  ar: "arabe",
  pt: "portugais",
  es: "espagnol",
  de: "allemand",
};

export async function translateText(text: string, targetLang: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    logger.warn("Translation requested but OPENAI_API_KEY not configured");
    return null;
  }
  const label = LANGUAGE_LABELS[targetLang] || targetLang;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `Tu es un traducteur professionnel. Traduis le texte fourni en ${label}. Retourne uniquement la traduction, sans préambule ni guillemets.`,
        },
        { role: "user", content: text },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    logger.error({ err: e }, "Translation failed");
    return null;
  }
}

export async function transcribeAudio(filePath: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    logger.warn("Transcription requested but OPENAI_API_KEY not configured");
    return null;
  }
  try {
    const fs = await import("node:fs");
    const file = fs.createReadStream(filePath);
    const result = await client.audio.transcriptions.create({
      file: file as unknown as File,
      model: "gpt-4o-mini-transcribe",
    });
    return result.text || null;
  } catch (e) {
    logger.error({ err: e }, "Transcription failed");
    return null;
  }
}
