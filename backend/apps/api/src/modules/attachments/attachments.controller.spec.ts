import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AttachmentsController } from './attachments.controller';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OBJECT_STORAGE_PROVIDER } from './object-storage.provider';
import { MALWARE_SCANNER } from './malware-scanner';
import { AttachmentStatus } from '@nexavoice/domain-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Readable } from 'stream';

describe('AttachmentsController - Authorization & Security Validation', () => {
  let controller: AttachmentsController;
  let mockPrisma: any;
  let mockStorage: any;
  let mockScanner: any;

  beforeEach(async () => {
    mockPrisma = {
      attachment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'att-1', ...data })),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
      },
    };

    mockStorage = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockResolvedValue({
        stream: Readable.from(['file content']),
        sizeBytes: 12,
        mimeType: 'image/png',
      }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };

    mockScanner = {
      scanBuffer: jest.fn().mockResolvedValue('CLEAN'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OBJECT_STORAGE_PROVIDER, useValue: mockStorage },
        { provide: MALWARE_SCANNER, useValue: mockScanner },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
  });

  const generateValidToken = (id: string, key: string) => {
    return crypto.createHmac('sha256', 'attachment-signing-key').update(`${id}:${key}`).digest('hex');
  };

  describe('PUT /upload/:id', () => {
    it('1. should successfully upload a clean binary and mark CLEAN', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        objectKey: 'attachments/user-1/file.png',
        fileName: 'file.png',
        mimeType: 'image/png',
      });

      const token = generateValidToken('att-1', 'attachments/user-1/file.png');
      const req: any = Readable.from([Buffer.from('valid png data')]);
      req.query = { token };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.uploadAttachment('att-1', req, res);

      expect(mockScanner.scanBuffer).toHaveBeenCalled();
      expect(mockStorage.putObject).toHaveBeenCalledWith(
        'attachments/user-1/file.png',
        expect.any(Buffer),
        'image/png',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'uploaded',
          scanStatus: AttachmentStatus.CLEAN,
        }),
      );
    });

    it('2. should QUARANTINE malicious files (.exe or viral payload)', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-evil',
        objectKey: 'attachments/user-1/trojan.exe',
        fileName: 'trojan.exe',
        mimeType: 'application/octet-stream',
      });

      mockScanner.scanBuffer.mockResolvedValue('QUARANTINED');

      const token = generateValidToken('att-evil', 'attachments/user-1/trojan.exe');
      const req: any = Readable.from([Buffer.from('MZ...executable payload')]);
      req.query = { token };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.uploadAttachment('att-evil', req, res);

      expect(mockPrisma.attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AttachmentStatus.QUARANTINED },
        }),
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttachmentStatus.QUARANTINED,
        }),
      );
      expect(mockStorage.putObject).not.toHaveBeenCalled();
    });

    it('3. should reject upload with invalid or forged token', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        objectKey: 'key-1',
        fileName: 'file.png',
      });

      const req: any = Readable.from([Buffer.from('data')]);
      req.query = { token: 'forged-token' };
      const res: any = {};

      await expect(controller.uploadAttachment('att-1', req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('4. should reject empty file uploads', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        objectKey: 'key-1',
        fileName: 'file.png',
      });

      const token = generateValidToken('att-1', 'key-1');
      const req: any = Readable.from([]);
      req.query = { token };
      const res: any = {};

      await expect(controller.uploadAttachment('att-1', req, res)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /download/:id - ABAC Authorization', () => {
    it('5. should DENY download if caller is NOT a participant in the conversation', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue({
        id: 'att-secret',
        objectKey: 'attachments/user-a/confidential.pdf',
        uploaderId: 'user-a',
        status: AttachmentStatus.CLEAN,
        message: {
          conversation: {
            id: 'conv-private',
            participants: [{ userId: 'user-a' }, { userId: 'user-c' }],
          },
        },
      });

      const req: any = { user: { id: 'attacker-b' } }; // Attacker B knows the key!
      const res: any = {};

      await expect(controller.downloadAttachment('att-secret', req, res)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('6. should DENY download if file is QUARANTINED', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue({
        id: 'att-quarantine',
        objectKey: 'attachments/user-a/virus.exe',
        uploaderId: 'user-a',
        status: AttachmentStatus.QUARANTINED,
        message: null,
      });

      const req: any = { user: { id: 'user-a' } };
      const res: any = {};

      await expect(controller.downloadAttachment('att-quarantine', req, res)).rejects.toThrow(
        'Access denied: file has been quarantined for security violations',
      );
    });

    it('7. should ALLOW download when caller is an authorized participant', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue({
        id: 'att-valid',
        objectKey: 'attachments/user-a/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        uploaderId: 'user-a',
        status: AttachmentStatus.CLEAN,
        message: {
          conversation: {
            id: 'conv-team',
            participants: [{ userId: 'user-a' }, { userId: 'user-b' }],
          },
        },
      });

      const req: any = { user: { id: 'user-b' } }; // User B is an authorized participant!
      const mockStream = { pipe: jest.fn() };
      mockStorage.getObject.mockResolvedValue({
        stream: mockStream,
        sizeBytes: 1024,
        mimeType: 'image/jpeg',
      });

      const res: any = {
        set: jest.fn(),
      };

      await controller.downloadAttachment('att-valid', req, res);

      expect(mockStorage.getObject).toHaveBeenCalledWith('attachments/user-a/photo.jpg');
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'image/jpeg',
          'X-Content-Type-Options': 'nosniff',
        }),
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });
  });
});
