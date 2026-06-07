import { CreateChatDto } from './dto/create-chat.dto';
import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  ANSWER_CACHE_TTL_SECONDS,
  answerCacheKey,
  answerCachePattern,
} from '../redis/cache-keys';
import { PdfStatus, Prisma } from 'src/generated/prisma/client';
import { ClientKafka } from '@nestjs/microservices';
import {
  cleanText,
  createEmbedding,
  formatContext,
  generateAnswer,
  MAX_CHUNK_DISTANCE,
} from '../utils';
import { S3Service } from 'src/s3/s3.service';

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

    const event = { pdfId: pdf.id, chatId, s3Key };
    this.kafka.emit('pdf-uploaded', event);

    await this.redis.deleteByPattern(answerCachePattern(chatId));

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
}
