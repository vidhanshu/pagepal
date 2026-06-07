import { CreateChatDto } from './dto/create-chat.dto';
import {
  Inject,
  Injectable,
  MessageEvent,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@pdf-chat-ai/nestjs-prisma';
import { RedisService } from '../redis/redis.service';
import {
  ANSWER_CACHE_TTL_SECONDS,
  answerCacheKey,
  answerCachePattern,
} from '../redis/cache-keys';
import { PdfStatus, Prisma } from '@pdf-chat-ai/database';
import { ClientKafka } from '@nestjs/microservices';
import {
  cleanText,
  createEmbedding,
  formatContext,
  generateAnswer,
  MAX_CHUNK_DISTANCE,
  streamAnswer,
} from '@pdf-chat-ai/shared';
import { S3Service } from '@pdf-chat-ai/nestjs-s3';
import { Observable } from 'rxjs';

type AnswerResult = {
  answer: string;
  sources: { content: string; distance: number; chunkIndex: number }[];
  cached?: boolean;
};

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject('KAFKA_SERVICE') private kafka: ClientKafka,
    private readonly s3: S3Service,
  ) {}

  async onModuleInit() {
    await this.kafka.connect();
  }

  async createChat(createChatDto: CreateChatDto) {
    return this.prisma.chat.create({
      data: {
        title: createChatDto.title,
        userId: '1',
      },
    });
  }

  async upload(pdfFile: Express.Multer.File, chatId: string) {
    const s3Key = `${chatId}/${Date.now()}-${pdfFile.originalname}`;
    await this.s3.uploadFile(pdfFile.buffer, s3Key);
    console.log('uploaded to s3');
    // ********** OLD CODE **********
    // const uploadsDir =
    //   process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), '..', 'uploads');
    // await mkdir(uploadsDir, { recursive: true });

    // const filePath = path.join(
    //   uploadsDir,
    //   `${Date.now()}-${pdfFile.originalname}`,
    // );

    // await writeFile(filePath, pdfFile.buffer);
    // ********** OLD CODE **********

    const pdf = await this.prisma.pdfDocument.create({
      data: {
        chatId,
        originalName: pdfFile.originalname,
        s3Key,
        size: pdfFile.size,
        processingStatus: PdfStatus.UPLOADING,
      },
    });
    console.log('created pdf document');

    const event = { pdfId: pdf.id, chatId, s3Key };
    this.kafka.emit('pdf-uploaded', event);
    console.log('emitted pdf uploaded event');

    await this.redis.deleteByPattern(answerCachePattern(chatId));
    console.log('deleted answer cache');
    return pdf;
  }

  async getAnswer(chatId: string, question: string): Promise<AnswerResult> {
    const cacheKey = answerCacheKey(chatId, question);
    const cached = await this.redis.getJson<AnswerResult>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
    const pdf = await this.prisma.pdfDocument.findFirst({
      where: { chatId },
      select: { id: true },
    });

    if (!pdf) {
      throw new NotFoundException('PDF not found for this chat');
    }

    const embedding = await createEmbedding(cleanText(question), 'query');
    const queryVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);

    const chunks = await this.prisma.$queryRaw<
      { content: string; distance: number; chunkIndex: number }[]
    >(
      Prisma.sql`
        SELECT
          content,
          embedding <=> ${queryVector} AS distance,
          "chunkIndex"
        FROM "Chunk"
        WHERE "pdfId" = ${pdf.id}
        ORDER BY embedding <=> ${queryVector}
        LIMIT 8
      `,
    );

    const relevant = chunks.filter((c) => c.distance <= MAX_CHUNK_DISTANCE);

    if (relevant.length === 0) {
      return {
        answer:
          'I could not find relevant information in the document for that question. Try rephrasing or ensure the PDF was fully processed.',
        sources: chunks,
      };
    }

    const context = formatContext(relevant);
    const answer = await generateAnswer(context, question);

    const result: AnswerResult = { answer, sources: relevant };
    await this.redis.setJson(cacheKey, result, ANSWER_CACHE_TTL_SECONDS);

    return result;
  }

  async streamAnswer(
    chatId: string,
    question: string,
  ): Promise<Observable<MessageEvent>> {
    const cacheKey = answerCacheKey(chatId, question);
    const cached = await this.redis.getJson<AnswerResult>(cacheKey);
    if (cached) {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next({ data: { content: cached.answer, cached: true } });
        subscriber.next({
          data: { done: true, sources: cached.sources, cached: true },
        });
        subscriber.complete();
      });
    }

    const pdf = await this.prisma.pdfDocument.findFirst({
      where: { chatId },
      select: { id: true },
    });

    if (!pdf) {
      throw new NotFoundException('PDF not found for this chat');
    }

    const embedding = await createEmbedding(cleanText(question), 'query');
    const queryVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);

    const chunks = await this.prisma.$queryRaw<
      { content: string; distance: number; chunkIndex: number }[]
    >(
      Prisma.sql`
        SELECT
          content,
          embedding <=> ${queryVector} AS distance,
          "chunkIndex"
        FROM "Chunk"
        WHERE "pdfId" = ${pdf.id}
        ORDER BY embedding <=> ${queryVector}
        LIMIT 8
      `,
    );

    const relevant = chunks.filter((c) => c.distance <= MAX_CHUNK_DISTANCE);

    if (relevant.length === 0) {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next({
          data: {
            content:
              'I could not find relevant information in the document for that question. Try rephrasing or ensure the PDF was fully processed.',
          },
        });
        subscriber.next({ data: { done: true, sources: chunks } });
        subscriber.complete();
      });
    }

    const context = formatContext(relevant);
    const tokens = streamAnswer(context, question);

    return new Observable<MessageEvent>((subscriber) => {
      let answer = '';

      (async () => {
        for await (const token of tokens) {
          answer += token;
          subscriber.next({ data: { content: token } });
        }

        const result: AnswerResult = { answer, sources: relevant };
        await this.redis.setJson(cacheKey, result, ANSWER_CACHE_TTL_SECONDS);

        subscriber.next({ data: { done: true, sources: relevant } });
        subscriber.complete();
      })().catch((err) => subscriber.error(err));

      // Stop generating if the client disconnects.
      return () => void tokens.return(undefined);
    });
  }
}
