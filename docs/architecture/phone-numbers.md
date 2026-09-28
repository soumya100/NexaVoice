# Phone Number Lifecycle & DID Management

## State Machine

Phone number inventory follows a rigorous 9-state lifecycle:

```
  SEARCHING
      │
      ▼
   RESERVED ──(timeout/cancel)──► FAILED
      │
      ▼
  PROVISIONING ──(carrier error)──► FAILED
      │
      ▼
    ACTIVE ◄─────────────────────┐
      │                          │ (unassign)
      ▼ (assign)                 │
   ASSIGNED ─────────────────────┘
      │
      ▼ (admin suspend)
   SUSPENDED
      │
      ▼ (release request)
   RELEASING ──(active calls block)──► ACTIVE
      │
      ▼ (carrier confirmed)
   RELEASED
```

## State Transitions & Guards

1. **`PROVISIONING` -> `ACTIVE`**: Number successfully ordered and verified with carrier adapter.
2. **`ACTIVE` -> `ASSIGNED`**: Transactionally linked to a `User`, `Room`, `Team`, or `Organization`.
3. **`ASSIGNED` -> `ACTIVE`**: Unassigned back into the organization's unassigned pool.
4. **`ACTIVE` -> `RELEASING` -> `RELEASED`**:
   - **Active Call Guard**: Releasing a number is blocked if any `CallLeg` referencing the number is currently in an active or ringing state.
   - Preserves audit log history and usage records while marking the record `RELEASED`.

## Assignment Concurrency & Tenant Isolation

- Database unique index on `e164Number` prevents duplicate provisioning across the system.
- Number assignments are executed inside Prisma transactions with atomic checks to prevent race conditions where two administrators simultaneously assign the same DID.
