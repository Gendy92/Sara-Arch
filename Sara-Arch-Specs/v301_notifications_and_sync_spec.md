# Sara-Arch v301 — Notifications / Alerts + PWA Background Sync

> **Status:** Implemented  
> **Version:** v301.0.0  
> **Scope:** In-app notification system + offline mutation queue  
> **Out of scope:** Inventory, invoicing, purchase orders, document attachments. Resend email integration is configured via `app_settings` (see `docs/SECURITY_RUNBOOK.md` §7).

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
├── tenant_id UUID
├── type TEXT CHECK('overdue_client','task_deadline','contract_milestone','system')
├── title TEXT
├── message TEXT
├── link TEXT                              -- deep-link, e.g. #/clients?id=...
├── severity TEXT DEFAULT 'info'           -- info | warning | danger
├── is_read BOOLEAN DEFAULT false
├── archived BOOLEAN DEFAULT false
├── related_table TEXT
├── related_id UUID
├── created_at TIMESTAMPTZ DEFAULT NOW()
└── updated_at TIMESTAMPTZ DEFAULT NOW()

notification_rules (per-tenant config)
├── tenant_id UUID PK FK -> tenants(id)
├── overdue_client_days INT DEFAULT 7
├── task_deadline_days INT DEFAULT 1
├── contract_milestone_days INT DEFAULT 7
├── enabled_types TEXT[] DEFAULT '{overdue_client,task_deadline,contract_milestone}'
├── created_at TIMESTAMPTZ DEFAULT NOW()
└── updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 2.2 Generation Rules

| Type | Trigger |
|------|---------|
| `overdue_client` | Client balance > 0 and last `project_deposit` date older than `overdue_client_days`. |
| `task_deadline` | Task due date within `task_deadline_days` and status != `done`. |
| `contract_milestone` | Project `end_date` within `contract_milestone_days` and status not `completed`/`cancelled`. |

Generator function: `generate_notifications(p_tenant_id UUID)` — idempotent; uses a partial unique index to avoid duplicate unread/active notifications for the same user, type, and related entity.

Recipients are resolved by joining `profiles` ↔ `user_tenants` on the target tenant.

### 2.3 UI

1. **Header bell icon** with unread count badge.
2. **Dropdown** on bell click:
   - Lists recent unread notifications.
   - Each row: title, message (truncated), timestamp, mark-read button.
   - Clicking **عرض الكل** navigates to `#/notifications`.
3. **Full history screen** `#/notifications`:
   - Filters: All / Unread / Archived.
   - Actions per row: mark read, archive, open link.
   - Bulk action: **تحديد الكل كمقروء**.

### 2.4 RBAC & RLS

- New screen permission: `notifications` (view, archive, mark read).
- `notifications` RLS: users can only see rows where `user_id = auth.uid()`.
- `notification_rules` RLS: scoped to the current tenant via `get_current_tenant_id()`.

### 2.5 Migration

`migration_v301_notifications.sql`:
- Creates `notifications` and `notification_rules` tables.
- Adds indexes on `(user_id, is_read, created_at)`, `(tenant_id, created_at)`, `(related_table, related_id)`, and a partial unique index for active duplicates.
- Creates `generate_notifications(UUID)` function.
- Adds `update_updated_at` triggers.
- Seeds default rules for existing tenants.
- Enables RLS and adds policies.
- Embeds the v300 custody trigger catch-up so the CI runner applies it with v301.

---

## 3. PWA Background Sync Queue

### 3.1 Modules

- `js/sync.js` — `SyncManager` namespace:
  - `init()` — opens IndexedDB (`sara-sync`).
  - `enqueue({ url, method, body, headers, description })` — stores failed mutations.
  - `list()`, `remove(id)`, `pendingCount()` — UI helpers.
  - `replay()` — re-issues queued `POST`/`PATCH`/`DELETE` requests via `API.request` when online.
  - `getLastSync()` / `setLastSync()` — persists/reads the last successful sync timestamp.
  - `startListening()` — listens for `online`/`offline` and broadcasts state to the service worker.

- `js/notification-service.js` — `NotificationService`:
  - Wraps browser `Notification` permission requests.
  - Falls back to `UI.toast()` when permission is denied or unsupported.

