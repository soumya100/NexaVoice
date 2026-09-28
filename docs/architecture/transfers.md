# NexaVoice Call Transfers Architecture

## Overview
NexaVoice supports two primary transfer paradigms: **Blind Transfers** and **Attended (Consultative) Transfers**.

## 1. Blind Transfer
- **Workflow**:
  1. The transferring party initiates `blindTransfer(callId, targetUserId)`.
  2. The server verifies caller authorization (`CALL_CREATE` / `CALL_TRANSFER`).
  3. A `CallTransfer` entity is recorded in state `INITIATED` with type `BLIND`.
  4. An inbound `CallLeg` is provisioned for `targetUserId`.
  5. The target user receives a realtime `call.incoming` event indicating `isTransfer: true` and caller metadata.
  6. The transferring party's leg is terminated and they exit the call.
  7. The remaining participant hears music on hold / ringing until the target answers.
  8. Once the target answers, the `CallTransfer` transitions to `COMPLETED`.

## 2. Attended Transfer
- **Workflow**:
  1. Transferor places original caller on hold (`holdCall`).
  2. Transferor initiates consultation call with target (`initiateAttendedTransfer`), which creates a child session referencing `parentCallSessionId: originalCallId`.
  3. Transferor speaks with target user to explain context.
  4. Transferor executes `completeAttendedTransfer(transferCallId)`:
     - Target's leg is bridged into the original `CallSession`.
     - Transferor leaves both calls.
     - Consultation call is ended with reason `ATTENDED_TRANSFER_COMPLETED`.
  5. Alternatively, transferor can `cancelAttendedTransfer`:
     - Consultation call is terminated.
     - Transferor resumes the held original call (`resumeCall`).
