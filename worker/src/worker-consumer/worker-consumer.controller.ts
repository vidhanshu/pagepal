import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { access, readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';

@Controller('worker-consumer')
export class WorkerConsumerController {
  private readonly logger = new Logger(WorkerConsumerController.name);

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
    this.logger.log(`Extracted ${result.text.length} characters from PDF`);
    return result;
  }
}
