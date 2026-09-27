# NexaVoice — Complete Authorization & Capability Matrix

This matrix defines the authoritative access control rules enforced across NexaVoice services, GraphQL resolvers, and WebSocket gateways.

## Legend
* **RBAC Permission**: The required granular permission string (`<domain>.<action>`).
* **Roles Granted By Default**: Baseline system roles possessing this capability.
* **Contextual / Resource Condition**: Dynamic ABAC rules evaluated at runtime by `AuthorizationDecisionService`.
* **AI Delegation**: Whether an AI assistant may execute this capability and whether human confirmation is mandated.
* **Security Audit**: Whether an immutable `SecurityEvent` audit record is persisted.

---

| Resource | Action | Required Permission | Baseline Roles | Runtime ABAC Condition | AI Allowed? | Requires Human Confirmation? | Audit Required? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Identity** | Read Profile | `identity.read` | `USER`, `SUPPORT_AGENT`, `SYSTEM_ADMIN` | Target user account is active, or requester is target user | Yes | No | No |
| **User Identity** | Update Profile | `identity.update` | `USER`, `SYSTEM_ADMIN` | Requester is resource owner (`subject.id === resource.ownerId`) | No | N/A | Yes |
| **User Identity** | Assign Roles | `security.manage_sessions` | `SECURITY_ADMIN`, `SYSTEM_ADMIN` | Requester cannot assign roles higher than their own hierarchy | No | N/A | Yes |
| **Session** | View Active Sessions | `security.manage_sessions` | `USER`, `SECURITY_ADMIN`, `SYSTEM_ADMIN` | Requester is session owner (`subject.id === session.userId`) | No | N/A | No |
| **Session** | Revoke Session | `security.manage_sessions` | `USER`, `SECURITY_ADMIN`, `SYSTEM_ADMIN` | Requester is session owner or Security Admin | No | N/A | Yes |
| **Session** | Refresh Token | *N/A (Cryptographic)* | *Public with Valid Refresh Token* | Token hash matches active session; zero reuse detected | No | N/A | Yes |
| **Contact** | Read Contacts | `contact.read` | `USER`, `SYSTEM_ADMIN` | Requester is contact list owner | Yes | No | No |
| **Contact** | Add / Block Contact | `contact.manage` | `USER`, `SYSTEM_ADMIN` | Requester is contact list owner | No | N/A | Yes |
| **Conversation** | Read Messages | `conversation.read` | `USER`, `SYSTEM_ADMIN` | Requester is active conversation participant | Yes | No | No |
| **Conversation** | Create Conversation | `conversation.write` | `USER`, `SYSTEM_ADMIN` | Account state is `ACTIVE` | Yes | No | No |
| **Conversation** | Delete Conversation | `conversation.delete` | `COMMUNITY_ADMIN`, `SYSTEM_ADMIN` | Requester is creator, community admin, or system admin | No | N/A | Yes |
| **Message** | Send Message | `message.send` | `USER`, `SYSTEM_ADMIN` | Requester is participant in conversation and not muted | Yes | No | No |
| **Message** | Edit Message | `message.edit` | `USER`, `SYSTEM_ADMIN` | Requester is message author (`subject.id === message.senderId`) | No | N/A | Yes |
| **Message** | Delete Message | `message.delete` | `USER`, `MODERATOR`, `COMMUNITY_ADMIN`, `SYSTEM_ADMIN` | Author can delete anytime; Moderator can delete within assigned channel | No | N/A | Yes |
| **Call Session** | Join Call | `call.join` | `USER`, `SYSTEM_ADMIN` | Call session state is active and requester is invited or participant | Yes | No | No |
| **Call Session** | Invite Participant | `call.invite` | `USER`, `ROOM_HOST`, `SYSTEM_ADMIN` | Call session capacity not exceeded; requester is participant | Yes | No | No |
| **Call Session** | Remove Participant | `call.remove_participant` | `ROOM_HOST`, `MODERATOR`, `SYSTEM_ADMIN` | Requester is call host (`context.isHost === true`) or moderator | No | N/A | Yes |
| **Call Session** | Mute Participant | `call.mute_participant` | `ROOM_HOST`, `MODERATOR`, `SYSTEM_ADMIN` | Requester is call host or moderator | No | N/A | Yes |
| **Call Session** | End Call | `call.end` | `USER`, `ROOM_HOST`, `SYSTEM_ADMIN` | Host can end call for all; participant can leave individual leg | Yes | Yes (if terminating for all) | Yes |
| **Recording** | Start Recording | `recording.start` | `USER`, `ROOM_HOST`, `SYSTEM_ADMIN` | All participants have granted jurisdiction-aware consent | No | N/A | Yes |
| **Recording** | Stop Recording | `recording.stop` | `USER`, `ROOM_HOST`, `SYSTEM_ADMIN` | Requester is call host or recording initiator | No | N/A | Yes |
| **Recording** | Delete Recording | `recording.delete` | `USER`, `SYSTEM_ADMIN` | Requester is owner and `resource.legalHold === false` | No | N/A | Yes |
| **AI Assistant** | Listen to Audio | `ai.listen` | `USER`, `SYSTEM_ADMIN` | AI capability explicitly granted in AIProfile; consent active | Yes | No | Yes |
| **AI Assistant** | Speak in Call | `ai.speak` | `USER`, `SYSTEM_ADMIN` | AI capability explicitly granted; visible avatar indicator active | Yes | No | Yes |
| **AI Assistant** | Make Outbound Call | `ai.make_call` | `USER`, `SYSTEM_ADMIN` | High-impact action; mandates explicit human approval | Yes | **YES (MANDATORY)** | Yes |
| **AI Assistant** | Transfer Call | `ai.transfer_call` | `USER`, `SYSTEM_ADMIN` | High-impact action; mandates explicit human approval | Yes | **YES (MANDATORY)** | Yes |
| **Security** | View Audit Logs | `security.view_audit` | `SECURITY_ADMIN`, `SYSTEM_ADMIN` | Requester can only view tenant-scoped logs unless System Admin | No | N/A | Yes |
