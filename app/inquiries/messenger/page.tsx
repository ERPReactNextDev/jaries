"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  limit,
  doc,
  deleteDoc,
  updateDoc,
} from "@/lib/firestore/client";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  MoreVertical,
  Search,
  Send,
  Circle,
  MessageSquare,
  Trash2,
  ImageIcon,
  Loader2,
  ChevronLeft,
  Edit2,
  Check,
  X as XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";

// ── CONSTANTS ────────────────────────────────────────────────────────────────

// The query wrapper in lib/firestore/client.ts defaults to 50 docs.
// Pass an explicit limit so ALL sender names / conversations show up.
const CHAT_QUERY_LIMIT = 1000;
const DEFAULT_GUEST_NAME = "Guest Client";

// ── TYPES ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  sender: "user" | "contact";
  author: string;
  text?: string;
  imageUrl?: string;
  timestamp: string;
  isAdmin: boolean;
  seenBy?: string[];
  reactions?: Record<string, string[]>;
  replyTo?: {
    text: string;
    senderName: string;
    originalMsgId?: string;
  } | null;
  edited?: boolean;
  editedAt?: any;
};

type Conversation = {
  /** Unique key: `${email}::${guestName}` — one conversation per sender name */
  id: string;
  name: string; // always the GUEST's senderName, never the admin's
  email: string;
  initials: string;
  messages: Message[];
  hasUnread: boolean;
  lastMs: number;
};

