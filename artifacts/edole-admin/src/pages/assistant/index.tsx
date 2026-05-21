/**
 * Phase 13 — Assistant conversationnel Gaméasù.
 */
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, ExternalLink, Sparkles } from "lucide-react";

type Citation = { label: string; url: string };
type AskResponse = { intent: string; answer: string; citations: Citation[]; provider: "openai" | "heuristic" };

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; intent: string; citations: Citation[]; provider: string };

const SUGGESTIONS = [
  "Vue d'ensemble de mon activité",
  "Combien de factures en retard ?",
  "Tâches urgentes à traiter",
  "État des projets en cours",
  "Trouve le client SOGELEC",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) =>
      apiFetch("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question }) }) as Promise<AskResponse>,
    onSuccess: (r) => {
      setMessages((m) => [...m, { role: "assistant", content: r.answer, intent: r.intent, citations: r.citations, provider: r.provider }]);
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, ask.isPending]);

  const submit = (q: string) => {
    const text = q.trim();
    if (!text || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    ask.mutate(text);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Assistant IA</p>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Gaméasù Assistant
        </h1>
        <p className="text-muted-foreground mt-1">Posez vos questions sur l'activité : KPI, clients, projets, finances, équipe.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="min-h-[400px] max-h-[60vh] overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <Bot className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Commencez la conversation. Quelques suggestions :</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => submit(s)} className="text-xs">{s}</Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <Bot className="w-6 h-6 shrink-0 mt-1 text-primary" />}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] uppercase">{m.intent}</Badge>
                      <Badge variant="outline" className={`text-[9px] uppercase ${m.provider === "openai" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}`}>
                        {m.provider === "openai" ? "IA" : "heuristique"}
                      </Badge>
                      {m.citations.map((c, j) => (
                        <Link key={j} href={c.url}>
                          <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-muted">
                            <ExternalLink className="w-2.5 h-2.5 mr-1" />{c.label}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {m.role === "user" && <User className="w-6 h-6 shrink-0 mt-1 text-muted-foreground" />}
              </div>
            ))}
            {ask.isPending && (
              <div className="flex gap-2 justify-start">
                <Bot className="w-6 h-6 shrink-0 mt-1 text-primary" />
                <div className="bg-muted rounded-lg px-3 py-2"><Loader2 className="w-4 h-4 animate-spin" /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="mt-3 flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Posez une question…" disabled={ask.isPending} className="flex-1" />
            <Button type="submit" disabled={ask.isPending || input.trim().length < 1}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
