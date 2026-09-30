# NexaVoice — Performance Operations & SRE Runbook

## 1. Performance Budgets

Based on the empirical characteristics of our geographically distributed architecture (API server and database placement), the following realistic performance budgets are established:

| API Classification | Target (p50) | Target (p95) | Target (p99) | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Simple Authenticated Read (Cache Hit)** | **< 300 ms** | **< 600 ms** | **< 1,000 ms** | 1 DB query round trip (~275ms) + 0ms auth cache + serialization. |
| **Simple Authenticated Read (Cache Miss)**| **< 600 ms** | **< 1,200 ms** | **< 1,500 ms** | 1 cold SQL join query (~280ms) + 1 resolver query (~280ms). |
| **Complex Aggregation / List API** | **< 500 ms** | **< 800 ms** | **< 1,500 ms** | Parallel execution of list + aggregation query (e.g. notifications). |
| **GraphQL Composite Query** | **< 600 ms** | **< 1,000 ms** | **< 1,800 ms** | Resolves across 2 or 3 relations in parallel without waterfalls. |
| **Write / Mutation (Transaction)** | **< 400 ms** | **< 800 ms** | **< 1,500 ms** | Single transactional unit of work. |

*Note: In production deployments where API servers are co-located in the same AWS region (`us-east-2`) as Neon PostgreSQL and Upstash Redis, physical network RTT drops from ~275ms to **< 2ms**, reducing p50 latencies across all endpoints to **< 50ms**.*

---

## 2. Real-Time Telemetry & Header Inspection

NexaVoice now emits standard **W3C `Server-Timing`** headers and `X-Request-Id` on all responses:

### Example Response Headers
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: req-m8x9y-a1b2c
Server-Timing: total;dur=274.8, auth;dur=0.01, db;dur=274.2;desc="1 queries", redis;dur=0.0;desc="0 queries"
```

### Inspecting in Browser DevTools
1. Open Chrome DevTools → **Network** tab.
2. Click any API or `/graphql` request.
3. Scroll to the **Timing** tab.
4. The `Server-Timing` section visualizes server execution time broken down into `auth`, `db`, and `total`.

---

## 3. Slow Request Detection & Thresholds

* **Environment Variable**: `SLOW_REQUEST_THRESHOLD_MS=500`
* **Trigger Condition**: Any request where `totalDurationMs >= SLOW_REQUEST_THRESHOLD_MS` emits a structured warning log:

```json
{
  "timestamp": "2026-09-30T02:50:50.123Z",
  "level": "WARN",
  "context": "PerformanceTelemetry",
  "message": "SLOW API REQUEST DETECTED: [POST] /graphql took 782.4ms (threshold: 500ms)",
  "requestId": "req-m8x9y-a1b2c",
  "route": "/graphql",
  "operation": "getUserConversations",
  "method": "POST",
  "totalDurationMs": 782.4,
  "authDurationMs": 0.01,
  "databaseDurationMs": 781.9,
  "databaseQueryCount": 2,
  "redisDurationMs": 0,
  "redisQueryCount": 0
}
```

---

## 4. Operational Troubleshooting Playbook

### Scenario A: Sudden Spike in API Latency (> 1,500ms)
1. **Check `Server-Timing` or structured log `databaseQueryCount`**:
   * If `databaseQueryCount > 3`: A sequential query waterfall or N+1 query has been introduced into a resolver. Trace the resolver and combine queries into a single query or `Promise.all`.
   * If `databaseQueryCount` is normal (1-2) but `databaseDurationMs` is high: Check Neon database compute status.
2. **Check Neon PostgreSQL Compute Status**:
   * Inspect Neon Console (`console.neon.tech`).
   * Is the compute endpoint waking up from cold suspension? (Cold compute resume adds 2,000ms–3,000ms to the first connection).
   * Did connection count exceed pool limits?

### Scenario B: High Auth Duration (`authDurationMs > 500ms`)
1. **Check if cache miss rate spiked**:
   * Did a large number of users simultaneously log in?
   * Was `tokenVersion` bumped across the user base?
2. **Verify `subjectCache` health**:
   * Check memory usage of the API process. `subjectCache` is capped at 5,000 entries and self-evicts oldest entries.

### Scenario C: Redis Latency Spikes
1. **Check `redisDurationMs` in telemetry logs**:
   * If Redis commands take > 2,000ms, the built-in `commandTimeout: 2000` will fail open and log a warning without hanging the HTTP request.
2. **Inspect Upstash Console**:
   * Verify daily command quotas and throughput limits on Upstash dashboard.

---

## 5. Provider-Dependent Verification Checklist

The following items are infrastructure/provider-dependent and should be verified in the production environment:

* [ ] **Region Co-location**: Verify production API servers (e.g. ECS, Fly.io, Vercel, or Render) are deployed in AWS `us-east-2` (Ohio) to match the Neon PostgreSQL database.
* [ ] **Neon Connection Pooling**: Verify production `DATABASE_URL` uses the pooled endpoint `-pooler` (`ep-twilight-cloud-b5m691dw-pooler.c-7.us-east-2.aws.neon.tech`) with `?connection_limit=10&pool_timeout=20`.
* [ ] **Compute Autoscaling Suspend Timeout**: Set Neon compute auto-suspend delay to at least 5-10 minutes to prevent cold-starts during normal traffic lulls.
* [ ] **Upstash Multi-Region / Replication**: If API instances are distributed across multiple global edge locations, enable Upstash Global Replication.

---

## 6. Regression Prevention

To ensure performance optimizations are not accidentally undone in future code changes:
1. **Never use `user: true`** in relational queries. Always use explicit `select: { id: true, nexaVoiceId: true, username: true, displayName: true, avatarUrl: true }`.
2. **Never issue sequential queries** when queries can be resolved via relation filters (e.g. `participants: { some: { userId } }`) or `Promise.all`.
3. **Never query without pagination**: List endpoints must require `take` and `skip` (or cursor pagination).
4. **Run `npm run test` and `npx ts-node scripts/benchmark-remediation.ts`** before merging PRs affecting database access or authentication.
