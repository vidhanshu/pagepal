import { Module } from '@nestjs/common';
import { WorkerConsumerController } from './worker-consumer.controller';
import { S3Module } from '@pdf-chat-ai/nestjs-s3';

@Module({
  imports: [S3Module],
  controllers: [WorkerConsumerController],
})
export class WorkerConsumerModule {}
