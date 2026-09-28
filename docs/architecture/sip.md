# SIP Architecture & Trunking

## Overview

Session Initiation Protocol (SIP) integration enables enterprise PBX connectivity, direct IP trunking, and softphone integration.

## SIP Model

The SIP trunking model is represented via the `SipTrunk` entity in the database:
- `provider`: Carrier providing the trunk (Twilio Elastic SIP Trunking, Telnyx SIP Trunking, Asterisk/FreeSWITCH Gateway).
- `domainName` / `host`: Fully Qualified Domain Name (FQDN) or IP gateway for SIP termination.
- `authMode`: Authentication mechanism (`IP_ACL` or `CREDENTIAL`).
- `transport`: Transport layer protocol (`TLS`, `TCP`, `UDP`).
- `sipUsername` / `sipPasswordHash`: Stored as secure hashes or secret references; plaintext credentials are never stored or exposed.
- `region`: Geographical region for media relay (e.g., `us-east-1`, `eu-west-1`).
- `status`: Lifecycle status (`ACTIVE`, `INACTIVE`, `TESTING`, `FAILED`).

## Signaling vs. Media Separation

SIP messages (INVITE, 180 Ringing, 200 OK, BYE, CANCEL, OPTIONS) are handled at the carrier / SBC (Session Border Controller) gateway layer. The application layer consumes normalized telephony events rather than raw RFC 3261 text:

```
[Carrier SIP Gateway / SBC]
          │
          │ Normalized Webhook / REST Events
          ▼
[TelephonyWebhookController]
          │
          ▼
[TelephonyService / CallStateMachine]
          │
          ▼
[Unified CallSession / CallLeg Domain]
```

## Security & Toll Fraud Protection

- Inbound SIP invites outside registered trunk IP allowlists or valid carrier credentials are automatically rejected.
- Outbound SIP dialing is subjected to the same `TollFraudProtectionService` policy enforcement as PSTN calls (allowed country codes, premium destination blocks, concurrent call limits).
