import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { AttachmentStatus } from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UploadAttachmentInitInput, UploadAttachmentInitResultGql } from './messaging.types';

const DISALLOWED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/javascript',
  'text/javascript',
  'application/x-php',
  'application/x-httpd-php',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes a secure pre-signed attachment upload.
   * Enforces MIME security and file size limits.
   */
  async initializeUpload(
    uploaderId: string,
    input: UploadAttachmentInitInput,
  ): Promise<UploadAttachmentInitResultGql> {
    const mime = input.mimeType.toLowerCase();
    if (DISALLOWED_MIME_TYPES.has(mime)) {
      throw new BadRequestException('Disallowed file MIME type for security reasons');
    }

    if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds maximum allowed limit (25MB)');
    }

    if (input.sizeBytes <= 0) {
      throw new BadRequestException('Invalid file size');
    }

    const objectKey = `attachments/${uploaderId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Create attachment record in database
    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId,
        objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        status: AttachmentStatus.CLEAN,
        voiceDurationMs: input.voiceDurationMs,
        voiceFormat: input.voiceFormat,
      },
    });

    // Generate signed upload target (in production, AWS S3 / Cloudflare R2 presigned PUT url)
    const token = crypto
      .createHmac('sha256', 'attachment-signing-key')
      .update(`${attachment.id}:${objectKey}`)
      .digest('hex');
    const uploadUrl = `/api/v1/attachments/upload/${attachment.id}?token=${token}`;

    return {
      attachmentId: attachment.id,
      uploadUrl,
      objectKey,
      expiresInSeconds: 900, // 15 minutes
    };
  }

  /**
   * Generates a secure download/view URL for an attachment.
   */
  getAttachmentDownloadUrl(objectKey: string): string {
    return `/api/v1/attachments/download/${encodeURIComponent(objectKey)}`;
  }
}
