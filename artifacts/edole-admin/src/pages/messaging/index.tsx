import React, { useState } from "react";
import { useListConversations, useListMessages } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Send, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Messaging() {
  const { data: conversationsData, isLoading: isLoadingConversations } = useListConversations();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const { data: messagesData, isLoading: isLoadingMessages } = useListMessages(selectedConvId || "", {
    query: { enabled: !!selectedConvId }
  });

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Messagerie</h1>
          <p className="text-sm text-muted-foreground mt-1">Communications internes et discussions projets</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <MessageSquare className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouveau Message
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Conversations List */}
        <Card className="w-1/3 flex flex-col h-full border-border shadow-sm">
          <div className="p-4 border-b border-border/50 shrink-0 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Rechercher une discussion..." className="pl-9 bg-white focus-visible:ring-primary h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {isLoadingConversations ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversationsData?.data?.map((conv) => (
              <div 
                key={conv.id} 
                onClick={() => setSelectedConvId(conv.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selectedConvId === conv.id ? "bg-primary/5 border border-primary/20" : "hover:bg-slate-50 border border-transparent"}`}
              >
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarFallback className={`${selectedConvId === conv.id ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600'} font-bold`}>
                    {conv.title ? conv.title.substring(0, 2).toUpperCase() : "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium text-sm truncate ${selectedConvId === conv.id ? 'text-primary font-bold' : 'text-slate-800'}`}>
                      {conv.title || "Discussion"}
                    </span>
                    {conv.unreadCount && conv.unreadCount > 0 ? (
                      <Badge className="w-5 h-5 flex items-center justify-center p-0 text-[10px] rounded-full bg-primary border-none text-white">
                        {conv.unreadCount}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.content || "Aucun message"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Messages Panel */}
        <Card className="w-2/3 flex flex-col h-full border-border shadow-sm">
          {selectedConvId ? (
            <>
              <div className="p-4 border-b border-border/50 shrink-0 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 border border-border">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {conversationsData?.data?.find(c => c.id === selectedConvId)?.title?.substring(0, 2).toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="font-bold text-slate-800">
                    {conversationsData?.data?.find(c => c.id === selectedConvId)?.title || "Discussion"}
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8fafc] custom-scrollbar">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="w-8 h-8 rounded-full animate-spin" />
                  </div>
                ) : messagesData?.data?.map((msg) => (
                  <div key={msg.id} className={`flex flex-col max-w-[75%] ${msg.senderName === "You" || msg.senderName === "Vous" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                    <div className="text-[11px] font-medium text-slate-400 mb-1 ml-1 uppercase tracking-wider">{msg.senderName}</div>
                    <div className={`p-3.5 text-sm shadow-sm ${msg.senderName === "You" || msg.senderName === "Vous" ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm"}`}>
                      {msg.content}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1 mx-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border/50 shrink-0 bg-white">
                <div className="flex gap-3">
                  <Input placeholder="Écrivez votre message..." className="flex-1 bg-slate-50 focus-visible:ring-primary h-12" />
                  <Button className="bg-primary hover:bg-primary/90 h-12 w-12 px-0 shrink-0 shadow-sm rounded-full">
                    <Send className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/30">
              <MessageSquare className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-lg font-medium text-slate-600">Aucune discussion sélectionnée</p>
              <p className="text-sm">Sélectionnez une conversation dans la liste pour commencer à discuter.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}