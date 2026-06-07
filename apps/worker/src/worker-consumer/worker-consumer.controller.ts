import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PDFParse } from 'pdf-parse';
import { chunkText, cleanText, createEmbedding } from '@pdf-chat-ai/shared';
import { Prisma } from '@pdf-chat-ai/database';
import { PrismaService } from '@pdf-chat-ai/nestjs-prisma';
import { S3Service } from '@pdf-chat-ai/nestjs-s3';

@Controller('worker-consumer')
export class WorkerConsumerController {
  private readonly logger = new Logger(WorkerConsumerController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @EventPattern('pdf-uploaded')
  async process(
    @Payload() message: { pdfId: string; chatId: string; s3Key: string },
  ) {
    this.logger.log(
      `Processing pdf ${message.pdfId} from s3 key ${message.s3Key}`,
    );
    console.log('processing pdf');

    let buffer: Buffer;
    try {
      buffer = await this.s3.getFile(message.s3Key);
      console.log('got buffer from s3');
    } catch {
      this.logger.warn(
        `Skipping message — object not found in S3 (likely a stale Kafka event): ${message.s3Key}`,
      );
      return;
    }
    console.log('parsed buffer');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = cleanText(result.text);
    console.log('cleaned text');
    if (!text) {
      this.logger.warn(`No extractable text in pdf ${message.pdfId}`);
      return result;
    }
    console.log('text is not empty');
    const chunks = chunkText(text)
      .map((c) => cleanText(c))
      .filter((c) => c.length > 0);
    console.log('chunks');
    await this.prisma.chunk.deleteMany({ where: { pdfId: message.pdfId } });
    console.log('deleted chunks');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk, 'document');
      const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);
      console.log('created embedding vector');
      await this.prisma.$executeRaw(
        Prisma.sql`INSERT INTO "Chunk" (id, "pdfId", "content", "embedding", "chunkIndex") VALUES (${crypto.randomUUID()}, ${message.pdfId}, ${chunk}, ${embeddingVector}, ${i})`,
      );
    }
    console.log('stored chunks');
    this.logger.log(`Stored ${chunks.length} chunks for pdf ${message.pdfId}`);

    return result;
  }
}
