import {
  Controller,
  Get,
  Put,
  Param,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { AttachmentStatus } from '@nexavoice/domain-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OBJECT_STORAGE_PROVIDER, ObjectStorageProvider } from './object-storage.provider';
import { MALWARE_SCANNER, MalwareScanner } from './malware-scanner';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

@Controller('api/v1/attachments')
export class AttachmentsController {
  private readonly logger = new StructuredLogger('AttachmentsController');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storageProvider: ObjectStorageProvider,
    @Inject(MALWARE_SCANNER)
    private readonly malwareScanner: MalwareScanner,
  ) {}

  /**
   * Upload binary data for an initialized attachment record.
   */
  @Put('upload/:id')
  async uploadAttachment(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment record not found');
    }

    // Verify upload token
    const token = req.query['token'] as string;
    const expectedToken = crypto
      .createHmac('sha256', 'attachment-signing-key')
      .update(`${attachment.id}:${attachment.objectKey}`)
      .digest('hex');

    if (!token || token !== expectedToken) {
      throw new UnauthorizedException('Invalid or expired upload authorization token');
    }

    // Read incoming stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('Cannot upload empty file');
    }

    if (buffer.length > 25 * 1024 * 1024) {
      throw new BadRequestException('Uploaded file exceeds maximum 25MB limit');
    }

    // Run malware scan
    const scanResult = await this.malwareScanner.scanBuffer(buffer, attachment.fileName);

    if (scanResult === 'QUARANTINED') {
      await this.prisma.attachment.update({
        where: { id: attachment.id },
        data: { status: AttachmentStatus.QUARANTINED },
      });
      this.logger.warn({
        event: 'attachment_quarantined',
        attachmentId: attachment.id,
        fileName: attachment.fileName,
      });
      return res.status(403).json({
        error: 'File quarantined: potentially malicious content detected',
        status: AttachmentStatus.QUARANTINED,
      });
    }

    // Store in object storage
    await this.storageProvider.putObject(attachment.objectKey, buffer, attachment.mimeType);

    // Update attachment status
    const updatedStatus = scanResult === 'CLEAN' ? AttachmentStatus.CLEAN : AttachmentStatus.PENDING_SCAN;
    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: updatedStatus,
        sizeBytes: buffer.length,
      },
    });

    this.logger.log({
      event: 'attachment_uploaded_successfully',
      attachmentId: attachment.id,
      sizeBytes: buffer.length,
      status: updatedStatus,
    });

    return res.status(200).json({
      status: 'uploaded',
      attachmentId: attachment.id,
      scanStatus: updatedStatus,
    });
  }

  /**
   * Securely downloads an attachment with strict ABAC authorization.
   */
  @Get('download/:id')
  @UseGuards(JwtAuthGuard)
  async downloadAttachment(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    // Look up attachment by ID or objectKey
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        OR: [{ id }, { objectKey: id }],
      },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                participants: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // ABAC Authorization:
    // 1. If attachment is linked to a message, user must be a participant in that conversation
    if (attachment.message) {
      const isParticipant = attachment.message.conversation.participants.some(
        (p) => p.userId === userId,
      );
      if (!isParticipant) {
        throw new ForbiddenException('Access denied: you are not a participant in this conversation');
      }
    } else {
      // 2. If not yet linked to a message, only the uploader may access it
      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException('Access denied: attachment does not belong to caller');
      }
    }

    // Verify status permits download
    if (attachment.status === AttachmentStatus.QUARANTINED) {
      throw new ForbiddenException('Access denied: file has been quarantined for security violations');
    }

    if (attachment.status === AttachmentStatus.DELETED) {
      throw new NotFoundException('Attachment has been deleted');
    }

    const object = await this.storageProvider.getObject(attachment.objectKey);

    res.set({
      'Content-Type': attachment.mimeType || object.mimeType,
      'Content-Length': object.sizeBytes,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    });

    object.stream.pipe(res);
  }
}
