# Sara-Arch E2E Tests (Playwright)

This directory contains the Playwright end-to-end test suite for the Sara-Arch static SPA.

## Prerequisites

1. Run `npm install` (Playwright and Supabase are already in `devDependencies`).
2. Run `npx playwright install chromium` to install the browser binary.
3. Apply `tests/e2e/setup/seed.sql` to your **dedicated staging Supabase project**.
4. Set the environment variables below.

## Environment Variables

Create a `.env` file in the project root or export the variables in your shell:

```bash
E2E_SUPABASE_URL=https://your-staging-project.supabase.co
E2E_SUPABASE_ANON_KEY=your-staging-anon-key
E2E_SUPABASE_SERVICE_KEY=your-staging-service-key
# Optional: deterministic admin password. If omitted, a random password is generated.
E2E_ADMIN_PASSWORD=YourSecurePassword123
# Optional: point Playwright at a deployed preview/staging URL instead of starting localhost.
E2E_BASE_URL=https://your-preview-url.github.io
```

> **Security:** Never commit the service key. It is only used by `globalSetup` and `globalTeardown` to create/clean the E2E tenant.

## Applying `seed.sql` to Staging

1. Open the Supabase SQL Editor for your staging project.
2. Create a new query.
3. Paste the contents of `tests/e2e/setup/seed.sql`.
4. Run the query. This creates:
   - `public.e2e_cleanup_tenant(UUID)` — idempotently removes all business data for one tenant.
   - `public.e2e_seed_tenant(UUID)` — inserts default sectors, the office vendor, and notification rules.

Ensure your staging project has the latest migrations (up to `migration_v301_notifications.sql`) applied before running tests.

## Running Tests

```bash
# Run all E2E tests headlessly against a locally served app
npm run test:e2e

# Run against a deployed URL ( skips the local webServer )
E2E_BASE_URL=https://your-url.github.io npm run test:e2e

# Run in headed mode for debugging
npm run test:e2e:headed

# Run with the Playwright UI
npm run test:e2e:ui
```

## How It Works

- `global-setup.js` creates a fresh tenant (`e2e-tests-<runId>`) and an admin user linked to it.
- It calls `e2e_seed_tenant(...)` to create default reference data for that tenant.
- It temporarily writes `js/config.local.js` so the static SPA points to the staging Supabase project.
- Test state is saved to `tests/e2e/.state/setup.json`.
- `global-teardown.js` calls `e2e_cleanup_tenant`, removes the tenant/user/profile, and restores `js/config.local.js`.
- All specs run with `workers: 1` and share the same tenant, using unique prefixes to avoid collisions.

## Notes

- Tests are designed for a dedicated staging environment. They require a service-role key and will not work against production.
- Do not run these tests against a tenant containing real data.
- If `E2E_BASE_URL` is set, Playwright will not start the local dev server; use this to run the suite against a GitHub Pages preview or staging deployment.
