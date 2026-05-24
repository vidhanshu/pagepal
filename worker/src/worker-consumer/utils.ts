import ollama from 'ollama';

export function chunkText(text: string, chunkSize = 500, overlap = 100) {
  const chunks: string[] = [];

  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    chunks.push(text.slice(start, end));

    start += chunkSize - overlap;
  }

  return chunks;
}

export async function createEmbedding(text: string) {
  const response = await ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: text,
  });

  return response.embedding;
}
