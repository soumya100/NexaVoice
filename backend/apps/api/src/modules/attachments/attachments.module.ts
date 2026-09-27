import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AttachmentsController } from './attachments.controller';
import { OBJECT_STORAGE_PROVIDER } from './object-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { MALWARE_SCANNER, DeterministicDevelopmentMalwareScanner, ProductionClamAvMalwareScanner } from './malware-scanner';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthenticationModule, AuthorizationModule],
  controllers: [AttachmentsController],
  providers: [
    LocalDiskStorageProvider,
    S3StorageProvider,
    DeterministicDevelopmentMalwareScanner,
    ProductionClamAvMalwareScanner,
    {
      provide: OBJECT_STORAGE_PROVIDER,
      useClass: LocalDiskStorageProvider,
    },
    {
      provide: MALWARE_SCANNER,
      useClass: DeterministicDevelopmentMalwareScanner,
    },
  ],
  exports: [OBJECT_STORAGE_PROVIDER, MALWARE_SCANNER, LocalDiskStorageProvider],
})
export class AttachmentsModule {}
