/**
 * Koffi — Widget de chat flottant accessible sur toutes les pages.
 * Bouton FAB en bas à droite, panneau slide-up avec interface chat complète.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, SendHorizontal, X, Minimize2, Bot, User, Loader2,
  ExternalLink, ChevronDown,
} from "lucide-react";

type Citation = { label: string; url: string };
type AskResponse = {
  intent: string;
  answer: string;
  citations: Citation[];
  provider: "openai" | "heuristic";
};
type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; intent: string; citations: Citation[]; provider: string };

const SUGGESTIONS = [
  "Vue d'ensemble de l'activité",
  "Factures en retard ?",
  "Comment créer une facture ?",
  "Tâches urgentes à traiter",
  "Comment fonctionne le module Projets ?",
  "État du pipeline commercial",
];

function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start items-end">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function KoffiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) =>
      apiFetch("/api/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      }) as Promise<AskResponse>,
    onSuccess: (r) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.answer, intent: r.intent, citations: r.citations, provider: r.provider },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ask.isPending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const submit = useCallback((q: string) => {
    const text = q.trim();
    if (!text || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    ask.mutate(text);
  }, [ask]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  return (
    <>
      {/* ── Panneau chat ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[calc(100dvh-6rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#0F1A3A] shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-none">Koffi</p>
            <p className="text-white/50 text-[11px] mt-0.5">Assistant Gaméasù · IA</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setMessages([]); setInput(""); }}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors text-[10px] font-medium"
              title="Effacer la conversation"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              aria-label="Fermer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-50/40">
          {messages.length === 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-slate-100 text-sm text-slate-700 leading-relaxed max-w-[85%]">
                  Bonjour ! Je suis <strong>Koffi</strong>, votre assistant Gaméasù. Posez-moi n'importe quelle question sur l'application — modules, données, navigation, fonctionnalités.
                </div>
              </div>
              <div className="ml-9 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 items-end ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[82%] ${m.role === "user" ? "" : ""}`}>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#0F1A3A] text-white rounded-br-sm"
                    : "bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100"
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {m.role === "assistant" && (
                  <div className="mt-1.5 ml-1 flex flex-wrap gap-1 items-center">
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase px-1.5 py-0.5 ${m.provider === "openai" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                    >
                      {m.provider === "openai" ? "✦ IA" : "heuristique"}
                    </Badge>
                    {(m as any).citations?.map((c: Citation, j: number) => (
                      <Link key={j} href={c.url} onClick={() => setOpen(false)}>
                        <Badge variant="secondary" className="text-[9px] cursor-pointer hover:bg-slate-200 gap-0.5 px-1.5 py-0.5">
                          <ExternalLink className="w-2 h-2" />{c.label}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mb-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                </div>
              )}
            </div>
          ))}

          {ask.isPending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 bg-white border-t border-slate-100 shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(input); }}
            className="flex gap-2 items-center"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Posez votre question…"
              disabled={ask.isPending}
              className="flex-1 bg-white border-[1.5px] border-indigo-200 rounded-2xl text-sm h-11 px-4 focus-visible:ring-indigo-200 focus-visible:border-indigo-400 placeholder:text-slate-400 shadow-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={ask.isPending || input.trim().length < 1}
              className="h-11 w-11 rounded-2xl bg-[#0F1A3A] hover:bg-[#1a2d5a] text-white shrink-0 shadow-sm disabled:opacity-40"
            >
              {ask.isPending
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
                : <SendHorizontal className="w-[18px] h-[18px]" />}
            </Button>
          </form>
        </div>
      </div>

      {/* ── FAB bouton flottant ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 h-12 rounded-full shadow-lg transition-all duration-200 select-none group ${
          open
            ? "bg-slate-700 hover:bg-slate-600 text-white"
            : "bg-[#0F1A3A] hover:bg-[#1a2d5a] text-white"
        }`}
        style={{ boxShadow: "0 8px 24px rgba(15,26,58,0.35)" }}
        aria-label="Ouvrir Koffi — assistant Gaméasù"
      >
        <div className="relative">
          <Sparkles className={`w-4.5 h-4.5 transition-transform duration-200 ${open ? "rotate-180 scale-90" : "group-hover:scale-110"}`} />
          {!open && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-[#0F1A3A]" />
          )}
        </div>
        <span className="text-sm font-semibold tracking-wide">
          {open ? "Fermer" : "Koffi"}
        </span>
        {open && <X className="w-3.5 h-3.5 ml-0.5 opacity-70" />}
      </button>
    </>
  );
}
