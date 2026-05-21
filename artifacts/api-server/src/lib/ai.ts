import OpenAI from "openai";
import { logger } from "./logger";

let _client: OpenAI | null = null;
let _disabled = false;

export function getAIClient(): OpenAI | null {
  if (_disabled) return null;
  if (_client) return _client;
  const apiKey = process.env["OPENAI_API_KEY"];
  const baseURL = process.env["OPENAI_BASE_URL"];
  if (!apiKey) {
    _disabled = true;
    return null;
  }
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export function aiAvailable(): boolean {
  return getAIClient() !== null;
}

/**
 * Génère un résumé court en français professionnel à partir d'un contexte structuré.
 * Retourne `null` si OpenAI n'est pas configuré (le caller doit prévoir un fallback).
 */
export async function summarize(opts: {
  system?: string;
  context: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getAIClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content:
            opts.system ||
            "Tu es un assistant exécutif francophone pour une plateforme SaaS B2B (Nexora, marché Togo / Afrique de l'Ouest). Rédige des résumés courts, professionnels, factuels et actionnables. Pas de préambule. Pas d'emoji. Français business clair.",
        },
        { role: "user", content: opts.context },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    logger.error({ err: e }, "AI summarize failed");
    return null;
  }
}

/**
 * Génère une liste structurée d'éléments (recommandations, prochaines actions, etc.)
 * Retourne `null` en cas d'absence d'IA ou d'erreur.
 */
export async function generateList(opts: {
  system?: string;
  prompt: string;
  maxItems?: number;
}): Promise<string[] | null> {
  const client = getAIClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content:
            opts.system ||
            "Tu es un assistant business francophone. Renvoie UNIQUEMENT une liste JSON de chaînes courtes (10 à 18 mots chacune), sans clé, sans commentaire. Format: [\"...\", \"...\"]. Pas de markdown.",
        },
        { role: "user", content: opts.prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    try {
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr)) {
        const max = opts.maxItems || 8;
        return arr.filter((x) => typeof x === "string").slice(0, max);
      }
    } catch {
      // fallback: split par retour ligne / puces
      return cleaned
        .split(/\n+/)
        .map((l) => l.replace(/^[\s\-\*\d\.\)]+/, "").trim())
        .filter((l) => l.length > 0)
        .slice(0, opts.maxItems || 8);
    }
    return null;
  } catch (e) {
    logger.error({ err: e }, "AI generateList failed");
    return null;
  }
}
