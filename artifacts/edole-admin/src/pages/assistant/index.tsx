/**
 * Koffi — Page dédiée de l'assistant (accessible via /assistant).
 * L'expérience principale est le widget flottant disponible sur toutes les pages.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, ExternalLink, Sparkles, User, RotateCcw } from "lucide-react";

type Citation = { label: string; url: string };
type AskResponse = { intent: string; answer: string; citations: Citation[]; provider: "openai" | "heuristic" };
type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; intent: string; citations: Citation[]; provider: string };

const SUGGESTIONS = [
  "Vue d'ensemble de l'activité",
  "Combien de factures en retard ?",
  "Comment créer un projet ?",
  "Tâches urgentes à traiter",
  "Comment fonctionne le CRM ?",
  "État de la trésorerie",
  "Explique le module Finance",
  "Comment ajouter un collaborateur ?",
];

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start items-end">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function KoffiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) =>
      apiFetch("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question }) }) as Promise<AskResponse>,
    onSuccess: (r) => {
      setMessages((m) => [...m, { role: "assistant", content: r.answer, intent: r.intent, citations: r.citations, provider: r.provider }]);
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, ask.isPending]);

  const submit = useCallback((q: string) => {
    const text = q.trim();
    if (!text || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    ask.mutate(text);
  }, [ask]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Assistant IA</p>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0F1A3A] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            Koffi
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Posez vos questions sur n'importe quel module — KPI, clients, projets, finances, équipe, navigation, fonctionnalités.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setMessages([])} className="gap-2">
            <RotateCcw className="w-3.5 h-3.5" /> Nouvelle conversation
          </Button>
        )}
      </div>

      {/* Chat area */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {/* Messages */}
          <div className="min-h-[450px] max-h-[60vh] overflow-y-auto p-5 space-y-4 bg-slate-50/30 rounded-t-xl">
            {messages.length === 0 && (
              <div className="space-y-5 pt-4">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 text-sm text-slate-700 leading-relaxed max-w-[85%]">
                    Bonjour ! Je suis <strong>Koffi</strong>, votre assistant Gameasu. Posez-moi n'importe quelle question sur la plateforme — modules, données en temps réel, navigation, fonctionnalités, et bien plus.
                  </div>
                </div>
                <div className="ml-11">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Suggestions :</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        onClick={() => submit(s)}
                        className="text-xs h-8 rounded-full hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 items-end ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-0.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="max-w-[80%]">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#0F1A3A] text-white rounded-br-sm"
                      : "bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100"
                  }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  {m.role === "assistant" && (
                    <div className="mt-2 ml-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase px-1.5 py-0.5 ${m.provider === "openai" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                      >
                        {m.provider === "openai" ? "✦ IA" : "heuristique"}
                      </Badge>
                      {(m as any).citations?.map((c: Citation, j: number) => (
                        <Link key={j} href={c.url}>
                          <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-slate-200 gap-1 px-1.5 py-0.5">
                            <ExternalLink className="w-2.5 h-2.5" />{c.label}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mb-0.5">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                )}
              </div>
            ))}

            {ask.isPending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-white rounded-b-xl">
            <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question à Koffi…"
                disabled={ask.isPending}
                className="flex-1 bg-slate-50 border-slate-200 rounded-xl"
                autoFocus
              />
              <Button
                type="submit"
                disabled={ask.isPending || input.trim().length < 1}
                className="rounded-xl bg-[#0F1A3A] hover:bg-[#0F1A3A]/90 px-4"
              >
                {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
