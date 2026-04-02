import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

import { getUtcDayKey } from '../../shared/utc.js';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  signedUrlTtlSeconds: number;
  maxUploadBytes: number;
};

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function parseNumber(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeUserId(userId: string): string {
  return userId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

function loadR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
  const bucket = process.env.R2_BUCKET ?? '';
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? '';

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    signedUrlTtlSeconds: parseNumber(process.env.R2_SIGNED_URL_TTL_SECONDS, 300),
    maxUploadBytes: parseNumber(process.env.MAX_UPLOAD_BYTES, 4 * 1024 * 1024)
  };
}

export class StorageService {
  private readonly config = loadR2Config();
  private readonly client = this.createClient();

  getConfigStatus() {
    const configured =
      Boolean(this.config.accountId) &&
      Boolean(this.config.accessKeyId) &&
      Boolean(this.config.secretAccessKey) &&
      Boolean(this.config.bucket);

    return {
      configured,
      bucket: this.config.bucket,
      signedUrlTtlSeconds: this.config.signedUrlTtlSeconds,
      maxUploadBytes: this.config.maxUploadBytes
    };
  }

  isValidContentType(contentType: string): boolean {
    return ALLOWED_CONTENT_TYPES.has(contentType);
  }

  getMaxUploadBytes(): number {
    return this.config.maxUploadBytes;
  }

  async createUploadUrl(input: {
    userId: string;
    duration: number;
    contentType: string;
  }): Promise<{
    objectKey: string;
    uploadUrl: string;
    publicUrl: string;
    expiresInSeconds: number;
    dayKeyUtc: string;
    maxUploadBytes: number;
  }> {
    this.assertConfigured();

    const dayKeyUtc = getUtcDayKey();
    const normalizedUserId = sanitizeUserId(input.userId);
    const ext = extensionForContentType(input.contentType);
    const objectKey = `artworks/${dayKeyUtc}/${input.duration}min/${normalizedUserId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      CacheControl: 'public, max-age=86400, immutable'
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.config.signedUrlTtlSeconds
    });

    return {
      objectKey,
      uploadUrl,
      publicUrl: this.buildPublicUrl(objectKey),
      expiresInSeconds: this.config.signedUrlTtlSeconds,
      dayKeyUtc,
      maxUploadBytes: this.config.maxUploadBytes
    };
  }

  private assertConfigured(): void {
    const { configured } = this.getConfigStatus();
    if (!configured) {
      throw new Error('R2 is not configured');
    }
  }

  private createClient(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    });
  }

  private buildPublicUrl(objectKey: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
    }

    return `https://pub-${this.config.accountId}.r2.dev/${this.config.bucket}/${objectKey}`;
  }
}

export const storageService = new StorageService();
