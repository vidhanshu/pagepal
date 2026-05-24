import { Module } from '@nestjs/common';
import { WorkerConsumerController } from './worker-consumer.controller';

@Module({
  controllers: [WorkerConsumerController],
})
export class WorkerConsumerModule {}
