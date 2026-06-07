import ollama from "ollama";

/** Qwen3 "thinks" before answering — adds 10–40s+ TTFT with no visible tokens. */
const CHAT_MODEL = process.env.LLM_CHAT_MODEL ?? "qwen3:4b";
const CHAT_OPTIONS = { think: false as const };

const MIN_CHUNK_CHARS = 80;
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 200;

export function cleanText(text: string) {
  return text
    .replaceAll("\0", "")
    .replace(/\r\n/g, "\n")
    .replace(/--\s*\d+\s+of\s+\d+\s+--/gi, "")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .trim();
}

/** Paragraph-aware chunks; avoids mid-word 500-char slices from PDF extraction noise. */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_CHUNK_CHARS);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length >= MIN_CHUNK_CHARS) {
      chunks.push(current);
    }
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      flush();
      let start = 0;
      while (start < para.length) {
        const piece = para.slice(start, start + chunkSize).trim();
        if (piece.length >= MIN_CHUNK_CHARS) {
          chunks.push(piece);
        }
        start += chunkSize - overlap;
      }
      continue;
    }

    const next = current ? `${current}\n\n${para}` : para;
    if (next.length <= chunkSize) {
      current = next;
    } else {
      flush();
      current = para;
    }
  }

  flush();
  return chunks;
}

export async function createEmbedding(
  text: string,
  task: "document" | "query" = "document",
) {
  const prefix = task === "query" ? "search_query: " : "search_document: ";
  const response = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: prefix + text,
  });

  return response.embedding;
}

/** Cosine distance from pgvector `<=>`; lower = more similar. */
export const MAX_CHUNK_DISTANCE = 0.55;

export function formatContext(
  chunks: { content: string; chunkIndex: number }[],
): string {
  return chunks
    .map(
      (c, i) =>
        `[Excerpt ${i + 1} | chunk #${c.chunkIndex}]\n${c.content.trim()}`,
    )
    .join("\n\n---\n\n");
}

const ANSWER_SYSTEM_PROMPT = `You answer questions using ONLY the provided PDF excerpts.
The excerpts may be fragmented (broken lines, headers, page numbers) — still extract useful facts when present.
Synthesize a clear, direct answer from the excerpts.
Only say "I could not find it in the document." if none of the excerpts relate to the question.
Do not use outside knowledge.`;

export async function generateAnswer(context: string, question: string) {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    think: CHAT_OPTIONS.think,
    messages: answerMessages(context, question),
  });

  return response.message.content;
}

/** Prompt size stats for timing diagnostics. */
export function buildAnswerPrompt(context: string, question: string) {
  return {
    contextChars: context.length,
    questionChars: question.length,
    totalChars:
      ANSWER_SYSTEM_PROMPT.length +
      context.length +
      question.length +
      40,
  };
}

function answerMessages(context: string, question: string) {
  return [
    { role: "system" as const, content: ANSWER_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Excerpts from the PDF:\n\n${context}\n\n---\n\nQuestion: ${question}`,
    },
  ];
}

/** Streams the answer token-by-token, hiding the underlying LLM client. */
export async function* streamAnswer(
  context: string,
  question: string,
): AsyncGenerator<string> {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    stream: true,
    think: CHAT_OPTIONS.think,
    messages: answerMessages(context, question),
  });

  for await (const part of response) {
    const token = part.message.content;
    if (token) {
      yield token;
    }
  }
}
