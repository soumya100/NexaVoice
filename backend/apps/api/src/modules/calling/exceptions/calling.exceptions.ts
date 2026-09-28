import { HttpStatus } from '@nestjs/common';

export class CallingException extends Error {
  constructor(
    public override readonly message: string,
    public readonly statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code: string = 'CALLING_ERROR',
  ) {
    super(message);
    this.name = 'CallingException';
  }
}

export class InvalidCallStateTransitionException extends CallingException {
  constructor(
    public readonly entityType:
      | 'CallSession'
      | 'CallLeg'
      | 'CallParticipant'
      | 'MediaSession'
      | 'CallInvitation'
      | 'CallParticipantWaitingRoom'
      | 'CallDeviceTransfer'
      | 'RecordingSession'
      | 'ScheduledCall',
    public readonly entityId: string,
    public readonly fromState: string,
    public readonly toState: string,
    public readonly reason?: string,
  ) {
    super(
      `Invalid state transition for ${entityType} [${entityId}]: cannot transition from '${fromState}' to '${toState}'.${reason ? ` Reason: ${reason}` : ''}`,
      HttpStatus.CONFLICT,
      'INVALID_STATE_TRANSITION',
    );
    this.name = 'InvalidCallStateTransitionException';
  }
}

export class CallNotFoundException extends CallingException {
  constructor(callId: string) {
    super(`Call session '${callId}' not found`, HttpStatus.NOT_FOUND, 'CALL_NOT_FOUND');
    this.name = 'CallNotFoundException';
  }
}

export class CallAuthorizationException extends CallingException {
  constructor(message: string, code = 'CALL_ACCESS_DENIED') {
    super(message, HttpStatus.FORBIDDEN, code);
    this.name = 'CallAuthorizationException';
  }
}

export class CallParticipantLimitExceededException extends CallingException {
  constructor(maxLimit: number, currentCount: number) {
    super(
      `Call participant limit exceeded: max allowed is ${maxLimit}, current active count is ${currentCount}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'CALL_PARTICIPANT_LIMIT_EXCEEDED',
    );
    this.name = 'CallParticipantLimitExceededException';
  }
}
