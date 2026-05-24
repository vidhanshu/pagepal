import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { access, readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { chunkText, cleanText, createEmbedding } from './utils';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('worker-consumer')
export class WorkerConsumerController {
  private readonly logger = new Logger(WorkerConsumerController.name);
  constructor(private readonly prisma: PrismaService) {}

  @EventPattern('pdf-uploaded')
  async process(
    @Payload() message: { pdfId: string; path: string; chatId: string },
  ) {
    this.logger.log(`Processing pdf ${message.pdfId} at ${message.path}`);

    try {
      await access(message.path);
    } catch {
      this.logger.warn(
        `Skipping message — file not found (likely a stale Kafka event): ${message.path}`,
      );
      return;
    }

    const buffer = await readFile(message.path);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = cleanText(result.text);

    if (!text) {
      this.logger.warn(`No extractable text in pdf ${message.pdfId}`);
      return result;
    }

    const chunks = chunkText(text)
      .map((c) => cleanText(c))
      .filter((c) => c.length > 0);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk);
      const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);

      await this.prisma.$executeRaw(
        Prisma.sql`INSERT INTO "Chunk" (id, "pdfId", "content", "embedding", "chunkIndex") VALUES (${crypto.randomUUID()}, ${message.pdfId}, ${chunk}, ${embeddingVector}, ${i})`,
      );
    }

    this.logger.log(`Stored ${chunks.length} chunks for pdf ${message.pdfId}`);

    return result;
  }
}