const makeConvId = (email: string, name: string) => `${email}::${name}`;

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function Messenger() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [adminSession, setAdminSession] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingConvName, setEditingConvName] = useState<string | null>(null);
  const [tempConvName, setTempConvName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  useEffect(() => {
    const session = localStorage.getItem("disruptive_admin_user");
    if (session) {
      const userData = JSON.parse(session);
      setAdminSession(userData);
      setCurrentUserId(userData.uid || userData.email || "admin");
    }
  }, []);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      where("website", "==", "disruptivesolutionsinc"),
      orderBy("timestamp", "desc"),
      limit(CHAT_QUERY_LIMIT),
    );

    const unsub = onSnapshot(
      q,
      (snapshot: any) => {
        // 1) Normalize + sort oldest -> newest.
        //    Pending serverTimestamp() writes have a null timestamp, so use "now".
        const rows = snapshot.docs
          .map((d: any) => {
            const data = d.data();
            const ms: number = data.timestamp?.toMillis?.() ?? Date.now();
            return { id: d.id as string, data, ms };
          })
          .sort((a: any, b: any) => a.ms - b.ms);

        const grouped: Record<string, Conversation> = {};
        // Latest guest name per email (used for legacy admin messages that
        // don't have `conversationName` yet).
        const lastGuestNameByEmail: Record<string, string> = {};

        rows.forEach(({ id, data, ms }: any) => {
          const email: string = data.senderEmail || "unknown";
          const isAdmin = data.isAdmin === true;

          // 2) Decide which conversation this message belongs to.
          //    - Guest message  -> its own senderName
          //    - Admin message  -> conversationName (set when replying),
          //                        falling back to last guest name of that email
          let convName: string;
          if (isAdmin) {
            convName =
              (data.conversationName || "").trim() ||
              lastGuestNameByEmail[email] ||
              DEFAULT_GUEST_NAME;
          } else {
            convName = (data.senderName || "").trim() || DEFAULT_GUEST_NAME;
            lastGuestNameByEmail[email] = convName;
          }

          const key = makeConvId(email, convName);

          if (!grouped[key]) {
            grouped[key] = {
              id: key,
              email,
              name: convName, // persistent — never overwritten by admin name
              initials: convName.substring(0, 2).toUpperCase(),
              messages: [],
              hasUnread: false,
              lastMs: 0,
            };
          }

          const message: Message = {
            id,
            sender: isAdmin ? "user" : "contact",
            author: data.senderName || (isAdmin ? "Admin" : convName),
            text: data.message,
            imageUrl: data.imageUrl,
            timestamp: new Date(ms).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isAdmin,
            seenBy: data.seenBy || [],
            reactions: data.reactions || {},
            replyTo: data.replyTo || null,
            edited: data.edited || false,
            editedAt: data.editedAt,
          };

          grouped[key].messages.push(message);
          grouped[key].lastMs = ms;
        });

        // 3) Unread flag + sort conversations (most recent first)
        const list = Object.values(grouped)
          .map((conv) => {
            const last = conv.messages[conv.messages.length - 1];
            return { ...conv, hasUnread: !!last && !last.isAdmin };
          })
          .sort((a, b) => b.lastMs - a.lastMs);

        setConversations(list);

        // Keep current selection if it still exists, else pick the first one
        setSelectedId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? "",
        );
      },
      (error: any) => {
        console.error("Error in real-time listener:", error);
      },
    );

    return () => unsub();
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId],
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // ── Mark messages as read ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !activeConversation || activeConversation.messages.length === 0) {
      return;
    }

    const unreadMsgs = activeConversation.messages.filter(
      (msg) => !msg.isAdmin && !msg.seenBy?.includes(currentUserId),
    );

    if (unreadMsgs.length > 0) {
      unreadMsgs.forEach(async (msg) => {
        const seenByUsers = [...(msg.seenBy || []), currentUserId];
        await updateDoc(doc(db, "chats", msg.id), {
          seenBy: seenByUsers,
        });
      });
    }
  }, [selectedId, activeConversation?.messages, currentUserId]);

  // ── Typing indicator timeout ────────────────────────────────────────────
  useEffect(() => {
    if (draft.length > 0) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers([]);
      }, 3000);
    }
  }, [draft]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    try {
      const msg = activeConversation?.messages.find((m) => m.id === msgId);
      if (!msg) return;

      const reactions = { ...(msg.reactions || {}) };
      const users = reactions[emoji] || [];

      reactions[emoji] = users.includes(currentUserId)
        ? users.filter((id) => id !== currentUserId)
        : [...users, currentUserId];

      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }

      await updateDoc(doc(db, "chats", msgId), {
        reactions,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateConversationName = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !activeConversation) return;

    try {
      const conversation = activeConversation;

      // Guest messages: update senderName + conversationName
      // Admin messages: keep admin's senderName, only update conversationName
      const updates = conversation.messages.map((msg) =>
        updateDoc(
          doc(db, "chats", msg.id),
          msg.isAdmin
            ? { conversationName: trimmed }
            : { senderName: trimmed, conversationName: trimmed },
        ),
      );

      // Follow the conversation to its new key
      setSelectedId(makeConvId(conversation.email, trimmed));
      await Promise.all(updates);
      setEditingConvName(null);
      setTempConvName("");
    } catch (err) {
      console.error("Error updating conversation name:", err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeConversation || !adminSession) return;
    const messageText = draft.trim();
    const target = activeConversation;
    setDraft("");
    setReplyingTo(null);

    try {
      await addDoc(collection(db, "chats"), {
        senderEmail: target.email,
        // Admin's own name (who replied)
        senderName: adminSession.displayName || "Admin",
        // Guest's name -> keeps the message inside the right conversation
        conversationName: target.name,
        message: messageText,
        isAdmin: true,
        timestamp: serverTimestamp(),
        website: "disruptivesolutionsinc",
        seenBy: [currentUserId],
        reactions: {},
        replyTo: replyingTo
          ? {
              text: replyingTo.text || "",
              senderName: replyingTo.author,
              originalMsgId: replyingTo.id,
            }
          : null,
      });
    } catch (err) {
      console.error(err);
      setDraft(messageText);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !adminSession) return;
    try {
      setIsUploading(true);
      const url = await uploadToCloudinary(file);
      await addDoc(collection(db, "chats"), {
        senderEmail: activeConversation.email,
        senderName: adminSession.displayName || "Admin",
        conversationName: activeConversation.name,
        imageUrl: url,
        isAdmin: true,
        timestamp: serverTimestamp(),
        website: "disruptivesolutionsinc",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, "chats", msgId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditMessage = async (msgId: string) => {
    if (!editingText.trim()) return;
    try {
      await updateDoc(doc(db, "chats", msgId), {
        message: editingText.trim(),
        edited: true,
        editedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setShowChat(true);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* ── HEADER ── */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Messenger</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* ── PAGE CONTENT WRAPPER ── */}
          <div className="flex flex-1 overflow-hidden p-4 lg:p-6 bg-muted/30">
            {/* ── MESSENGER CONTAINER ── */}
            <div className="flex flex-1 overflow-hidden border rounded-none shadow-sm bg-background max-h-[calc(100vh-8rem)]">
              {/* ── CONVERSATION SIDEBAR ── */}
              <div
                className={cn(
                  "w-full lg:w-72 border-r flex flex-col shrink-0",
                  "lg:flex",
                  showChat ? "hidden" : "flex",
                )}
              >
                {/* Sidebar header */}
                <div className="p-4 border-b space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-base tracking-tight">
                      Messages
                    </h2>
                    <Badge
                      variant="secondary"
                      className="rounded-none text-[10px] gap-1"
                    >
                      <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
                      Live
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
                      className="pl-8 rounded-none h-9 text-xs"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Conversation list — scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        No conversations yet.
                      </p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isActive = selectedId === conv.id;
                      const lastMsg = conv.messages[conv.messages.length - 1];
                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b transition-colors",
                            isActive ? "bg-accent" : "hover:bg-muted/50",
                          )}
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="rounded-none text-xs font-bold bg-primary/10 text-primary">
                              {conv.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {conv.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {lastMsg?.isAdmin ? "You: " : ""}
                              {lastMsg?.imageUrl
                                ? "📷 Sent an image"
                                : lastMsg?.text}
                            </p>
                          </div>
                          {conv.hasUnread && !isActive && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── CHAT WINDOW ── */}
              <div
                className={cn(
                  "flex-1 flex-col overflow-hidden",
                  "lg:flex",
                  showChat ? "flex" : "hidden lg:flex",
                )}
              >
                <AnimatePresence mode="wait">
                  {activeConversation ? (
                    <motion.div
                      key={activeConversation.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col h-full overflow-hidden"
                    >
                      {/* Chat header — fixed, does not scroll */}
                      <div className="h-16 px-4 border-b flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 flex-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden rounded-none h-8 w-8"
                            onClick={() => setShowChat(false)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="rounded-none text-xs font-bold bg-primary/10 text-primary">
                              {activeConversation.initials}
                            </AvatarFallback>
                          </Avatar>
                          {editingConvName === activeConversation.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={tempConvName}
                                onChange={(e) => setTempConvName(e.target.value)}
                                className="rounded-none h-8 text-sm flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleUpdateConversationName(tempConvName);
                                  if (e.key === "Escape") {
                                    setEditingConvName(null);
                                    setTempConvName("");
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                className="h-7 w-7 rounded-none"
                                onClick={() => handleUpdateConversationName(tempConvName)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <p
                                className="text-sm font-semibold leading-tight cursor-pointer hover:text-primary transition-colors"
                                onClick={() => {
                                  setEditingConvName(activeConversation.id);
                                  setTempConvName(activeConversation.name);
                                }}
                              >
                                {activeConversation.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {activeConversation.email}
                              </p>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-none h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="rounded-none"
                          >
                            <DropdownMenuItem
                              className="text-xs"
                              onClick={() => {
                                setEditingConvName(activeConversation.id);
                                setTempConvName(activeConversation.name);
                              }}
                            >
                              <Edit2 className="h-3 w-3 mr-2" />
                              Edit Name
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Messages — scrollable area only */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                        {activeConversation.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.sender === "user"
                                ? "justify-end"
                                : "justify-start",
                            )}
                            onMouseEnter={() =>
                              msg.isAdmin && setHoveredMsgId(msg.id)
                            }
                            onMouseLeave={() => setHoveredMsgId(null)}
                          >
                            <div
                              className={cn(
                                "flex flex-col max-w-[70%] group relative",
                                msg.sender === "user"
                                  ? "items-end"
                                  : "items-start",
                              )}
                              onMouseEnter={() => setActiveReactionMsgId(msg.id)}
                              onMouseLeave={() => setActiveReactionMsgId(null)}
                            >
                              {editingId === msg.id ? (
                                /* Edit mode */
                                <div className="flex items-center gap-2 w-full">
                                  <Input
                                    value={editingText}
                                    onChange={(e) =>
                                      setEditingText(e.target.value)
                                    }
                                    className="rounded-none h-8 text-sm flex-1"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        handleEditMessage(msg.id);
                                      if (e.key === "Escape") {
                                        setEditingId(null);
                                        setEditingText("");
                                      }
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    className="h-8 w-8 rounded-none"
                                    onClick={() => handleEditMessage(msg.id)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 rounded-none"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingText("");
                                    }}
                                  >
                                    <XIcon className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="relative">
                                    <div
                                      className={cn(
                                        "px-3 py-2.5 text-sm shadow-sm",
                                        msg.sender === "user"
                                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
                                          : "bg-background border rounded-2xl rounded-tl-none",
                                      )}
                                    >
                                      {msg.imageUrl && (
                                        <img
                                          src={msg.imageUrl}
                                          alt="Chat image"
                                          className="rounded mb-1.5 max-w-full cursor-zoom-in"
                                          onClick={() =>
                                            window.open(msg.imageUrl, "_blank")
                                          }
                                        />
                                      )}
                                      {msg.text && (
                                        <p className="leading-relaxed whitespace-pre-wrap">
                                          {msg.text}
                                        </p>
                                      )}
                                    </div>

                                    {/* Reactions */}
                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                                          <button
                                            key={emoji}
                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                            className={cn(
                                              "flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                                              users.includes(currentUserId)
                                                ? "bg-primary/20 border border-primary"
                                                : "bg-muted border border-muted-foreground/20 hover:bg-muted/80",
                                            )}
                                            title={users.join(", ")}
                                          >
                                            <span>{emoji}</span>
                                            <span className="text-[10px]">{users.length}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}

                                    {/* Reaction add button */}
                                    {activeReactionMsgId === msg.id && (
                                      <div className="flex gap-1 mt-2">
                                        {EMOJI_REACTIONS.map((emoji) => (
                                          <button
                                            key={emoji}
                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                            className="text-lg hover:scale-125 transition-transform"
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    )}

                                    {/* Edited badge */}
                                    {msg.edited && (
                                      <div className="text-[9px] text-muted-foreground italic mt-1">
                                        (edited)
                                      </div>
                                    )}

                                    {/* Read receipts */}
                                    {msg.seenBy && msg.seenBy.length > 0 && !msg.isAdmin && (
                                      <div className="text-[9px] text-muted-foreground mt-1">
                                        👁️ {msg.seenBy.length}
                                      </div>
                                    )}

                                    {/* Admin message actions */}
                                    {msg.isAdmin && (
                                      <div
                                        className={cn(
                                          "absolute -top-3 -left-16 flex gap-0.5 bg-background border rounded-none shadow-sm transition-opacity",
                                          hoveredMsgId === msg.id
                                            ? "opacity-100"
                                            : "opacity-0 group-hover:opacity-100",
                                        )}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-none"
                                          onClick={() => {
                                            setEditingId(msg.id);
                                            setEditingText(msg.text || "");
                                          }}
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>

                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 rounded-none text-muted-foreground hover:text-destructive"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="rounded-none">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle className="text-sm font-bold uppercase">
                                                Delete Message
                                              </AlertDialogTitle>
                                              <AlertDialogDescription className="text-xs">
                                                This message will be permanently
                                                deleted and cannot be recovered.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel className="rounded-none text-xs">
                                                Cancel
                                              </AlertDialogCancel>
                                              <AlertDialogAction
                                                className="rounded-none bg-destructive text-xs"
                                                onClick={() =>
                                                  handleDeleteMessage(msg.id)
                                                }
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground mt-1 uppercase font-medium tracking-tight">
                                    {msg.timestamp}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        {isUploading && (
                          <div className="flex justify-end">
                            <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sending image...
                            </span>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>

                      {/* Input area — fixed at bottom, does not scroll */}
                      <div className="p-4 border-t bg-background shrink-0">
                        {/* Reply context banner */}
                        {replyingTo && (
                          <div className="mb-3 p-2 bg-muted border-l-2 border-primary flex items-center justify-between rounded text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground font-semibold">
                                Replying to {replyingTo.author}
                              </p>
                              <p className="text-[11px] truncate text-foreground">
                                {replyingTo.text || "📷 Image"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-none h-6 w-6 ml-2"
                              onClick={() => setReplyingTo(null)}
                            >
                              <XIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* Typing indicator */}
                        {typingUsers.length > 0 && (
                          <div className="mb-2 text-[10px] text-muted-foreground italic">
                            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                          </div>
                        )}

                        <form onSubmit={handleSubmit}>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                          />
                          <div className="border rounded-none">
                            <Textarea
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder="Type a message..."
                              className="min-h-[72px] rounded-none border-0 border-b focus-visible:ring-0 resize-none text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSubmit(e as any);
                                }
                              }}
                            />
                            <div className="flex items-center justify-between px-3 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-none h-8 text-xs text-muted-foreground"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                              >
                                <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                                {isUploading ? "Uploading..." : "Image"}
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                className="rounded-none h-8 text-xs"
                                disabled={!draft.trim() || isUploading}
                              >
                                <Send className="h-3.5 w-3.5 mr-1.5" />
                                Reply
                              </Button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 flex flex-col items-center justify-center text-center p-8"
                    >
                      <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Select a client to view their conversation.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}