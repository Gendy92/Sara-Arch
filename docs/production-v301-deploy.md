# Production Deploy Runbook — v301

This runbook covers the safe production rollout of **v301 — Notifications / Alerts + PWA Background Sync**.

## Prerequisites

- [ ] `npm run health` passes on the commit you are deploying (53/53 unit tests, 0 lint warnings, 0 npm audit vulnerabilities).
- [ ] The v300 custody trigger patch has been applied (see Step 1 below).
- [ ] A fresh Supabase backup has completed (GitHub Actions **Daily Database Backup**).
- [ ] You have owner/admin access to the GitHub repo, Supabase project, and Resend account.

---

## Step 1 — Apply the v300 custody trigger fix

v301 notifications are unrelated to custody, but the `migration_v301_notifications.sql` file also carries the missing v300 custody trigger catch-up so the CI runner applies it automatically. If you prefer to apply the fix manually before the front-end deploy, run this script in the Supabase SQL Editor:

```text
migration_v300_custody_triggers_fix.sql
```

What it does:
- Adds the `pg_trigger_depth()` recursion guard to `custody_records_state_trigger()`.
- Creates the missing `custody_expenses_state_t` trigger so custody totals stay in sync when expenses change.
- Creates/refreshs the `custody_expense_limit_t` and `custody_return_limit_t` triggers.
- Backfills `remaining_balance`, `returned_amount`, and `status` for all existing `custody_records`.

Run this only **once** per environment. It is idempotent.

---

## Step 2 — Deploy v301 front-end and migrations

### Option A — CI auto-migration (preferred after v264 runner is active)

1. Merge the v301 PR to `main`.
2. The **Pages deploy** workflow will:
   - Build and deploy the static site to GitHub Pages.
   - Run `scripts/run-migrations.js`, which will apply `migration_v301_notifications.sql`.
3. Verify the workflow reaches the "All migrations applied" step.

### Option B — Manual Supabase SQL Editor

If the v264 migration runner is **not** active:

1. Deploy the front-end manually (push to `main` or run the Pages workflow).
2. Open the Supabase SQL Editor.
3. Run `migration_v301_notifications.sql` as a single script.
4. Confirm no errors.

---

## Step 3 — Verify the migration

Run the following checks in the Supabase SQL Editor:

```sql
-- 1. Migration is recorded
SELECT version, applied_at FROM schema_migrations WHERE version = '301';

-- 2. Notification tables exist and have RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
JOIN pg_class ON pg_class.relname = tablename
WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_rules');

-- 3. Custody triggers are in place
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname IN ('custody_records_state_t', 'custody_expenses_state_t',
                 'custody_expense_limit_t', 'custody_return_limit_t')
  AND NOT tgisinternal;

-- 4. Generator RPC is callable (runs as the postgres owner; no tenant header needed here)
SELECT proname FROM pg_proc WHERE proname = 'generate_notifications';
```

---

## Step 4 — Configure Resend email credentials

The `admin_reset_password_email()` RPC sends password-reset emails via Resend. Insert the real credentials into `app_settings`:

```sql
INSERT INTO public.app_settings (key, value)
VALUES ('resend_api_key', 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_settings (key, value)
VALUES ('email_sender', 'Sara Arch <noreply@yourdomain.com>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

Then send a test email from the **Settings → Users** screen by resetting a test user's password.

---

## Step 5 — Post-deploy smoke tests

- [ ] Hard-refresh the app and confirm `version.json` shows `v301`.
- [ ] Confirm the service worker registers and caches update to `sara-arch-v301`.
- [ ] Log in as an admin and open the **🔔 Notifications** screen; it should load without errors.
- [ ] Create a client with an overdue balance (or a task with a due date) and run `generate_notifications` (triggered automatically on login or call the RPC manually). A notification should appear.
- [ ] Mark a notification read, then archive it; the UI should refresh.
- [ ] Put the browser offline, attempt a mutation, then go back online and confirm the sync indicator processes the queue.

---

## Rollback

If anything goes wrong:

1. Revert the GitHub Pages deploy by re-running the previous successful Pages workflow or restoring the prior release tag.
2. The database changes are additive; no rollback SQL is required unless you want to drop the new tables:
   ```sql
   DROP TABLE IF EXISTS notifications;
   DROP TABLE IF EXISTS notification_rules;
   DELETE FROM schema_migrations WHERE version = '301';
   ```
3. The custody trigger fix is safe to leave in place; do not drop those triggers.
