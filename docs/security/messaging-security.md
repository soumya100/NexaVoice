# NexaVoice Security — Messaging & Media Security

## 1. Threat Model & Security Perimeter

The NexaVoice Messaging subsystem defends against standard and distributed messaging vulnerabilities, including Insecure Direct Object References (IDOR/BOLA), Server-Side Request Forgery (SSRF), content enumeration, archive/compression bombs, and malicious file upload vectors.

---

## 2. Server-Side Request Forgery (SSRF) Defense in Link Previews

Link previews allow rich snippet previews when URLs are mentioned in messages. However, naive server-side scrapers are vulnerable to SSRF attacks targeting internal cloud metadata endpoints (e.g., `169.254.169.254`) or VPC internal services (`10.0.0.0/8`, `192.168.0.0/16`, `127.0.0.1`).

### Implemented Defenses (`LinkPreviewService`)
1. **Pre-Request DNS Resolution**: The hostname is resolved to an IPv4/IPv6 address *before* opening the HTTP socket.
2. **Private IP Rejection**: The resolved IP is inspected against standard private, loopback, and link-local ranges:
   * `127.0.0.0/8` (Loopback)
   * `10.0.0.0/8` (RFC 1918 Private)
   * `172.16.0.0/12` (RFC 1918 Private)
   * `192.168.0.0/16` (RFC 1918 Private)
   * `169.254.0.0/16` (Link-Local & Cloud Metadata Services)
   * `::1`, `fc00::/7`, `fe80::/10` (IPv6 Private/Local)
   * If the IP matches any restricted range, the request is immediately aborted and logged as `ssrf_blocked`.
3. **Response Stream Capping**: Data transfer is strictly terminated after 64KB to eliminate zip-bomb and memory-exhaustion exploits.
4. **Strict HTTP Timeouts**: Socket timeout is fixed at 3000ms.

---

## 3. Attachment Security & Signed URLs

Large binary media (voice recordings, PDF documents, images) are never stored as byte arrays in PostgreSQL.

```
Client -> Mutation: initAttachmentUpload(fileName, mimeType, sizeBytes)
   │
   ├─► 1. MIME Validation: Reject executable formats (.exe, .bat, .sh, .php, .js)
   ├─► 2. Size Validation: Enforce 25MB ceiling (50MB for voice)
   ├─► 3. Generate Object Key: attachments/{uploaderId}/{timestamp}-{randomHash}-{fileName}
   ├─► 4. Pre-Signed URL Generation with HMAC signature (15m expiry)
   │
Client <── Returns { attachmentId, uploadUrl, objectKey, expiresInSeconds: 900 }
```

### Key Security Guarantees:
* **No Public S3 Buckets**: Attachments are stored with private access control.
* **Signed Download URLs**: Downloads require pre-signed authentication tokens verifying user access to the parent message.
* **Malware Scanning Hook**: Database models include `AttachmentStatus` (`PENDING_SCAN`, `CLEAN`, `QUARANTINED`, `REJECTED`) allowing asynchronous Antivirus/Malware scanners (e.g. ClamAV) to quarantine infected objects before client retrieval.

---

## 4. IDOR / BOLA Prevention in Resource Authorization

Every operation evaluates authorization using `AuthorizationDecisionService` and the Milestone 2 policy engine:

* **Conversation Read**: Sockets and queries must verify active participant membership in the target conversation.
* **Message Editing**: Enforces strict resource ownership (`message.senderId === subject.id`).
* **Message Deletion**: Only the author OR conversation `OWNER`/`ADMIN` can soft-delete a message.
* **Cross-Conversation Reply Guard**: A reply must reference a message in the *same* conversation ID.

---

## 5. Blocking Architecture & Abuse Prevention

When User A blocks User B:
1. An atomic record is committed in `BlockedUser` (`@@unique([blockerId, blockedId])`).
2. Any active `ContactRelationship` is transitioned to `BLOCKED`.
3. Future contact requests, direct message sends, group additions, and call invites from User B to User A are rejected server-side with `403 Forbidden`.
4. Discovery queries from User B omit User A entirely, eliminating user enumeration.