### 3.2 IndexedDB Schema

```text
sara_sync_queue (object store, auto-increment key)
├── id INT
├── url TEXT
├── method TEXT
├── headers JSON
├── body JSON
├── description TEXT        -- Arabic action label for the UI
├── createdAt INT (ms)
├── attempts INT DEFAULT 0
└── lastError TEXT

sara_sync_meta (object store, keyPath = 'key')
├── key TEXT                -- e.g. 'lastSync'
└── value ANY
```

### 3.3 Service Worker Changes

`sw.js`:
- Cache key bumped to `sara-arch-v301`.
- Listens for the `sync` event with tag `sara-sync` and calls `SyncManager.replay()` via `postMessage`.

### 3.4 UI Indicator

- Sync status widget in the header:
  - Green cloud icon + “تمت المزامنة” when empty.
  - Amber icon + pending count when queue has items.
  - Last sync time shown on hover/click.
- Clicking opens a modal listing pending actions with retry/remove options.

### 3.5 Conflict Handling

- `409` / unique conflict → surfaces the API error and leaves the item in the queue for review.
- `401` / auth expired → stops replay; user must re-login.
- `5xx` / network error → retries with exponential backoff, then stops and surfaces a toast.

---

## 4. Testing

### Unit Tests

- `tests/unit/sync.test.js` (5 tests):
  - `init`, `enqueue/list`, `remove`, `pendingCount`, `setLastSync/getLastSync`.
- All health checks pass: **53/53 unit tests**, **0 ESLint warnings**, **0 npm audit vulnerabilities**.

### E2E Tests

- Specs planned but not yet executed; require staging Supabase credentials + `tests/e2e/setup/seed.sql`.
- Scenarios:
  - Create overdue client balance → run generator → assert bell badge shows 1.
  - Mark notification read → assert badge disappears.
  - Simulate offline → save a mutation → go online → assert sync indicator clears.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `migration_v301_notifications.sql` | Notifications schema, generator, RLS, v300 custody trigger catch-up |
| `migration_v300_custody_triggers_fix.sql` | Standalone production patch for custody triggers |
| `schema_full_fix.sql` | v301 schema + generator fix using `user_tenants` join |
| `sw.js` | v301 cache key + `sync` event listener |
| `index.html` | Loads `sync.js` and `notification-service.js`; v301 query param |
| `css/style.css` | Notification bell/dropdown and sync indicator styles |
| `js/app-core.js` | Bell, dropdown, notifications screen, sync indicator, background sync registration |
| `js/app-loaders.js` | `loadNotifications()` |
| `js/auth.js` | Adds `notifications` to RBAC permission map |
| `js/sync.js` | New — IndexedDB queue, replay, conflict handling |
| `js/notification-service.js` | New — browser notification helper / toast fallback |
| `version.json` / `package.json` / `package-lock.json` | Bumped to v301.0.0 |
| `tests/unit/sync.test.js` | New — IndexedDB mock tests |
| `tests/e2e/setup/seed.sql` | Added `e2e_seed_tenant()` + expanded cleanup |
| `tests/e2e/setup/global-setup.js` | Calls `e2e_seed_tenant()` |
| `playwright.config.js` | Supports `E2E_BASE_URL` for deployed previews |
| `docs/production-v301-deploy.md` | New — production rollout runbook |
| `docs/SECURITY_RUNBOOK.md` | Resend config, branch protection, v301 checklist |
| `MIGRATIONS.md` / `ACTION_PLAN.md` | Migration log and plan updated |

---

## 6. Acceptance Criteria Summary

- [x] `notifications` table, `notification_rules` table, and `generate_notifications()` function exist.
- [x] Bell icon shows unread count; dropdown lists notifications and supports mark-read.
- [x] `#/notifications` screen supports All / Unread / Archived filters and archive action.
- [x] Offline save queues a mutation in IndexedDB.
- [x] Online restore replays queued mutations in order and updates the last-sync timestamp.
- [x] Conflicts/failures surface actionable toasts.
- [x] `npm run health` passes (lint + 53 unit tests + 0 audit).
