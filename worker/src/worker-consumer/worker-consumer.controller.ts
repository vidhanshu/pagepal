import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller('worker-consumer')
export class WorkerConsumerController {
  @EventPattern('pdf-uploaded')
  process(@Payload() message: any) {
    console.log('Received', message);
  }
}
