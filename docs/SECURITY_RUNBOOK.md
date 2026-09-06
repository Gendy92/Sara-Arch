# Sara-Arch Security Runbook

Manual hardening steps that cannot be done through code commits alone.

---

## 1. Rotate Supabase API keys

### Why
The service-role key has powerful access. Rotate it periodically and whenever it may have been exposed.

### Steps
1. Open the Supabase project dashboard: `https://tvjkctttcijymqvaetsv.supabase.co`
2. Go to **Project Settings → API**.
3. Click **Generate a new service-role key** (and optionally a new anon key).
4. Copy the new keys.
5. Update them in:
   - Your local `.env` (never commit this file).
   - GitHub repository secrets:
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
6. Re-run the latest failed or scheduled GitHub Action to confirm everything still works.
7. Delete the old key in Supabase only after the new deploy/backup run succeeds.

### Updating GitHub Secrets via the web UI
- Repo → **Settings → Secrets and variables → Actions → Repository secrets**
- Click the secret name → paste the new value → **Update secret**.

---

## 2. Enable MFA for admin accounts

### Why
Admin accounts can reset passwords and manage users. MFA greatly reduces takeover risk.

### Steps
1. Supabase Dashboard → **Authentication → Providers / MFA**.
2. Enable **Authenticator apps (TOTP)** and/or **Phone MFA**.
3. In **Authentication → Policies**, turn on **Enforce MFA for all users** if your users can handle it.
   - If non-admin users cannot use MFA yet, leave it optional and require every admin to enroll manually.
4. Ask each admin user to:
   - Log in → **Account / MFA** → enroll an authenticator app.

### Extra safety
- Consider removing the `profiles_self_insert` policy or restricting sign-ups to invites only if the app is not open to self-registration.

---

## 3. Restore a daily backup to staging

### Why
A backup you cannot restore is not a backup. Test the restore process monthly.

### Prerequisites
- A separate Supabase project to use as staging.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the staging project.
- `psql` or the Supabase CLI installed locally.

### Option A — Full pg_dump restore (recommended for true DR)
The JSON backup is useful for ad-hoc exports, but for disaster recovery a native SQL dump is better.

1. Install the Supabase CLI and log in:
   ```bash
   npx supabase login
   ```
2. Link to production:
   ```bash
   npx supabase link --project-ref tvjkctttcijymqvaetsv
   ```
3. Create a SQL dump:
   ```bash
   npx supabase db dump --file sara-prod-backup.sql
   ```
4. Connect to staging and run the dump:
   ```bash
   psql "postgres://postgres:<staging-password>@<staging-host>/postgres" -f sara-prod-backup.sql
   ```

### Option B — Restore from the JSON backup artifact
The GitHub Actions backup workflow exports one JSON file per table.

1. Download the latest backup artifact from:
   - GitHub → Actions → **Daily Database Backup** → latest run → Artifacts.
2. Unzip it. You will see folders like `backups/YYYY-MM-DD/`.
3. Use the staging service-role key to import each table. For example, with `curl`:
   ```bash
   export STAGING_URL="https://<staging>.supabase.co"
   export STAGING_KEY="<staging-service-role-key>"
   curl -sX POST "$STAGING_URL/rest/v1/clients" \
     -H "apikey: $STAGING_KEY" -H "Authorization: Bearer $STAGING_KEY" \
     -H "Content-Type: application/json" \
     -d @backups/YYYY-MM-DD/clients.json
   ```
   Import tables in dependency order (clients → projects → transactions → …) to avoid FK errors.

### Verification
After restore, log in to the staging app and confirm:
- Dashboard loads.
- Tenant-scoped data is visible only to the correct tenant.
- Latest migration version in `schema_migrations` matches production.

---

## 4. Revoke exposed GitHub tokens

If a GitHub OAuth token was ever used in a shell command or shared, revoke it:
- GitHub → **Settings → Developer settings → Personal access tokens / Authorized OAuth apps** → remove the token/app.

---

## 5. Enable GitHub 2FA on the owner account

If the repository owner (`Gendy92`) does not have 2FA enabled, enable it immediately:

1. GitHub → **Settings → Account security**.
2. Click **Enable two-factor authentication**.
3. Choose an authenticator app (recommended) or SMS.
4. Save the recovery codes in a secure offline location.

Without 2FA, a compromised password gives an attacker full control of the repo, secrets, and Pages site.

