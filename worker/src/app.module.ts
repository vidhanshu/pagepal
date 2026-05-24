import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkerConsumerModule } from './worker-consumer/worker-consumer.module';

@Module({
  imports: [WorkerConsumerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
