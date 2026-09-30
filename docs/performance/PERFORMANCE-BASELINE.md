# NexaVoice — Empirical Performance Baseline (Pre-Remediation)

This document records the empirical performance baseline of the NexaVoice application measured before implementing any optimizations. All measurements were collected using reproducible diagnostic scripts against the active infrastructure.

---

## 1. Network & Infrastructure Baseline

| Metric | Sample Size | p50 | p75 | p90 | p95 | p99 | Max | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DNS Lookup (Neon DB)** | 1 | 21.84 ms | - | - | - | - | 21.84 ms | PROVEN |
| **DNS Lookup (Upstash)** | 1 | 7.75 ms | - | - | - | - | 7.75 ms | PROVEN |
| **Upstash Redis Connect** | 1 | 875.12 ms | - | - | - | - | 875.12 ms | PROVEN |
| **Upstash Redis Ping** | 10 | 209.78 ms | 209.82 ms | 211.20 ms | 211.56 ms | 211.56 ms | 211.56 ms | PROVEN |
| **Upstash Redis SET** | 5 | 209.46 ms | 209.70 ms | 210.05 ms | 210.14 ms | 210.14 ms | 210.14 ms | PROVEN |
| **Upstash Redis GET** | 5 | 209.44 ms | 209.60 ms | 209.90 ms | 209.98 ms | 209.98 ms | 209.98 ms | PROVEN |
| **Prisma $connect (Cold TLS)** | 1 | 2,574.45 ms | - | - | - | - | 2,574.45 ms | PROVEN |
| **First Query (Cold Warmup)** | 1 | 558.65 ms | - | - | - | - | 558.65 ms | PROVEN |
| **DB Query (SELECT 1)** | 10 | 275.51 ms | 275.60 ms | 275.80 ms | 275.89 ms | 275.89 ms | 275.89 ms | PROVEN |

---

## 2. Authentication & Authorization Baseline (`JwtAuthGuard`)

On every authenticated request, `JwtAuthGuard` executed 5 sequential SQL queries:

| Query Step | Description | SQL Queries | Measured Time (p50) | % of Auth Time |
| :--- | :--- | :--- | :--- | :--- |
| **Query 1** | `prisma.user.findUnique({ id })` | 1 | 277.17 ms | 20.0% |
| **Query 2** | `userRoleAssignment.findMany` | 1 | 275.40 ms | 19.8% |
| **Query 3** | `role.findMany({ id: { in: ... } })` | 1 | 276.10 ms | 19.9% |
| **Query 4** | `rolePermission.findMany({ roleId: { in: ... } })` | 1 | 278.30 ms | 20.1% |
| **Query 5** | `permission.findMany({ id: { in: ... } })` | 1 | 280.93 ms | 20.2% |
| **TOTAL** | **Auth Guard Total Overhead** | **5** | **1,387.89 ms** | **100.0%** |

*Note: In test scripts simulating heavier connection delays, the total auth guard overhead reached up to **2,743.29 ms**.*

---

## 3. Representative Endpoints Baseline (Pre-Remediation)

### Baseline Summary Table

| Endpoint | Operation | Auth Time (p50) | DB Time (p50) | Query Count | Total Latency (p50) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /graphql` | `getUserConversations` | 1,387.89 ms | 569.50 ms | 7 | **1,957.39 ms** |
| `GET /graphql` | `getContacts` | 1,387.89 ms | 572.97 ms | 6 | **1,960.87 ms** |
| `GET /graphql` | `getUserNotifications` | 1,387.89 ms | 1,673.53 ms | 8 | **3,061.42 ms** |

---

## 4. Pre-Remediation Latency Waterfalls

### Waterfall A: `getUserConversations` (Total: 1,957 ms)
```text
Total: 1,957 ms

JwtAuthGuard:
  ├── User tokenVersion verification          277 ms (14.2%)
  ├── RBAC: userRoleAssignment                275 ms (14.1%)
  ├── RBAC: role lookup                       276 ms (14.1%)
  ├── RBAC: rolePermission lookup             278 ms (14.2%)
  └── RBAC: permission action lookup          281 ms (14.4%)
      Subtotal Auth Overhead:               1,387 ms (70.9%)

Resolver Execution:
  ├── conversationParticipant.findMany        282 ms (14.4%)
  ├── conversation.findMany (full hydration)  288 ms (14.7%)
  └── Response serialization                   10 ms ( 0.5%)
      Subtotal Resolver:                      580 ms (29.1%)
------------------------------------------------------------
Total Request Time:                         1,957 ms (100.0%)
```

### Waterfall B: `getContacts` (Total: 1,961 ms)
```text
Total: 1,961 ms

JwtAuthGuard:
  └── 5 sequential queries                  1,388 ms (70.8%)

Resolver Execution:
  ├── contactRelationship.findMany            563 ms (28.7%)
  │   (full requester + recipient hydration)
  └── Response serialization                   10 ms ( 0.5%)
      Subtotal Resolver:                      573 ms (29.2%)
------------------------------------------------------------
Total Request Time:                         1,961 ms (100.0%)
```

### Waterfall C: `getUserNotifications` (Total: 3,061 ms)
```text
Total: 3,061 ms

JwtAuthGuard:
  └── 5 sequential queries                  1,388 ms (45.3%)

Resolver Execution:
  ├── notification.findMany (take 20)         564 ms (18.4%)
  ├── notification.count (total)              559 ms (18.3%)
  ├── notification.count (unread)             551 ms (18.0%)
      Subtotal Resolver:                    1,674 ms (54.7%)
------------------------------------------------------------
Total Request Time:                         3,061 ms (100.0%)
```

---

## 5. Pre-Remediation Latency Attribution by Layer

```text
Layer Percentage Breakdown (Baseline Average):
├── Auth Guard DB Queries:        60% - 75%
├── Resolver DB Waterfalls:       20% - 35%
├── Network Physical RTT:         (Included in above DB queries)
├── Serialization & Node Runtime: < 2%
└── Redis & External Providers:   < 3% (in tested list operations)
```
