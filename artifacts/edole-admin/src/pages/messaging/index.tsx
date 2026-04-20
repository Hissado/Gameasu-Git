import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search, Send, MessageSquare, Paperclip, Smile, MapPin, Mic, MicOff, Phone, Video,
  CheckCheck, Check, MoreVertical, Reply, Pencil, Trash2, Languages, Pin, BellOff, Bell, Archive, MessageCircle,
  Plus, X, Loader2, Image as ImageIcon, FileText, Filter,
} from "lucide-react";
import { apiFetch, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket, useRealtime, useConversationRoom, emitTyping } from "@/lib/realtime";
import { useCallCenter } from "@/components/CallCenter";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────
type Participant = {
  userId: string; name: string; avatarUrl?: string | null; role?: string;
  phone?: string | null;
  archived?: boolean; muted?: boolean; pinned?: boolean; isAdmin?: boolean;
  presenceStatus?: "online" | "offline" | null; lastSeenAt?: string | null;
};

function whatsappUrl(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
type Conv = {
  id: string; title?: string | null; type: string;
  projectId?: string | null; clientId?: string | null;
  lastMessage?: string | null; lastMessageAt?: string | null;
  participants: Participant[]; unreadCount: number;
  archived?: boolean; muted?: boolean; pinned?: boolean;
  source?: string;
};
type Attachment = {
  id?: string; url: string; mime: string; sizeBytes?: number | null;
  kind?: string; thumbnailUrl?: string | null; durationSeconds?: number | null;
  width?: number | null; height?: number | null; filename?: string | null;
};
type Reaction = { emoji: string; userId: string };
type Msg = {
  id: string; conversationId: string; senderId: string;
  senderName?: string | null; senderAvatarUrl?: string | null;
  content: string; attachmentUrl?: string | null;
  kind: "text" | "image" | "voice" | "file" | "location" | string;
  metadata?: Record<string, any> | null;
  replyToMessageId?: string | null;
  translations?: Record<string, string> | null;
  editedAt?: string | null; deletedAt?: string | null;
  createdAt: string;
  readBy: string[]; reactions: Reaction[]; attachments: Attachment[];
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🙏", "👏"];
const TARGET_LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "ar", label: "Arabe" },
  { code: "pt", label: "Portugais" },
  { code: "es", label: "Espagnol" },
];

// ─── Utils ──────────────────────────────────────────────────────────────────
function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  if (now.getTime() - d.getTime() < 7 * 86400000) {
    return d.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function formatTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function getOther(conv: Conv, meId: string): Participant | undefined {
  return conv.participants.find((p) => p.userId !== meId);
}
function convDisplayName(conv: Conv, meId: string): string {
  if (conv.title) return conv.title;
  if (conv.type === "direct") {
    const other = getOther(conv, meId);
    return other?.name || "Discussion";
  }
  return conv.participants.map((p) => p.name?.split(" ")[0]).join(", ") || "Groupe";
}
function attachmentKind(mime: string): "image" | "voice" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "voice";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

// ─── Hooks Data ─────────────────────────────────────────────────────────────
function useConversations(filters: { search?: string; archived?: boolean; projectId?: string; clientId?: string }) {
  const [data, setData] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.search) qs.set("search", filters.search);
    if (filters.archived !== undefined) qs.set("archived", String(filters.archived));
    if (filters.projectId) qs.set("projectId", filters.projectId);
    if (filters.clientId) qs.set("clientId", filters.clientId);
    qs.set("limit", "100");
    apiFetch<{ data: Conv[] }>(`/api/conversations?${qs}`)
      .then((r) => { if (!cancelled) setData(r.data || []); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.search, filters.archived, filters.projectId, filters.clientId, refreshKey]);
  return { data, loading, refresh, setData };
}

function useMessages(conversationId: string | null) {
  const [data, setData] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!conversationId) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ data: Msg[] }>(`/api/conversations/${conversationId}/messages?limit=100`)
      .then((r) => { if (!cancelled) setData(r.data || []); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [conversationId]);
  return { data, setData, loading };
}

function useUsers() {
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string; avatarUrl?: string }>>([]);
  useEffect(() => {
    apiFetch<{ data: any[] }>(`/api/users?limit=100`).then((r) => setUsers(r.data || [])).catch(() => setUsers([]));
  }, []);
  return users;
}

