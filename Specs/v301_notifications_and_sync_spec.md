# Sara-Arch v301 — Notifications / Alerts + PWA Background Sync

> **Status:** Spec approved  
> **Target version:** v301  
> **Scope:** In-app notification system + offline mutation queue  
> **Out of scope:** Inventory, invoicing, purchase orders, document attachments, email delivery (Resend integration is pending the actual API key).

---

## 1. Goal

Give users timely awareness of overdue client balances, task deadlines, and contract milestones without adding email complexity, and make the app usable in intermittent-connectivity environments by queuing mutations for replay.

---

## 2. Notifications / Alerts

### 2.1 Data Model

```text
notifications
├── id UUID PK
├── user_id UUID FK -> profiles(id)        -- recipient
├── tenant_id UUID FK -> tenants(id)
├── type TEXT                              -- overdue_client, task_deadline, contract_milestone
├── title TEXT
├── message TEXT
├── link TEXT                              -- optional deep-link, e.g. #/clients?id=...
├── severity TEXT                          -- info | warning | danger
├── is_read BOOLEAN DEFAULT false
├── archived BOOLEAN DEFAULT false
├── related_table TEXT                     -- e.g. clients, tasks
├── related_id UUID
├── created_at TIMESTAMPTZ DEFAULT NOW()
└── updated_at TIMESTAMPTZ DEFAULT NOW()

notification_rules (per-tenant config)
├── tenant_id UUID PK FK -> tenants(id)
├── overdue_client_days INT DEFAULT 7
├── task_deadline_days INT DEFAULT 1
├── contract_milestone_days INT DEFAULT 7
├── enabled_types TEXT[] DEFAULT '{overdue_client,task_deadline,contract_milestone}'
└── updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.2 Generation Rules

| Type | Trigger | Frequency |
|------|---------|-----------|
| `overdue_client` | Client balance > 0 and last project-deposit date older than `overdue_client_days` | Daily via cron or on balance-changing transaction |
| `task_deadline` | Task due date within `task_deadline_days` and status != done | Daily via cron |
| `contract_milestone` | Project milestone/contract date within `contract_milestone_days` | Daily via cron |

Generator function: `generate_notifications(p_tenant_id UUID)` — idempotent; only inserts if no unread notification of the same type/table/id already exists for the user.

### 2.3 UI

1. **Header bell icon** with unread count badge.
2. **Dropdown** on bell click:
   - Group: Unread (top) / Read (bottom).
   - Each row: icon by severity, title, message (truncated), relative time, mark-read button.
   - Click row → navigate to `link` and mark read.
3. **Full history screen** `#/notifications`:
   - Tabs: All / Unread / Archived.
   - Search by title/message.
   - Bulk actions: Mark all read, Archive selected.

### 2.4 RBAC & RLS

- New screen permission: `notifications` (view, archive).
- RLS: `SELECT` only rows where `user_id = auth.uid()` and tenant matches.
- Admins can view all tenant notifications via a service/admin view if needed.

### 2.5 Migration

`migration_v301_notifications.sql`:
- Create `notifications` and `notification_rules` tables.
- Add indexes on `(user_id, is_read)`, `(tenant_id, created_at)`, `(related_table, related_id)`.
- Create `generate_notifications(UUID)` function.
- Add `update_updated_at` trigger.
- Seed default rules for existing tenants.
- Add RLS policies.

---

## 3. PWA Background Sync Queue

### 3.1 Flow

```text
User action (save/delete)
        │
        ▼
App calls API.request()
        │
        ▼
Network available? ──Yes──► normal fetch
        │
       No
        ▼
SW intercepts fetch error
        ▼
Serialize request (url, method, headers, body, timestamp)
        ▼
Store in IndexedDB table `syncQueue`
        ▼
Show toast: "سيتم المزامنة عند استعادة الاتصال"
        │
        ▼
Connectivity restored
        ▼
SW fires `sync` event (or app polls)
        ▼
Replay queue in order, one at a time
        │
        ▼
Success ──► remove from queue, update lastSync time
Failure ──► keep in queue, surface toast with error
```

### 3.2 IndexedDB Schema

```text
syncQueue (object store)
├── id (auto-increment)
├── url TEXT
├── method TEXT
├── headers JSON
├── body JSON
├── table TEXT              -- for UI grouping
├── description TEXT        -- Arabic action label for the UI
├── createdAt INT (ms)
├── attempts INT DEFAULT 0
└── lastError TEXT

syncMeta (object store)
├── key 'lastSync'
└── value TIMESTAMP
```

### 3.3 Service Worker Changes

- Add `sync` event listener.
- Add `fetch` handler to catch `API.request` failures and queue them.
- Avoid queuing idempotent reads (`GET`) — only `POST`/`PATCH`/`DELETE`.
- Preserve `Authorization` header from original request.

### 3.4 UI Indicator

- Add a small sync status widget in the header/footer:
  - Green cloud icon when synced.
  - Pending count + amber icon when `syncQueue` has items.
  - Last sync time (e.g. "تمت المزامنة ١٤:٣٠").
- Clicking indicator opens a "Pending actions" modal listing queued items with retry/remove options.

### 3.5 Conflict Handling

- 409 / unique conflict → toast with specific error, keep item in queue for manual review.
- 401 / auth expired → stop replay, prompt re-login.
- 5xx → retry with exponential backoff (max 3 attempts), then stop and notify.

---

## 4. Testing

### Unit Tests
- Notification generator creates exactly one notification per trigger condition.
- RLS helper allows only own notifications.
- Sync queue serializer preserves body/headers.

### E2E Tests
- Create an overdue client balance, run generator, assert bell badge shows 1.
- Mark notification read, assert badge disappears.
- Simulate offline, save a transaction, go online, assert transaction appears after replay.

---

## 5. Files to Touch

| File | Change |
|------|--------|
| `migration_v301_notifications.sql` | New schema + functions + RLS |
| `schema_full_fix.sql` | Add notifications tables and sync-ready service worker |
| `sw.js` | Add fetch queue + sync replay logic |
| `js/app-core.js` | Add notification bell, sync indicator, `#/notifications` route |
| `js/app-loaders.js` | Add `loadNotifications()` |
| `js/crud.js` | Ensure `API.request` failures are catchable by SW; no custom retry that hides errors |
| `js/ui.js` | Notification dropdown + pending-sync modal helpers |
| `tests/unit/notifications.test.js` | New |
| `tests/e2e/notifications.spec.js` | New |
| `tests/e2e/offline-sync.spec.js` | New |

---

## 6. Acceptance Criteria Summary

- [ ] `notifications` table and `generate_notifications()` function exist.
- [ ] Bell icon shows unread count; dropdown lists and marks notifications read.
- [ ] `#/notifications` screen supports history and archive.
- [ ] Offline save queues a mutation in IndexedDB.
- [ ] Online restore replays queued mutations in order.
- [ ] Conflicts/failures surface actionable toasts.
- [ ] `npm run health` passes (lint + 48+ unit tests + 0 audit).
