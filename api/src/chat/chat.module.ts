import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { KafkaModule } from 'src/kafka/kafka.module';
import { ConfigModule } from '@nestjs/config';
import { S3Module } from 'src/s3/s3.module';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [KafkaModule, ConfigModule, S3Module],
})
export class ChatModule {}
