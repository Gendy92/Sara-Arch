# Contributing Guide

## Code style

- Use `const` and `let`; avoid `var`.
- Use strict equality (`===` / `!==`) where possible.
- Keep functions small and focused.
- Escape all HTML output with `Utils.esc` or `App.esc`.
- Prefer pure utility functions in `js/utils.js` so they can be unit-tested.

## Before committing

Run the quality checks locally:

```bash
npm run lint
npm test
```

## Adding a new feature

1. Create a branch from `dev.2`.
2. Add or update tests in `tests/unit/` for any new pure logic.
3. Update `MIGRATIONS.md` if the database schema changes.
4. Update `CHANGELOG.md` and bump the version in `index.html`, `sw.js`, and `version.json`.
5. Open a PR to `dev.2` and ensure CI passes.

## Adding a database migration

1. Create `migration_v<NNN>_<short_desc>.sql`.
2. Add the same SQL to `schema_full_fix.sql`.
3. Update `MIGRATIONS.md`.
4. Apply the migration in the target Supabase project before or immediately after deploying the matching front-end version.

## Staging

To test against a staging Supabase project:

1. Add staging keys to `js/config.local.js`:
   ```js
   window.SARA_LOCAL_CONFIG = {
     SUPABASE_URL: 'https://prod.supabase.co',
     SUPABASE_ANON_KEY: 'prod-key',
     STAGING_SUPABASE_URL: 'https://staging.supabase.co',
     STAGING_SUPABASE_ANON_KEY: 'staging-key'
   };
   ```
2. Open the app with `?mode=staging`, e.g. `http://localhost:8080/index.html?mode=staging`.
