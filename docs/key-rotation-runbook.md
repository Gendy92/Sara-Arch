# Key Rotation Runbook — Sara-Arch

Rotate credentials after any suspected exposure, after a team member leaves, or every 6–12 months as routine hygiene.

---

## 1. Supabase service-role and anon keys

### Why
The service-role key bypasses RLS. If it leaks, an attacker has full database access. The anon key is public by design but should still be rotated if exposed.

### What to update
| Secret | Location |
|--------|----------|
| `SUPABASE_ANON_KEY` | GitHub repository secret + local `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub repository secret + local `.env` |
| `E2E_SUPABASE_ANON_KEY` | GitHub repository secret (staging) |
| `E2E_SUPABASE_SERVICE_KEY` | GitHub repository secret (staging) |

### Steps

1. Open the Supabase dashboard: `https://supabase.com/dashboard/project/tvjkctttcijymqvaetsv`
2. Go to **Project Settings → API**.
3. Under **Project API keys**, click **Generate a new service-role key**.
   - Copy the new key immediately — Supabase shows it only once.
4. (Optional) Click **Generate a new anon key**.
5. Do **not** delete the old keys yet.

#### Update GitHub Secrets

1. Open `https://github.com/Gendy92/Sara-Arch/settings/secrets/actions`
2. For each of the four secrets above:
   - Click the secret name.
   - Paste the new value.
   - Click **Update secret**.

#### Update local `.env`

Edit your local `.env` file (never commit it):

```bash
SUPABASE_ANON_KEY=new-anon-key
SUPABASE_SERVICE_ROLE_KEY=new-service-role-key
E2E_SUPABASE_ANON_KEY=new-staging-anon-key
E2E_SUPABASE_SERVICE_KEY=new-staging-service-key
```

### Verification

1. Trigger the latest successful GitHub Action (Pages deploy or backup workflow).
2. Confirm it reaches the "All migrations applied" or "Backup completed" step.
3. Open the live app, hard-refresh, and log in.
4. Only after everything works, return to **Supabase → Project Settings → API** and delete the old keys.

---

## 2. Resend API key

### Why
The Resend key was exposed in chat during v301 setup. Even if you rotated it already, document the process.

### Steps

1. Open [https://resend.com](https://resend.com) → **API Keys**.
2. Click **Create API key**.
   - Name: `Sara-Arch production`
   - Permission: **Sending**
3. Copy the new key.
4. In the Supabase SQL Editor, run:
   ```sql
   INSERT INTO public.app_settings (key, value)
   VALUES ('resend_api_key', 're_NEW_KEY_HERE')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
   ```
5. Send a test password-reset email from the app.
6. After the test succeeds, delete the old Resend key.

---

## 3. GitHub personal access tokens

If any PAT or OAuth token was shared:

1. Go to `https://github.com/settings/tokens` and `https://github.com/settings/applications`.
2. Revoke anything suspicious or exposed.
3. Re-create any tokens needed for CI/deploy scripts.
4. Update the corresponding GitHub Secrets.

---

## 4. Post-rotation checklist

- [ ] Supabase service-role key rotated and old key deleted.
- [ ] Supabase anon key rotated and old key deleted.
- [ ] GitHub Actions secrets updated.
- [ ] Local `.env` updated.
- [ ] Live app login and a core workflow tested.
- [ ] Resend key rotated (if exposed).
- [ ] GitHub tokens audited.
