# NexaVoice — Authorization & Capability Specification

## 1. Multi-Tiered Access Control Model

NexaVoice separates coarse-grained role checks from fine-grained resource and contextual policies:

```
[Incoming Request]
       │
       ▼
1. Authentication Check (JwtAuthGuard)
       │
       ▼
2. Role Check (RolesGuard) -> Is user in required system roles?
       │
       ▼
3. Permission Check (PermissionsGuard) -> Does user hold granular capability?
       │
       ▼
4. Contextual & Resource Policy (AuthorizationDecisionService)
       ├── Ownership Validation (Can user edit/delete this specific resource?)
       ├── Membership Validation (Is user in this conversation or room?)
       ├── State Policy (Is resource deleted, locked, or under legal hold?)
       └── AI Safety Policy (Is this high-impact action approved by a human?)
```

---

## 2. Granular Permissions Taxonomy

All capabilities follow the `<domain>.<action>` format:

* **Identity & Profile**:
  * `identity.read`: Read user profile and presence state.
  * `identity.update`: Mutate profile metadata, display name, and avatar.
* **Messaging & Conversations**:
  * `conversation.read`: Access messages in conversations where participant.
  * `conversation.write`: Create new conversations or add participants.
  * `conversation.delete`: Terminate conversation (Admin / Creator only).
  * `message.send`: Post message to conversation.
  * `message.edit`: Edit message text (Author only).
  * `message.delete`: Delete message (Author or Channel Moderator).
* **Voice & Video Calling**:
  * `call.join`: Connect to call signaling channel.
  * `call.invite`: Add new participants to active call.
  * `call.remove_participant`: Eject participant (Call Host or Moderator only).
  * `call.mute_participant`: Force mute participant audio/video.
  * `call.end`: Terminate active call session.
* **Recording**:
  * `recording.start`: Initiate session recording with participant consent.
  * `recording.stop`: Terminate session recording.
  * `recording.delete`: Delete recording file (Owner only, blocked by legal hold).
* **AI Assistant Operations**:
  * `ai.read`: Query AI memory and assistant preferences.
  * `ai.configure`: Change AI avatar, voice model, and personality.
  * `ai.listen`: Permit AI to process audio during a call.
  * `ai.speak`: Permit AI to synthesize speech in a call.
  * `ai.make_call`: Initiate an autonomous outbound call (requires human approval).
  * `ai.transfer_call`: Bridge or transfer an active call leg (requires human approval).
* **Security & Administration**:
  * `security.view_audit`: Query security events and compliance audit logs.
  * `security.manage_sessions`: Revoke sessions and force logout.
