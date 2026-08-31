import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UpstreamServiceError } from '../errors/domain.error';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObjectInfo {
  sizeBytes: number;
  mimeType: string | null;
  checksum: string | null;
}

/**
 * Object storage behind one interface (ADR-0005).
 *
 * The implementation below speaks S3, which covers both MinIO (local and on the
 * EC2 host, per ADR-0014) and AWS S3 — moving between them is an env change, not
 * a code change.
 */
export interface StorageProvider {
  /** Presigned URL the client PUTs bytes to directly. */
  createUploadUrl(key: string, mimeType: string, expiresInSeconds: number): Promise<string>;
  /** Presigned URL for reading, so objects are never public. */
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Null when the object does not exist — used to confirm an upload landed. */
  stat(key: string): Promise<StoredObjectInfo | null>;
  delete(key: string): Promise<void>;
}

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');

    const endpoint = config.get<string | undefined>('STORAGE_ENDPOINT');

    this.client = new S3Client({
      region: config.getOrThrow<string>('STORAGE_REGION'),
      // Set for MinIO; omit for real AWS S3.
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });
  }

  async createUploadUrl(key: string, mimeType: string, expiresInSeconds: number): Promise<string> {
    // ContentType is signed in, so a client cannot upload a different type than
    // the one it declared and we validated.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        sizeBytes: result.ContentLength ?? 0,
        mimeType: result.ContentType ?? null,
        checksum: result.ETag ? result.ETag.replace(/"/g, '') : null,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw new UpstreamServiceError('Object storage is unavailable', { status });
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
