"use client";

import type { ChatSession } from "@/lib/types";

type Props = {
  chats: ChatSession[];
  activeChatId: string | null;
  isCreating: boolean;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
};

export function Sidebar({
  chats,
  activeChatId,
  isCreating,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: Props) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/10 bg-[#171717]">
      <div className="p-3">
        <div className="mb-4 flex items-center gap-2 px-2 py-1">
          <span className="text-lg">📄</span>
          <span className="font-semibold tracking-tight">PagePal</span>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm transition hover:bg-white/10 disabled:opacity-50"
        >
          <span className="text-base leading-none">+</span>
          {isCreating ? "Creating..." : "New chat"}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {chats.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-500">No chats yet</p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <li key={chat.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full rounded-lg px-3 py-2.5 pr-9 text-left text-sm transition ${
                    activeChatId === chat.id
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <span className="block truncate">{chat.title}</span>
                  {chat.pdfName && (
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {chat.pdfName}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteChat(chat.id)}
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 group-hover:block"
                  aria-label="Delete chat"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
