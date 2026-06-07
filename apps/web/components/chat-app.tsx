"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createChat, streamAnswer, uploadPdf } from "@/lib/api";
import type { ChatSession, Message } from "@/lib/types";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { PdfUploadZone } from "./pdf-upload-zone";
import { Sidebar } from "./sidebar";

const STORAGE_KEY = "pagepal-chats";

function loadChats(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveChats(chats: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function newMessageId() {
  return crypto.randomUUID();
}

export function ChatApp() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadChats();
    setChats(stored);
    if (stored.length > 0) {
      setActiveChatId(stored[0].id);
    }
  }, []);

  const persist = useCallback((next: ChatSession[]) => {
    setChats(next);
    saveChats(next);
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const updateChat = useCallback(
    (chatId: string, updater: (chat: ChatSession) => ChatSession) => {
      setChats((prev) => {
        const next = prev.map((c) => (c.id === chatId ? updater(c) : c));
        saveChats(next);
        return next;
      });
    },
    [],
  );

  const handleNewChat = async () => {
    setError(null);
    setIsCreating(true);
    try {
      const chat = await createChat(
        `Chat ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      );
      const next = [chat, ...chats];
      persist(next);
      setActiveChatId(chat.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create chat");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!activeChat) return;
    setError(null);
    setIsUploading(true);
    try {
      await uploadPdf(activeChat.id, file);
      updateChat(activeChat.id, (c) => ({
        ...c,
        pdfUploaded: true,
        pdfName: file.name,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = (question: string) => {
    if (!activeChat || !activeChat.pdfUploaded || isStreaming) return;

    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = {
      id: newMessageId(),
      role: "user",
      content: question,
    };
    const assistantId = newMessageId();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    updateChat(activeChat.id, (c) => ({
      ...c,
      messages: [...c.messages, userMsg, assistantMsg],
    }));

    setIsStreaming(true);

    streamAnswer(
      activeChat.id,
      question,
      {
        onToken: (token) => {
          updateChat(activeChat.id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m,
            ),
          }));
        },
        onDone: (sources, cached) => {
          updateChat(activeChat.id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, sources, cached }
                : m,
            ),
          }));
          setIsStreaming(false);
        },
        onError: (err) => {
          updateChat(activeChat.id, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      "Something went wrong while generating the answer.",
                    isStreaming: false,
                  }
                : m,
            ),
          }));
          setError(err.message);
          setIsStreaming(false);
        },
      },
      controller.signal,
    );
  };

  const handleDeleteChat = (chatId: string) => {
    const next = chats.filter((c) => c.id !== chatId);
    persist(next);
    if (activeChatId === chatId) {
      setActiveChatId(next[0]?.id ?? null);
    }
  };

  return (
    <div className="flex h-dvh bg-[#212121] text-zinc-100">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isCreating={isCreating}
        onNewChat={handleNewChat}
        onSelectChat={setActiveChatId}
        onDeleteChat={handleDeleteChat}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {!activeChat ? (
          <EmptyState onNewChat={handleNewChat} isCreating={isCreating} />
        ) : (
          <>
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-3">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium">
                  {activeChat.title}
                </h1>
                {activeChat.pdfName && (
                  <p className="truncate text-xs text-zinc-500">
                    {activeChat.pdfName}
                  </p>
                )}
              </div>
              {activeChat.pdfUploaded && (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-400">
                  PDF ready
                </span>
              )}
            </header>

            {!activeChat.pdfUploaded ? (
              <PdfUploadZone
                onUpload={handleUpload}
                isUploading={isUploading}
              />
            ) : (
              <ChatMessages messages={activeChat.messages} />
            )}

            {error && (
              <div className="mx-auto w-full max-w-3xl px-4 pb-2">
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              </div>
            )}

            <ChatInput
              disabled={!activeChat.pdfUploaded || isStreaming}
              placeholder={
                activeChat.pdfUploaded
                  ? "Ask a question about your PDF..."
                  : "Upload a PDF to start chatting"
              }
              onSend={handleSend}
            />
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  onNewChat,
  isCreating,
}: {
  onNewChat: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
        📄
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to PagePal
        </h2>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Upload a PDF, ask questions, and get answers streamed from your
          document.
        </p>
      </div>
      <button
        type="button"
        onClick={onNewChat}
        disabled={isCreating}
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50"
      >
        {isCreating ? "Creating..." : "Start a new chat"}
      </button>
    </div>
  );
}
