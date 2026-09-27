import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import {
  DownloadTargetResult,
  ObjectMetadata,
  ObjectStorageProvider,
  UploadTargetResult,
} from './object-storage.provider';

@Injectable()
export class LocalDiskStorageProvider implements ObjectStorageProvider {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>(
      'storage.localDir',
      path.resolve(process.cwd(), 'storage', 'attachments'),
    );
    this.baseDir = configuredDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Prevent directory traversal attacks
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.baseDir, sanitizedKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Path traversal detected');
    }
    return fullPath;
  }

  async putObject(key: string, data: Buffer, _mimeType: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, data);
  }

  async getObject(key: string): Promise<{
    stream: Readable;
    sizeBytes: number;
    mimeType: string;
  }> {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found in local storage: ${key}`);
    }
    const stat = await fs.promises.stat(fullPath);
    const stream = fs.createReadStream(fullPath);
    return {
      stream,
      sizeBytes: stat.size,
      mimeType: 'application/octet-stream',
    };
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  async headObject(key: string): Promise<ObjectMetadata> {
    try {
      const fullPath = this.resolvePath(key);
      if (fs.existsSync(fullPath)) {
        const stat = await fs.promises.stat(fullPath);
        return {
          exists: true,
          sizeBytes: stat.size,
          mimeType: 'application/octet-stream',
        };
      }
    } catch {
      // Ignored
    }
    return { exists: false };
  }

  async createUploadTarget(key: string, expiresInSeconds: number): Promise<UploadTargetResult> {
    return {
      uploadUrl: `/api/v1/attachments/upload/${encodeURIComponent(key)}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      expiresInSeconds,
    };
  }

  async createDownloadTarget(key: string, expiresInSeconds: number): Promise<DownloadTargetResult> {
    return {
      downloadUrl: `/api/v1/attachments/download/${encodeURIComponent(key)}`,
      expiresInSeconds,
    };
  }
}
