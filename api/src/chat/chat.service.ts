import { CreateChatDto } from './dto/create-chat.dto';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mkdir, writeFile } from 'fs/promises';
import { PdfStatus } from 'src/generated/prisma/client';
import { ClientKafka } from '@nestjs/microservices';
import * as path from 'path';

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('KAFKA_SERVICE') private kafka: ClientKafka,
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
    const uploadsDir =
      process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), '..', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(
      uploadsDir,
      `${Date.now()}-${pdfFile.originalname}`,
    );

    await writeFile(filePath, pdfFile.buffer);

    const pdf = await this.prisma.pdfDocument.create({
      data: {
        chatId,
        originalName: pdfFile.originalname,
        storagePath: filePath,
        size: pdfFile.size,
        processingStatus: PdfStatus.UPLOADING,
      },
    });

    const event = { pdfId: pdf.id, chatId, path: filePath };
    this.kafka.emit('pdf-uploaded', event);

    return pdf;
  }
}
