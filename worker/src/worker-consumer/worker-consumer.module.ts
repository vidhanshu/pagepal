import { Module } from '@nestjs/common';
import { WorkerConsumerService } from './worker-consumer.service';
import { WorkerConsumerController } from './worker-consumer.controller';

@Module({
  providers: [WorkerConsumerService],
  controllers: [WorkerConsumerController],
})
export class WorkerConsumerModule {}