// ─── Components ─────────────────────────────────────────────────────────────
function PresenceDot({ status }: { status?: string | null }) {
  const online = status === "online";
  return (
    <span className={cn(
      "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
      online ? "bg-emerald-500" : "bg-slate-300",
    )} />
  );
}

function ReadReceipt({ readByCount }: { readByCount: number }) {
  if (readByCount > 1) return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  return <Check className="w-3.5 h-3.5 text-slate-400" />;
}

function VoicePlayer({ url, durationSeconds }: { url: string; durationSeconds?: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("auth_token");
  const src = url ? `${url}${url.includes("?") ? "&" : "?"}token=${token || ""}` : "";
  return (
    <div className="flex items-center gap-3 min-w-[220px]">
      {!error && (
        <button
          type="button"
          disabled={!src}
          onClick={async () => {
            const a = audioRef.current;
            if (!a) return;
            if (playing) { a.pause(); setPlaying(false); return; }
            try {
              await a.play();
              setPlaying(true);
            } catch (err: any) {
              setError(err?.message || "Lecture impossible");
              setPlaying(false);
            }
          }}
          className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          {playing ? <span className="w-3 h-3 bg-white rounded-sm" /> : <span className="ml-0.5 border-l-[10px] border-l-white border-y-[7px] border-y-transparent" />}
        </button>
      )}
      <div className="flex-1">
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          {error ? <span className="text-rose-600">Audio indisponible</span> : formatDuration(durationSeconds)}
        </div>
      </div>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onError={() => { setError("source"); setPlaying(false); }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (a.duration) setProgress((a.currentTime / a.duration) * 100);
          }}
        />
      )}
    </div>
  );
}

function LocationCard({ metadata }: { metadata: any }) {
  const lat = metadata?.lat, lng = metadata?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return <div className="text-sm">📍 Position</div>;
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
      target="_blank" rel="noreferrer"
      className="block w-[260px] rounded-lg overflow-hidden border border-slate-200"
    >
      <div className="h-24 bg-slate-100 bg-gradient-to-br from-emerald-50 to-sky-50 flex items-center justify-center">
        <MapPin className="w-10 h-10 text-rose-500" />
      </div>
      <div className="p-2 bg-white text-xs">
        <div className="font-semibold text-slate-700 truncate">{metadata?.label || "Position partagée"}</div>
        <div className="text-slate-500">{lat.toFixed(5)}, {lng.toFixed(5)}</div>
      </div>
    </a>
  );
}

function AttachmentPreview({ a }: { a: Attachment }) {
  const token = localStorage.getItem("auth_token");
  const src = `${a.url}${a.url.includes("?") ? "&" : "?"}token=${token}`;
  if (a.mime.startsWith("image/")) {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <img src={src} alt={a.filename || "image"} className="rounded-lg max-w-[300px] max-h-[260px] object-cover border border-slate-200" />
      </a>
    );
  }
  if (a.mime.startsWith("video/")) {
    return <video src={src} controls className="rounded-lg max-w-[320px] max-h-[260px] border border-slate-200" />;
  }
  if (a.mime.startsWith("audio/")) {
    // Les messages vocaux sont rendus uniquement comme texte transcrit (cf. bulle).
    return null;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg max-w-[280px] hover:bg-slate-50">
      <FileText className="w-8 h-8 text-rose-500 shrink-0" />
      <div className="overflow-hidden">
        <div className="text-sm font-medium text-slate-800 truncate">{a.filename || "Document"}</div>
        <div className="text-xs text-slate-500">{a.mime} {a.sizeBytes ? `· ${(a.sizeBytes / 1024).toFixed(0)} Ko` : ""}</div>
      </div>
    </a>
  );
}

