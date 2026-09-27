# NexaVoice Privacy — Contact Discovery & Address Book Synchronization

## 1. Principles of Privacy-First Discovery

In global communication networks, contact discovery is often abused for user enumeration, identity correlation, and unsolicited spam. NexaVoice implements **Zero-Knowledge / Privacy-Preserving Discovery** principles:

1. **Explicit Consent**: Address book synchronization is strictly opt-in and revocable.
2. **No Raw Address Book Storage**: The platform never stores uploaded address books, phone directories, or unhashed personal identifiers.
3. **User-Controlled Discovery Boundaries**: Every user can independently govern their visibility.

---

## 2. User Privacy Settings Matrix

Each user possesses a dedicated `UserPrivacySettings` entity configurable via GraphQL:

| Setting Key | Default | Description |
|:---|:---|:---|
| `discoverableByUsername` | `true` | Allows user search via public handle `@username` |
| `discoverableByNexaVoiceId` | `true` | Allows search via canonical ID `NV-XXXX-XXXX` |
| `discoverableByEmail` | `false` | When false, email queries never return this account |
| `discoverableByPhone` | `false` | When false, phone queries never return this account |
| `whoCanMessageMe` | `EVERYONE` | `EVERYONE`, `CONTACTS_ONLY`, or `NOBODY` |
| `whoCanAddMeToGroups` | `EVERYONE` | `EVERYONE`, `CONTACTS_ONLY`, or `NOBODY` |
| `readReceiptsEnabled` | `true` | Controls whether read receipts are published |
| `typingIndicatorsEnabled` | `true` | Controls whether typing indicators are broadcast |

---

## 3. Privacy-Preserving Address Book Synchronization

```
Client Device
   │
   ├─► 1. Normalizes local phone numbers (E.164: +12125550199) and emails (lowercase)
   ├─► 2. Computes SHA-256 hash for each entry
   │
Client ──► Mutation: syncAddressBook(entries: [{ identifierHash }]) ──► NexaVoice API
                                                                             │
                                                                             ├─► Filters registered users who explicitly
                                                                             │   enabled discoverableByPhone or Email
                                                                             │
                                                                             ├─► Compares hashes against SHA-256 of opt-in users
                                                                             │
                                                                             └─► Returns matching NexaVoice accounts without
                                                                                 storing address book entries on server
```

### Protection Against Enumeration
* When a user searches for an email or phone number that has discovery disabled, the system responds identically to non-existent users, preventing malicious actors from determining account existence.
* Blocked users are filtered out prior to matching.
