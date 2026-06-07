import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { KafkaModule } from '../kafka/kafka.module';
import { ConfigModule } from '@nestjs/config';
import { S3Module } from '@pdf-chat-ai/nestjs-s3';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [KafkaModule, ConfigModule, S3Module],
})
export class ChatModule {}
