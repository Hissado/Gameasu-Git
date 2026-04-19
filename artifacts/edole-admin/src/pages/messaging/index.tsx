import React, { useState } from "react";
import { useListConversations, useListMessages } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Messaging() {
  const { data: conversationsData, isLoading: isLoadingConversations } = useListConversations();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const { data: messagesData, isLoading: isLoadingMessages } = useListMessages(selectedConvId || "", {
    query: { enabled: !!selectedConvId }
  });

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messaging</h1>
          <p className="text-muted-foreground mt-1">Communicate with your team and clients</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Conversations List */}
        <Card className="w-1/3 flex flex-col h-full border-r border-border">
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="font-semibold">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : conversationsData?.data?.map((conv) => (
              <div 
                key={conv.id} 
                onClick={() => setSelectedConvId(conv.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedConvId === conv.id ? "bg-sidebar-accent/10" : "hover:bg-muted"}`}
              >
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {conv.title ? conv.title.substring(0, 2).toUpperCase() : "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm truncate">{conv.title || "Conversation"}</span>
                    {conv.unreadCount ? (
                      <Badge variant="default" className="w-5 h-5 flex items-center justify-center p-0 text-[10px] rounded-full">
                        {conv.unreadCount}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.content || "No messages yet"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Messages Panel */}
        <Card className="w-2/3 flex flex-col h-full">
          {selectedConvId ? (
            <>
              <div className="p-4 border-b border-border shrink-0 flex items-center justify-between">
                <h2 className="font-semibold">Thread</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                {isLoadingMessages ? (
                  <div className="text-center text-muted-foreground text-sm">Loading messages...</div>
                ) : messagesData?.data?.map((msg) => (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.senderName === "You" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                    <div className="text-xs text-muted-foreground mb-1 ml-1">{msg.senderName}</div>
                    <div className={`p-3 rounded-xl text-sm ${msg.senderName === "You" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
                      {msg.content}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 mx-1">
                      {new Date(msg.createdAt).toLocaleTimeString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <input type="text" placeholder="Type a message..." className="flex-1 bg-muted rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">Send</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to view messages
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
