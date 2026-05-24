import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [KafkaModule],
})
export class ChatModule {}
