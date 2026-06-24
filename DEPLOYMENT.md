# Deployment Runbook

## Environments

- **Production**: `https://gendy92.github.io/Sara-Arch/` (deployed from `main`)
- **Staging mode**: append `?mode=staging` to the production URL and provide `STAGING_*` keys in `js/config.local.js`
- **Local dev**: open `index.html` directly or serve with any static server after creating `js/config.local.js`

## Branch strategy

- `main` → production. Always deployable.
- `dev.2` → active development branch. Merge into `main` only after CI passes.

## How to deploy a change

1. Make changes on `dev.2`.
2. Bump the version in `index.html`, `sw.js`, and `version.json`.
3. Run lint and tests locally:
   ```bash
   npm run lint
   npm test
   ```
4. Commit and push `dev.2`:
   ```bash
   git add .
   git commit -m "vXXX: description"
   git push origin dev.2
   ```
5. Wait for the **Lint and Test** CI workflow to pass.
6. Merge `dev.2` into `main`:
   ```bash
   git checkout main
   git merge dev.2
   git push origin main
   ```
7. GitHub Actions will deploy `main` to Pages automatically.
8. If the change includes a database migration, run the migration file in Supabase SQL Editor and update `MIGRATIONS.md`.
9. Users must perform a **Hard Refresh** (`Ctrl + Shift + R` / `Ctrl + F5`) to get the latest PWA version.

## Required GitHub secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ANON_KEY` | Production anon key injected into `js/config.local.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Used by the nightly backup workflow |
| `STAGING_SUPABASE_URL` *(optional)* | Staging Supabase project URL |
| `STAGING_SUPABASE_ANON_KEY` *(optional)* | Staging anon key for `?mode=staging` |

## Monitoring

- Check `app_errors` in Supabase to see front-end crashes reported by users.
- Review GitHub Actions logs for deployment failures.
