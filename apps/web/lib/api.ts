import type { ChatSession, PdfDocument, Source, StreamEvent } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export async function createChat(title: string): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create chat");
  }

  const data = await res.json();
  return {
    id: data.id,
    title: data.title,
    pdfUploaded: false,
    messages: [],
    createdAt: Date.now(),
  };
}

export async function uploadPdf(
  chatId: string,
  file: File,
): Promise<PdfDocument> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/chat/${chatId}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to upload PDF");
  }

  return res.json();
}

export type StreamHandlers = {
  onToken: (token: string) => void;
  onDone: (sources: Source[], cached?: boolean) => void;
  onError: (error: Error) => void;
};

export function streamAnswer(
  chatId: string,
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): void {
  const url = `${API_URL}/chat/${chatId}/stream?question=${encodeURIComponent(question)}`;

  (async () => {
    try {
      const res = await fetch(url, { signal });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Stream failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const payload = line.slice(5).trim();
          if (!payload) continue;

          const data = JSON.parse(payload) as StreamEvent;

          if ("content" in data && data.content) {
            handlers.onToken(data.content);
          }
          if ("done" in data && data.done) {
            handlers.onDone(data.sources ?? [], data.cached);
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      handlers.onError(
        err instanceof Error ? err : new Error("Stream failed"),
      );
    }
  })();
}
