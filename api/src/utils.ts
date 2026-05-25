import ollama from 'ollama';

export function cleanText(text: string) {
  return text
    .replaceAll('\0', '')
    .replace(/\r\n/g, '\n')
    .replace(/--\s*\d+\s+of\s+\d+\s+--/gi, '')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();
}

export async function createEmbedding(
  text: string,
  task: 'document' | 'query' = 'document',
) {
  const prefix = task === 'query' ? 'search_query: ' : 'search_document: ';
  const response = await ollama.embeddings({
    model: 'nomic-embed-text',
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
    .join('\n\n---\n\n');
}

export async function generateAnswer(context: string, question: string) {
  const response = await ollama.chat({
    model: 'qwen3:4b',
    messages: [
      {
        role: 'system',
        content: `You answer questions using ONLY the provided PDF excerpts.
The excerpts may be fragmented (broken lines, headers, page numbers) — still extract useful facts when present.
Synthesize a clear, direct answer from the excerpts.
Only say "I could not find it in the document." if none of the excerpts relate to the question.
Do not use outside knowledge.`,
      },
      {
        role: 'user',
        content: `Excerpts from the PDF:\n\n${context}\n\n---\n\nQuestion: ${question}`,
      },
    ],
  });

  return response.message.content;
}
