"use client";

import type { Message } from "@/lib/types";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-[#2f2f2f] px-4 py-3"
            : "w-full"
        }`}
      >
        {!isUser && (
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              P
            </span>
            PagePal
            {message.cached && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                cached
              </span>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-100">
          {message.content}
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-zinc-400 align-middle" />
          )}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <details className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
            <summary className="cursor-pointer select-none text-zinc-300">
              {message.sources.length} source
              {message.sources.length === 1 ? "" : "s"} from PDF
            </summary>
            <ul className="mt-2 space-y-2">
              {message.sources.slice(0, 3).map((source, i) => (
                <li
                  key={`${source.chunkIndex}-${i}`}
                  className="rounded border border-white/5 bg-black/20 p-2 leading-relaxed"
                >
                  <span className="text-zinc-500">
                    Chunk #{source.chunkIndex} · score{" "}
                    {source.distance.toFixed(3)}
                  </span>
                  <p className="mt-1 line-clamp-3 text-zinc-300">
                    {source.content}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