function MessageBubble({
  msg, isMe, otherPresent, onReact, onReply, onEdit, onDelete, onTranslate, onTranscribe, repliedMsg, autoTransLang,
}: {
  msg: Msg; isMe: boolean; otherPresent: number;
  onReact: (emoji: string) => void; onReply: () => void;
  onEdit: () => void; onDelete: () => void;
  onTranslate: (lang: string) => void;
  onTranscribe: () => void;
  repliedMsg?: Msg | null;
  autoTransLang?: string | null;
}) {
  const [showTrans, setShowTrans] = useState<string | null>(autoTransLang || null);
  React.useEffect(() => { if (autoTransLang) setShowTrans(autoTransLang); }, [autoTransLang]);
  const reactionMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of msg.reactions || []) m.set(r.emoji, (m.get(r.emoji) || 0) + 1);
    return Array.from(m.entries());
  }, [msg.reactions]);

  const isDeleted = !!msg.deletedAt;
  const transcript = msg.metadata?.["transcript"] as string | undefined;
  const translatedText = showTrans ? msg.translations?.[showTrans] : null;

  return (
    <div className={cn("flex flex-col group max-w-[78%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
      {!isMe && (
        <div className="text-[11px] font-semibold text-slate-500 mb-1 ml-2">{msg.senderName}</div>
      )}
      <div className="flex items-end gap-2">
        {!isMe && (
          <Avatar className="w-7 h-7">
            {msg.senderAvatarUrl ? <AvatarImage src={msg.senderAvatarUrl} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{initials(msg.senderName)}</AvatarFallback>
          </Avatar>
        )}
        <div className={cn(
          "p-3 text-sm shadow-sm break-words relative",
          isMe ? "bg-primary text-white rounded-2xl rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-sm",
          isDeleted && "italic opacity-60",
        )}>
          {repliedMsg && (
            <div className={cn(
              "text-xs px-2 py-1 mb-2 border-l-2 rounded",
              isMe ? "bg-white/15 border-white/40" : "bg-slate-50 border-primary/40",
            )}>
              <div className="font-semibold opacity-80">{repliedMsg.senderName}</div>
              <div className="opacity-70 truncate">{repliedMsg.content || "(pièce jointe)"}</div>
            </div>
          )}
          {isDeleted ? (
            <span>Message supprimé</span>
          ) : (
            <>
              {msg.kind === "location" ? (
                <LocationCard metadata={msg.metadata} />
              ) : (
                <>
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2">
                      {msg.attachments.map((a, i) => <AttachmentPreview key={i} a={a} />)}
                    </div>
                  )}
                  {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                  {translatedText && (
                    <div className={cn("mt-2 pt-2 border-t text-xs italic", isMe ? "border-white/30" : "border-slate-200")}>
                      <div className="opacity-70">Traduction :</div>
                      <div>{translatedText}</div>
                    </div>
                  )}
                  {msg.kind === "voice" && (
                    transcript ? (
                      <div className="whitespace-pre-wrap">{transcript}</div>
                    ) : (
                      <div className={cn("text-xs italic flex items-center gap-1.5", isMe ? "text-white/70" : "text-slate-500")}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        Transcription en cours…
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>
        {!isDeleted && (
          <div className="opacity-40 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-slate-400 hover:text-primary p-1"><Smile className="w-4 h-4" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 flex gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition-transform p-1">{e}</button>
                ))}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-slate-400 hover:text-primary p-1"><MoreVertical className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isMe ? "end" : "start"}>
                <DropdownMenuItem onClick={onReply}><Reply className="w-4 h-4 mr-2" /> Répondre</DropdownMenuItem>
                {msg.content && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg.content!)}`, "_blank", "noopener,noreferrer")}
                    >
                      <MessageCircle className="w-4 h-4 mr-2 text-[#25D366]" /> Partager via WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {TARGET_LANGS.map((l) => (
                      <DropdownMenuItem key={l.code} onClick={() => { onTranslate(l.code); setShowTrans(l.code); }}>
                        <Languages className="w-4 h-4 mr-2" /> Traduire en {l.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {msg.kind === "voice" && !transcript && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onTranscribe}>🎙️ Transcrire</DropdownMenuItem>
                  </>
                )}
                {isMe && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEdit}><Pencil className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {reactionMap.length > 0 && (
        <div className={cn("flex gap-1 mt-1", isMe ? "mr-1" : "ml-9")}>
          {reactionMap.map(([emoji, count]) => (
            <button
              key={emoji} onClick={() => onReact(emoji)}
              className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 hover:border-primary"
            >{emoji} {count}</button>
          ))}
        </div>
      )}
      <div className={cn("text-[10px] text-slate-400 mt-1 mx-1 flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
        <span>{formatTime(msg.createdAt)}</span>
        {msg.editedAt && <span>· modifié</span>}
        {isMe && !isDeleted && <ReadReceipt readByCount={msg.readBy?.length || 0} />}
      </div>
    </div>
  );
}

// ─── New Conversation Dialog ────────────────────────────────────────────────
function NewConversationDialog({ onCreated }: { onCreated: (c: Conv) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const users = useUsers();
  const me = useAuth().user;
  const filtered = users.filter((u) => u.id !== me?.id && (
    !search || `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
  ));

  async function create() {
    if (selected.length === 0) return;
    const c = await apiFetch<Conv>("/api/conversations", {
      method: "POST",
      body: {
        title: selected.length > 1 ? (title || null) : null,
        type: selected.length > 1 ? "group" : "direct",
        participantIds: selected,
      } as any,
    });
    onCreated(c);
    setOpen(false);
    setSelected([]); setTitle(""); setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white font-semibold">
          <Plus className="w-4 h-4 mr-1" /> Nouveau Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouvelle discussion</DialogTitle></DialogHeader>
        {selected.length > 1 && (
          <Input placeholder="Nom du groupe (optionnel)" value={title} onChange={(e) => setTitle(e.target.value)} />
        )}
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.map((u) => {
            const isSel = selected.includes(u.id);
            return (
              <button key={u.id}
                onClick={() => setSelected((s) => isSel ? s.filter((x) => x !== u.id) : [...s, u.id])}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left",
                  isSel ? "bg-primary/10" : "hover:bg-slate-50",
                )}
              >
                <Avatar className="w-8 h-8">
                  {u.avatarUrl ? <AvatarImage src={u.avatarUrl} /> : null}
                  <AvatarFallback className="text-xs">{initials(`${u.firstName} ${u.lastName}`)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{u.firstName} {u.lastName}</span>
                {isSel && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
        <Button onClick={create} disabled={selected.length === 0} className="bg-primary text-white">
          Créer ({selected.length})
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function Messaging() {
  const me = useAuth().user;
  const meId = me?.id || "";
  const callCenter = useCallCenter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const { data: conversations, setData: setConversations, loading: convsLoading, refresh } = useConversations({ search, archived: showArchived });
  const { data: messages, setData: setMessages, loading: msgsLoading } = useMessages(selectedConvId);
  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [autoTransLang, setAutoTransLang] = useState<string | null>(() => localStorage.getItem("msg_auto_trans_lang"));
  useEffect(() => {
    if (autoTransLang) localStorage.setItem("msg_auto_trans_lang", autoTransLang);
    else localStorage.removeItem("msg_auto_trans_lang");
  }, [autoTransLang]);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // userId -> name
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalResults, setGlobalResults] = useState<any[]>([]);

  // Init socket
  useEffect(() => { getSocket(); }, []);
  useConversationRoom(selectedConvId);

  // Mark as read on selection
  useEffect(() => {
    if (!selectedConvId) return;
    apiFetch(`/api/conversations/${selectedConvId}/read`, { method: "PUT" }).catch(() => {});
    setConversations((cs) => cs.map((c) => c.id === selectedConvId ? { ...c, unreadCount: 0 } : c));
  }, [selectedConvId, setConversations]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime handlers
  useRealtime({
    "message:new": (m: Msg) => {
      if (m.conversationId === selectedConvId) {
        setMessages((arr) => arr.some((x) => x.id === m.id) ? arr : [...arr, m]);
        if (m.senderId !== meId) {
          apiFetch(`/api/conversations/${selectedConvId}/read`, { method: "PUT" }).catch(() => {});
        }
      }
      setConversations((cs) => cs.map((c) => c.id === m.conversationId ? {
        ...c,
        lastMessage: m.content || (m.kind === "voice" ? "🎙️ Vocal" : m.kind === "image" ? "📷 Photo" : m.kind === "location" ? "📍 Position" : "📎 Fichier"),
        lastMessageAt: m.createdAt,
        unreadCount: m.conversationId === selectedConvId || m.senderId === meId ? c.unreadCount : (c.unreadCount || 0) + 1,
      } : c));
    },
    "message:updated": (m: Msg) => {
      if (m.conversationId === selectedConvId) {
        setMessages((arr) => arr.map((x) => x.id === m.id ? { ...x, ...m } : x));
      }
    },
    "message:deleted": (p: { id: string; conversationId: string }) => {
      if (p.conversationId === selectedConvId) {
        setMessages((arr) => arr.map((x) => x.id === p.id ? { ...x, deletedAt: new Date().toISOString(), content: "" } : x));
      }
    },
    "reaction:added": (p: { messageId: string; userId: string; emoji: string }) => {
      setMessages((arr) => arr.map((m) => {
        if (m.id !== p.messageId) return m;
        const exists = (m.reactions || []).some((r) => r.userId === p.userId && r.emoji === p.emoji);
        if (exists) return m;
        return { ...m, reactions: [...(m.reactions || []), { userId: p.userId, emoji: p.emoji }] };
      }));
    },
    "reaction:removed": (p: { messageId: string; userId: string; emoji: string }) => {
      setMessages((arr) => arr.map((m) => m.id === p.messageId ? {
        ...m, reactions: (m.reactions || []).filter((r) => !(r.userId === p.userId && r.emoji === p.emoji)),
      } : m));
    },
    "typing:update": (p: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (p.conversationId !== selectedConvId || p.userId === meId) return;
      setTypingUsers((m) => {
        const n = new Map(m);
        if (p.isTyping) n.set(p.userId, p.userName);
        else n.delete(p.userId);
        return n;
      });
    },
    "presence:update": (p: { userId: string; status: string; lastSeenAt: string }) => {
      setConversations((cs) => cs.map((c) => ({
        ...c,
        participants: c.participants.map((part) => part.userId === p.userId ? {
          ...part, presenceStatus: p.status as any, lastSeenAt: p.lastSeenAt,
        } : part),
      })));
    },
    "conversation:bump": () => refresh(),
    "conversation:read": (p: { conversationId: string; userId: string }) => {
      if (p.conversationId !== selectedConvId) return;
      setMessages((arr) => arr.map((m) => ({
        ...m, readBy: m.readBy?.includes(p.userId) ? m.readBy : [...(m.readBy || []), p.userId],
      })));
    },
  }, [selectedConvId, meId]);

  // Typing emit
  function onDraftChange(v: string) {
    setDraft(v);
    if (!selectedConvId) return;
    emitTyping(selectedConvId, true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      if (selectedConvId) emitTyping(selectedConvId, false);
    }, 2500);
  }

  // Send message
  async function send() {
    if (!selectedConvId) return;
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    setSending(true);
    try {
      if (editing) {
        const updated = await apiFetch<Msg>(`/api/messages/${editing.id}`, {
          method: "PATCH", body: { content: text } as any,
        });
        setMessages((arr) => arr.map((m) => m.id === updated.id ? { ...m, ...updated } : m));
        setEditing(null);
      } else {
        let attachments: Attachment[] = [];
        if (pendingFiles.length > 0) {
          attachments = await Promise.all(pendingFiles.map(async (f) => {
            const up = await uploadFile(f);
            return {
              url: (up as any).url, mime: f.type, sizeBytes: f.size,
              kind: attachmentKind(f.type), filename: f.name,
            };
          }));
        }
        const isImage = attachments.length === 1 && attachments[0].mime.startsWith("image/");
        await apiFetch(`/api/conversations/${selectedConvId}/messages`, {
          method: "POST",
          body: {
            content: text,
            kind: isImage ? "image" : "text",
            attachments,
            replyToMessageId: replyTo?.id || null,
          } as any,
        });
      }
      setDraft(""); setPendingFiles([]); setReplyTo(null);
      if (selectedConvId) emitTyping(selectedConvId, false);
    } catch (e: any) {
      alert(e?.message || "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  }

  // Voice recording
  async function toggleRecord() {
    if (!selectedConvId) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recordChunksRef.current = [];
      recordStartRef.current = Date.now();
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        const duration = (Date.now() - recordStartRef.current) / 1000;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        try {
          const up = await uploadFile(file) as any;
          const created = await apiFetch<{ id: string }>(`/api/conversations/${selectedConvId}/messages`, {
            method: "POST",
            body: {
              content: "", kind: "voice", attachmentUrl: up.url,
              attachments: [{ url: up.url, mime: "audio/webm", kind: "voice", durationSeconds: duration, filename: file.name, sizeBytes: file.size }],
              metadata: { durationSeconds: duration },
            } as any,
          });
          // Auto-transcription en tâche de fond — la transcription apparaîtra
          // sous le lecteur audio dès qu'elle est prête (via socket.io).
          if (created?.id) {
            apiFetch(`/api/messages/${created.id}/transcribe`, { method: "POST" })
              .catch(() => { /* silencieux : l'utilisateur peut relancer manuellement */ });
          }
        } catch (e: any) {
          alert(e?.message || "Erreur upload audio");
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      alert("Microphone non accessible");
    }
  }

  // Share location
  async function shareLocation() {
    if (!selectedConvId) return;
    if (!navigator.geolocation) { alert("Géolocalisation non disponible"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await apiFetch(`/api/conversations/${selectedConvId}/messages`, {
          method: "POST",
          body: {
            content: "", kind: "location",
            metadata: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, label: "Ma position" },
          } as any,
        });
      } catch (e: any) { alert(e?.message || "Erreur"); }
    }, () => alert("Permission refusée"));
  }

  async function reactToMessage(msgId: string, emoji: string) {
    const m = messages.find((x) => x.id === msgId);
    const mine = m?.reactions?.find((r) => r.userId === meId && r.emoji === emoji);
    if (mine) {
      await apiFetch(`/api/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/messages/${msgId}/reactions`, { method: "POST", body: { emoji } as any });
    }
  }

  async function deleteMessage(id: string) {
    if (!confirm("Supprimer ce message ?")) return;
    await apiFetch(`/api/messages/${id}`, { method: "DELETE" });
  }

  // Auto-traduction : dès qu'une langue cible est choisie, traduire en lot tous
  // les messages texte qui ne possèdent pas encore cette traduction.
  useEffect(() => {
    if (!autoTransLang || !messages.length) return;
    const todo = messages.filter(m =>
      m.content && m.kind !== "location" && !m.deletedAt && !(m.translations || {})[autoTransLang!]
    );
    if (!todo.length) return;
    let cancelled = false;
    (async () => {
      for (const m of todo) {
        if (cancelled) return;
        try {
          const r = await apiFetch<{ targetLang: string; text: string }>(`/api/messages/${m.id}/translate`, {
            method: "POST", body: { targetLang: autoTransLang } as any,
          });
          if (cancelled) return;
          setMessages(arr => arr.map(x => x.id === m.id
            ? { ...x, translations: { ...(x.translations || {}), [r.targetLang]: r.text } }
            : x));
        } catch { /* on continue avec les suivants */ }
      }
    })();
    return () => { cancelled = true; };
  }, [autoTransLang, messages, setMessages]);

  async function translateMessage(id: string, lang: string) {
    try {
      const r = await apiFetch<{ targetLang: string; text: string }>(`/api/messages/${id}/translate`, {
        method: "POST", body: { targetLang: lang } as any,
      });
      setMessages((arr) => arr.map((m) => m.id === id ? {
        ...m, translations: { ...(m.translations || {}), [r.targetLang]: r.text },
      } : m));
    } catch (e: any) {
      alert(e?.body?.detail || e?.body?.error || "Traduction indisponible");
    }
  }

  async function transcribeMessage(id: string) {
    try {
      const r = await apiFetch<{ transcript: string }>(`/api/messages/${id}/transcribe`, { method: "POST" });
      setMessages((arr) => arr.map((m) => m.id === id ? {
        ...m, metadata: { ...(m.metadata || {}), transcript: r.transcript },
      } : m));
    } catch (e: any) {
      alert(e?.body?.detail || e?.body?.error || "Transcription indisponible");
    }
  }

  async function toggleArchive(c: Conv) {
    await apiFetch(`/api/conversations/${c.id}`, { method: "PATCH", body: { archived: !c.archived } as any });
    refresh();
  }
  async function toggleMute(c: Conv) {
    await apiFetch(`/api/conversations/${c.id}`, { method: "PATCH", body: { muted: !c.muted } as any });
    refresh();
  }
  async function togglePin(c: Conv) {
    await apiFetch(`/api/conversations/${c.id}`, { method: "PATCH", body: { pinned: !c.pinned } as any });
    refresh();
  }

  async function startCall(type: "audio" | "video") {
    if (!selectedConvId || !selectedConv) return;
    const other = selectedConv.type === "direct" ? getOther(selectedConv, meId) : null;
    const peerName = other?.name || selectedConv.title || "Conversation";
    const peerAvatarUrl = other?.avatarUrl || null;
    await callCenter.startCall({ conversationId: selectedConvId, type, peerName, peerAvatarUrl });
  }

  async function runGlobalSearch(q: string) {
    if (!q.trim()) { setGlobalResults([]); return; }
    const r = await apiFetch<{ data: any[] }>(`/api/messages/search?q=${encodeURIComponent(q)}`);
    setGlobalResults(r.data || []);
  }

  const otherInDirect = selectedConv && selectedConv.type === "direct" ? getOther(selectedConv, meId) : null;
  const repliedMap = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-300">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Messagerie</h1>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Search className="w-4 h-4" /> Recherche globale</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Recherche dans tous les messages</DialogTitle></DialogHeader>
              <Input
                placeholder="Tapez votre recherche…" autoFocus
                onChange={(e) => runGlobalSearch(e.target.value)}
              />
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {globalResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedConvId(r.conversationId); setGlobalSearchOpen(false); }}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 border border-slate-100"
                  >
                    <div className="text-xs text-slate-500 font-semibold">{r.conversationTitle || "Discussion"} · {r.senderName}</div>
                    <div className="text-sm text-slate-800 line-clamp-2">{r.content}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{formatDate(r.createdAt)}</div>
                  </button>
                ))}
                {globalResults.length === 0 && <div className="text-center text-sm text-slate-400 py-8">Aucun résultat</div>}
              </div>
            </DialogContent>
          </Dialog>
          <NewConversationDialog onCreated={(c) => { setSelectedConvId(c.id); refresh(); }} />
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Conversations list */}
        <Card className="w-[340px] flex flex-col h-full border-border shadow-sm shrink-0">
          <div className="p-3 border-b border-border/50 shrink-0 bg-slate-50/50 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une discussion…"
                className="pl-9 bg-white h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button
                size="sm" variant={!showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(false)}
                className={cn("h-7 text-xs", !showArchived && "bg-primary text-white")}
              >Actives</Button>
              <Button
                size="sm" variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(true)}
                className={cn("h-7 text-xs", showArchived && "bg-primary text-white")}
              >Archivées</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {convsLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-12 px-4">
                Aucune conversation. Créez-en une avec « Nouveau Message ».
              </div>
            ) : conversations.map((c) => {
              const other = c.type === "direct" ? getOther(c, meId) : null;
              const name = convDisplayName(c, meId);
              const isSel = selectedConvId === c.id;
              return (
                <div key={c.id} className="group">
                  <div
                    onClick={() => setSelectedConvId(c.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                      isSel ? "bg-primary/5 border-primary/30" : "border-transparent hover:bg-slate-50",
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-11 h-11">
                        {other?.avatarUrl ? <AvatarImage src={other.avatarUrl} /> : null}
                        <AvatarFallback className={cn(
                          "font-bold",
                          isSel ? "bg-primary text-white" : "bg-slate-100 text-slate-600",
                        )}>{initials(name)}</AvatarFallback>
                      </Avatar>
                      {other && <PresenceDot status={other.presenceStatus} />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={cn(
                          "font-semibold text-sm truncate flex items-center gap-1",
                          isSel ? "text-primary" : "text-slate-800",
                        )}>
                          {c.pinned && <Pin className="w-3 h-3 text-primary" />}
                          {c.muted && <BellOff className="w-3 h-3 text-slate-400" />}
                          {name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(c.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-500 truncate">{c.lastMessage || "Aucun message"}</div>
                        {c.unreadCount > 0 && (
                          <Badge className="h-5 min-w-5 px-1.5 text-[10px] rounded-full bg-primary text-white border-none">
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-1">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => togglePin(c)}>
                          <Pin className="w-4 h-4 mr-2" /> {c.pinned ? "Désépingler" : "Épingler"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleMute(c)}>
                          {c.muted ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                          {c.muted ? "Réactiver" : "Mettre en sourdine"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleArchive(c)}>
                          <Archive className="w-4 h-4 mr-2" /> {c.archived ? "Désarchiver" : "Archiver"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Messages panel */}
        <Card className="flex-1 flex flex-col h-full border-border shadow-sm">
          {selectedConv ? (
            <>
              <div className="p-3 border-b border-border/50 shrink-0 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      {otherInDirect?.avatarUrl ? <AvatarImage src={otherInDirect.avatarUrl} /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {initials(convDisplayName(selectedConv, meId))}
                      </AvatarFallback>
                    </Avatar>
                    {otherInDirect && <PresenceDot status={otherInDirect.presenceStatus} />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">{convDisplayName(selectedConv, meId)}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedConv.type === "direct" && otherInDirect
                        ? (otherInDirect.presenceStatus === "online"
                          ? "En ligne"
                          : otherInDirect.lastSeenAt ? `Vu ${formatDate(otherInDirect.lastSeenAt)}` : "Hors ligne")
                        : `${selectedConv.participants.length} participants`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Sélecteur de traduction automatique */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={autoTransLang ? "default" : "ghost"} size="sm"
                        className={cn("h-8 gap-1.5", autoTransLang ? "" : "text-slate-600 hover:text-primary")}
                        title="Traduire automatiquement tous les messages"
                      >
                        <Languages className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase">
                          {autoTransLang || "Auto"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                        Traduire automatiquement
                      </div>
                      <DropdownMenuItem onClick={() => setAutoTransLang(null)}>
                        <X className="w-4 h-4 mr-2" /> Désactiver
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {TARGET_LANGS.map(l => (
                        <DropdownMenuItem
                          key={l.code}
                          onClick={() => setAutoTransLang(l.code)}
                          className={autoTransLang === l.code ? "bg-primary/10 text-primary font-semibold" : ""}
                        >
                          <Languages className="w-4 h-4 mr-2" /> {l.label}
                          {autoTransLang === l.code && <Check className="w-3 h-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Bouton WhatsApp si numéro disponible */}
                  {(() => {
                    const wa = whatsappUrl(otherInDirect?.phone);
                    if (!wa) return null;
                    return (
                      <a
                        href={wa} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1DA851] transition-colors"
                        title={`Ouvrir WhatsApp avec ${otherInDirect?.name}`}
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                    );
                  })()}

                  <Button variant="ghost" size="sm" onClick={() => startCall("audio")} className="text-slate-600 hover:text-primary">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => startCall("video")} className="text-slate-600 hover:text-primary">
                    <Video className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#f8fafc]">
                {msgsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <MessageSquare className="w-12 h-12 mb-2" />
                    <p className="text-sm">Aucun message. Soyez le premier à écrire !</p>
                  </div>
                ) : messages.map((m) => (
                  <MessageBubble
                    key={m.id} msg={m} isMe={m.senderId === meId}
                    otherPresent={selectedConv.participants.length - 1}
                    onReact={(e) => reactToMessage(m.id, e)}
                    onReply={() => setReplyTo(m)}
                    onEdit={() => { setEditing(m); setDraft(m.content); }}
                    onDelete={() => deleteMessage(m.id)}
                    onTranslate={(lang) => translateMessage(m.id, lang)}
                    onTranscribe={() => transcribeMessage(m.id)}
                    repliedMsg={m.replyToMessageId ? repliedMap.get(m.replyToMessageId) : null}
                    autoTransLang={autoTransLang}
                  />
                ))}
                {typingUsers.size > 0 && (
                  <div className="text-xs text-slate-500 italic ml-2">
                    {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "écrit" : "écrivent"}…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-border/50 shrink-0 bg-white space-y-2">
                {replyTo && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border-l-2 border-primary">
                    <Reply className="w-4 h-4 text-primary" />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-primary">{replyTo.senderName}</div>
                      <div className="text-slate-600 truncate">{replyTo.content || "(pièce jointe)"}</div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                )}
                {editing && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border-l-2 border-amber-500">
                    <Pencil className="w-4 h-4 text-amber-600" />
                    <div className="flex-1 text-xs text-amber-800">Modification du message…</div>
                    <button onClick={() => { setEditing(null); setDraft(""); }} className="text-amber-600 hover:text-amber-800"><X className="w-4 h-4" /></button>
                  </div>
                )}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded text-xs">
                        {f.type.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        <span className="truncate max-w-[140px]">{f.name}</span>
                        <button onClick={() => setPendingFiles((arr) => arr.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    type="file" multiple ref={fileInputRef} className="hidden"
                    accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setPendingFiles((arr) => [...arr, ...files]);
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 p-0 text-slate-500" title="Pièce jointe">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={shareLocation} className="h-10 w-10 p-0 text-slate-500" title="Partager position">
                    <MapPin className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" onClick={toggleRecord}
                    className={cn("h-10 w-10 p-0", recording ? "text-red-500 animate-pulse" : "text-slate-500")}
                    title={recording ? "Arrêter" : "Message vocal"}
                  >
                    {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    placeholder={editing ? "Modifier…" : "Écrivez votre message… (@mention, Entrée pour envoyer)"}
                    className="flex-1 bg-slate-50 min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={send} disabled={sending || (!draft.trim() && pendingFiles.length === 0)}
                    className="bg-primary hover:bg-primary/90 h-11 w-11 px-0 shrink-0 rounded-full"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-lg font-medium text-slate-600">Sélectionnez une conversation</p>
              <p className="text-sm">ou démarrez une nouvelle discussion.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
