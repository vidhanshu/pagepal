import { Injectable } from '@nestjs/common';
import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

function createS3Client(config: S3ClientConfig): S3Client {
  return new S3Client(config);
}

@Injectable()
export class S3Service {
  private client: S3Client;

  constructor(private readonly config: ConfigService) {
    const s3Config: S3ClientConfig = {
      region: this.config.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    };

    this.client = createS3Client(s3Config);
  }

  getClient(): S3Client {
    return this.client;
  }

  async uploadFile(buffer: Buffer, s3Key: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.getOrThrow<string>('AWS_BUCKET_NAME'),
        Key: s3Key,
        Body: buffer,
      }),
    );
  }
}
