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
