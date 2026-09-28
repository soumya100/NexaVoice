import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CallStateMachineService } from './services/call-state-machine.service';
import { CallingAuthorizationService } from './services/calling-authorization.service';
import { IceServerService } from './services/ice-server.service';
import { LocalPeerMediaProvider } from './media-provider/local-peer.media-provider';
import { SfuMediaProvider } from './media-provider/sfu.media-provider';
import { CallingService } from './services/calling.service';
import { CallingResolver } from './graphql/calling.resolver';
import { DefaultTranscriptionProvider } from './transcription/default-transcription.provider';

@Module({
  imports: [
    AuthorizationModule,
    forwardRef(() => RealtimeModule),
  ],
  providers: [
    CallStateMachineService,
    CallingAuthorizationService,
    IceServerService,
    LocalPeerMediaProvider,
    SfuMediaProvider,
    DefaultTranscriptionProvider,
    CallingService,
    CallingResolver,
  ],
  exports: [
    CallingService,
    CallStateMachineService,
    CallingAuthorizationService,
    IceServerService,
    LocalPeerMediaProvider,
    SfuMediaProvider,
    DefaultTranscriptionProvider,
  ],
})
export class CallingModule {}
