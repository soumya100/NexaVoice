import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/auth.decorators';
import { TelephonyService } from '../services/telephony.service';
import { PhoneNumberService } from '../services/phone-number.service';
import { TelephonyRoutingService } from '../services/telephony-routing.service';
import { VoicemailService } from '../services/voicemail.service';
import {
  PhoneNumberGql,
  RoutingRuleGql,
  VoicemailMessageGql,
  TelephonyUsageGql,
  InitiatePstnCallPayloadGql,
  InitiateOutboundPstnCallInput,
  ProvisionNumberInput,
  AssignNumberInput,
  CreateRoutingRuleInput,
} from './telephony.types';
import { AuthorizationSubject, PhoneNumberStatus, VoicemailStatus } from '@nexavoice/domain-types';

@Resolver()
@UseGuards(JwtAuthGuard)
export class TelephonyResolver {
  constructor(
    private readonly telephonyService: TelephonyService,
    private readonly phoneNumberService: PhoneNumberService,
    private readonly routingService: TelephonyRoutingService,
    private readonly voicemailService: VoicemailService,
  ) {}

  // ==========================================
  // QUERIES
  // ==========================================

  @Query(() => [PhoneNumberGql])
  async phoneNumbers(
    @Args('status', { type: () => PhoneNumberStatus, nullable: true }) status?: PhoneNumberStatus,
    @Args('assignedId', { type: () => String, nullable: true }) assignedId?: string,
  ): Promise<PhoneNumberGql[]> {
    const list = await this.phoneNumberService.listNumbers({ status, assignedId });
    return list as unknown as PhoneNumberGql[];
  }

  @Query(() => PhoneNumberGql)
  async phoneNumber(@Args('id', { type: () => ID }) id: string): Promise<PhoneNumberGql> {
    const num = await this.phoneNumberService.getNumberById(id);
    return num as unknown as PhoneNumberGql;
  }

  @Query(() => String)
  async activeCallerId(@CurrentUser() user: AuthorizationSubject): Promise<string> {
    return this.phoneNumberService.resolveCallerId(user.id);
  }

  @Query(() => [RoutingRuleGql])
  async routingRules(
    @Args('phoneNumberId', { type: () => ID }) phoneNumberId: string,
  ): Promise<RoutingRuleGql[]> {
    const rules = await this.routingService.listRules(phoneNumberId);
    return rules as unknown as RoutingRuleGql[];
  }

  @Query(() => [VoicemailMessageGql])
  async voicemails(
    @CurrentUser() user: AuthorizationSubject,
    @Args('status', { type: () => VoicemailStatus, nullable: true }) status?: VoicemailStatus,
  ): Promise<VoicemailMessageGql[]> {
    const list = await this.voicemailService.listVoicemails(user.id, { status });
    return list as unknown as VoicemailMessageGql[];
  }

  @Query(() => VoicemailMessageGql)
  async voicemail(
    @CurrentUser() user: AuthorizationSubject,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VoicemailMessageGql> {
    const vm = await this.voicemailService.getVoicemail(user.id, id);
    return vm as unknown as VoicemailMessageGql;
  }

  @Query(() => [TelephonyUsageGql])
  async telephonyUsage(
    @CurrentUser() user: AuthorizationSubject,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
  ): Promise<TelephonyUsageGql[]> {
    const list = await this.telephonyService.listUsage(user.id, limit);
    return list as unknown as TelephonyUsageGql[];
  }

  // ==========================================
  // MUTATIONS
  // ==========================================

  @Mutation(() => InitiatePstnCallPayloadGql)
  async initiatePstnCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: InitiateOutboundPstnCallInput,
  ): Promise<InitiatePstnCallPayloadGql> {
    return this.telephonyService.initiateOutboundPstnCall(user.id, {
      to: input.to,
      from: input.from,
      conversationId: input.conversationId,
    });
  }

  @Mutation(() => PhoneNumberGql)
  async provisionPhoneNumber(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ProvisionNumberInput,
  ): Promise<PhoneNumberGql> {
    const num = await this.phoneNumberService.provisionNumber(user.id, {
      countryCode: input.countryCode,
      type: input.type,
      areaCode: input.areaCode,
      desiredNumber: input.desiredNumber,
    });
    return num as unknown as PhoneNumberGql;
  }

  @Mutation(() => PhoneNumberGql)
  async assignPhoneNumber(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: AssignNumberInput,
  ): Promise<PhoneNumberGql> {
    const num = await this.phoneNumberService.assignNumber(user.id, input.numberId, {
      targetType: input.targetType,
      targetId: input.targetId,
    });
    return num as unknown as PhoneNumberGql;
  }

  @Mutation(() => PhoneNumberGql)
  async unassignPhoneNumber(
    @CurrentUser() user: AuthorizationSubject,
    @Args('numberId', { type: () => ID }) numberId: string,
  ): Promise<PhoneNumberGql> {
    const num = await this.phoneNumberService.unassignNumber(user.id, numberId);
    return num as unknown as PhoneNumberGql;
  }

  @Mutation(() => PhoneNumberGql)
  async releasePhoneNumber(
    @CurrentUser() user: AuthorizationSubject,
    @Args('numberId', { type: () => ID }) numberId: string,
  ): Promise<PhoneNumberGql> {
    const num = await this.phoneNumberService.releaseNumber(user.id, numberId);
    return num as unknown as PhoneNumberGql;
  }

  @Mutation(() => RoutingRuleGql)
  async createRoutingRule(
    @CurrentUser() _user: AuthorizationSubject,
    @Args('input') input: CreateRoutingRuleInput,
  ): Promise<RoutingRuleGql> {
    const rule = await this.routingService.createRule(input);
    return rule as unknown as RoutingRuleGql;
  }

  @Mutation(() => Boolean)
  async deleteRoutingRule(
    @CurrentUser() _user: AuthorizationSubject,
    @Args('ruleId', { type: () => ID }) ruleId: string,
  ): Promise<boolean> {
    await this.routingService.deleteRule(ruleId);
    return true;
  }

  @Mutation(() => Boolean)
  async sendPstnDtmf(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('digits') digits: string,
  ): Promise<boolean> {
    await this.telephonyService.sendDtmf(user.id, callId, digits);
    return true;
  }

  @Mutation(() => VoicemailMessageGql)
  async markVoicemailRead(
    @CurrentUser() user: AuthorizationSubject,
    @Args('voicemailId', { type: () => ID }) voicemailId: string,
  ): Promise<VoicemailMessageGql> {
    const vm = await this.voicemailService.markAsRead(user.id, voicemailId);
    return vm as unknown as VoicemailMessageGql;
  }

  @Mutation(() => VoicemailMessageGql)
  async archiveVoicemail(
    @CurrentUser() user: AuthorizationSubject,
    @Args('voicemailId', { type: () => ID }) voicemailId: string,
  ): Promise<VoicemailMessageGql> {
    const vm = await this.voicemailService.archiveVoicemail(user.id, voicemailId);
    return vm as unknown as VoicemailMessageGql;
  }
}
