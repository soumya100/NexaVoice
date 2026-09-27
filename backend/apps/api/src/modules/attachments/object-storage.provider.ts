import { Readable } from 'stream';

export interface UploadTargetResult {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresInSeconds: number;
}

export interface DownloadTargetResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface ObjectMetadata {
  exists: boolean;
  sizeBytes?: number;
  mimeType?: string;
  etag?: string;
}

export interface ObjectStorageProvider {
  /**
   * Puts raw buffer directly into object storage.
   */
  putObject(key: string, data: Buffer, mimeType: string): Promise<void>;

  /**
   * Reads an object from storage as a readable stream.
   */
  getObject(key: string): Promise<{
    stream: Readable;
    sizeBytes: number;
    mimeType: string;
  }>;

  /**
   * Deletes an object by key.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Retrieves object existence and metadata.
   */
  headObject(key: string): Promise<ObjectMetadata>;

  /**
   * Creates a signed upload target URL (e.g. S3 presigned PUT or local development controller route).
   */
  createUploadTarget(key: string, expiresInSeconds: number): Promise<UploadTargetResult>;

  /**
   * Creates a signed download target URL.
   */
  createDownloadTarget(key: string, expiresInSeconds: number): Promise<DownloadTargetResult>;
}

export const OBJECT_STORAGE_PROVIDER = Symbol('OBJECT_STORAGE_PROVIDER');