---

## 6. Verify the secret-scan workflow

A `.github/workflows/secret-scan.yml` job runs on every push/PR and blocks obvious tokens. If it fails:

1. Check the failing file and line in the Actions log.
2. If it is a real secret, revoke/rotate it before pushing again.
3. If it is a false positive (e.g., a dummy key in a test fixture), review carefully and use `git commit --no-verify` only as a last resort.

The local pre-commit hook (`.githooks/pre-commit`) runs the same checks. To enable it:

```bash
git config core.hooksPath .githooks
```

---

## 7. Configure Resend email credentials

The `admin_reset_password_email()` RPC reads credentials from `app_settings` and sends password-reset emails via Resend.

### Steps

1. Sign up / log in at [https://resend.com](https://resend.com).
2. Create an API key with **Sending** permission.
3. Verify a sender domain **or** use the Resend test address `onboarding@resend.dev`.
   - On a free/test Resend account you can usually only send **to the email address you used to sign up at Resend**.
4. Ensure the `pg_net` extension is enabled **and** its worker is running:
   ```sql
   SELECT net.check_worker_is_up();  -- should return true
   ```
   If it returns `false`, go to **Supabase → Database → Extensions**, toggle `pg_net` off and on, then re-check.
5. In the Supabase SQL Editor, run:
   ```sql
   INSERT INTO public.app_settings (key, value)
   VALUES ('resend_api_key', 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

   INSERT INTO public.app_settings (key, value)
   VALUES ('email_sender', 'Sara Arch <noreply@yourdomain.com>')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
   ```
   For initial testing, use `onboarding@resend.dev` as the sender.
6. In the app, go to **Settings → Users**, pick a test user, and click **إرسال كلمة مرور جديدة بالبريد**.
   - The RPC now returns a `request_id`.
   - After ~10 seconds, run in the SQL Editor:
     ```sql
     SELECT public.get_email_status(<request_id>);
     ```
   - Check the Resend dashboard **Logs** for the delivery status.
7. Store the Resend key in a password manager; it is not committed to the repo.

---

## 8. Protect `main` and `dev.2` branches

Branch protection prevents force-pushes and requires review/status checks before merge.

### Steps

1. GitHub repo → **Settings → Branches**.
2. Add or edit rules for `main` and `dev.2`:
   - ✅ **Require a pull request before merging**
     - Require approvals: at least 1
   - ✅ **Require status checks to pass before merging**
     - `lint-and-test` (or the name of your CI check)
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Restrict pushes that create files larger than 100 MB**
   - ✅ **Do not allow bypassing the above settings** (for admins too, once you are confident)
3. Save each rule.

---

## v301 Pre-Release Security Checklist

| # | Task | Where | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Revoke any exposed GitHub OAuth token | GitHub → Settings → Developer settings | ⬜ N/A | No exposed token found in tracked files |
| 2 | Enable GitHub 2FA on the `Gendy92` owner account | GitHub → Settings → Account security | ✅ | Authenticator app enabled; recovery codes saved |
| 3 | Enable MFA for admin users in Supabase Auth | Supabase → Authentication → MFA | ⏸️ | Deferred — enable after admin devices are ready |
| 4 | Insert Resend key + sender into `app_settings` and send a test email | Supabase SQL Editor + Resend dashboard | ⏸️ | Deferred — Resend domain verification needed |
| 5 | Run `verify_high_priority.sql` + `tenant_isolation.sql` + review Security Advisor | Supabase SQL Editor + Security Advisor | ⏸️ | Patch created; run `security_advisor_hardening_patch.sql` + enable leaked-password protection |
| 6 | Apply v300 custody trigger fix and v301 migration | Supabase SQL Editor / CI | ✅ | Deployed; custody triggers verified |
| 7 | Protect `main` and `dev.2` with required status checks | GitHub → Settings → Branches | ⏸️ | Pending manual GitHub settings |
| 8 | Rotate Supabase service-role and anon keys | Supabase → Project Settings → API + GitHub Secrets | ⏸️ | See `docs/key-rotation-runbook.md` |
| 9 | Enable the local pre-commit hook | Local shell | ✅ | `git config core.hooksPath .githooks` executed |

> **Note:** Items 1–3 and 7–8 require owner-level access and cannot be automated through code commits. Schedule them before the v301 public release.

