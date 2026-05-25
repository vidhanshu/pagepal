import { createHash } from 'crypto';
import { cleanText } from '../utils';

const PREFIX = 'pdfchat';

export const ANSWER_CACHE_TTL_SECONDS = 3600;

export function answerCacheKey(chatId: string, question: string): string {
  const normalized = cleanText(question).toLowerCase();

  const hash = createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, 16);

  return `${PREFIX}:answer:${chatId}:${hash}`;
}

export function answerCachePattern(chatId: string): string {
  return `${PREFIX}:answer:${chatId}:*`;
}
