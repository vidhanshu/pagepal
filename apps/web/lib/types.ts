export type Source = {
  content: string;
  distance: number;
  chunkIndex: number;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  cached?: boolean;
  isStreaming?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  pdfUploaded: boolean;
  pdfName?: string;
  messages: Message[];
  createdAt: number;
};

export type PdfDocument = {
  id: string;
  chatId: string;
  originalName: string;
  s3Key: string;
  size: number;
  processingStatus: string;
};

export type StreamEvent =
  | { content: string; cached?: boolean }
  | { done: true; sources: Source[]; cached?: boolean };
