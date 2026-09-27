import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { AuthorizationDecisionService } from './authorization-decision.service';

@Global()
@Module({
  providers: [RbacService, AuthorizationDecisionService],
  exports: [RbacService, AuthorizationDecisionService],
})
export class AuthorizationModule {}
