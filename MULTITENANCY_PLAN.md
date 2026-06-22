# Sara Arch — Multi-Tenancy Implementation Plan

> Version: v240  
> Goal: Allow one deployed app to serve multiple independent offices (tenants) with data isolation.

---

## What was implemented in v240

1. **Tenant schema**
   - `tenants` table — each tenant = one office/customer.
   - `user_tenants` table — links `profiles` (auth users) to tenants.
   - Every business table now has a `tenant_id` column.

2. **Automatic tenant assignment**
   - Trigger `set_tenant_id()` fills `tenant_id` on INSERT/UPDATE from the current request context.
   - Function `get_current_tenant_id()` reads the `X-App-Tenant` header first, then falls back to the user's default tenant.

3. **Row Level Security (RLS)**
   - All business tables now have a `tenant_scope` policy: users only see rows whose `tenant_id` matches their current tenant.
   - `profiles`, `user_permissions`, `tenants`, `user_tenants` have their own scoped policies.
   - Employee tables (employees, attendance, payroll, employee transactions, salary history) are read-only for non-admins.

4. **App-side support**
   - `API.getHeaders()` sends `X-App-Tenant` from `localStorage.sara_tenant_id`.
   - `Auth._loadDefaultTenant()` fetches the user's default tenant after login and stores it.

---

## How to apply it

1. Open the Supabase SQL Editor for your project.
2. Run the file `migration_v240_rls_tenants.sql`.
3. Existing data is automatically assigned to the **Default Tenant** so nothing breaks.
4. Refresh the app. Each user will be linked to the default tenant as an admin.

---

## How to onboard a second tenant

1. **Create the tenant**
   ```sql
   INSERT INTO tenants (name, slug) VALUES ('Office Two', 'office-two') RETURNING id;
   ```

2. **Create a user for that tenant**
   - Use public signup or the admin user-management screen.
   - The user gets a row in `profiles` automatically.

3. **Link user to tenant**
   ```sql
   INSERT INTO user_tenants (user_id, tenant_id, role, is_default)
   VALUES ('<profile-id>', '<tenant-id>', 'admin', true);
   ```

4. **Switch tenant in the app**
   - Currently the app uses the user's default tenant from `user_tenants.is_default`.
   - To let users switch between multiple tenants, add a tenant selector in the UI that calls:
     ```js
     localStorage.setItem('sara_tenant_id', '<tenant-id>');
     location.reload();
     ```

---

## Current limitations

- **Tenant selector UI is not built yet.** Users are locked to their default tenant.
- **Admin-created users still need to be linked to a tenant manually** (or extend `admin_create_auth_user` to accept `tenant_id`).
- **app_settings** is not tenant-scoped yet. If you need per-tenant company name/currency, add `tenant_id` to `app_settings` and update `loadServerSettings()` to filter by tenant.
- **Backups** are still global; a per-tenant backup export would need to filter each table by `tenant_id`.

---

## Recommended next steps

1. Run `migration_v240_rls_tenants.sql` on the production Supabase project.
2. Smoke-test every screen with the default tenant.
3. Add a tenant selector dropdown in the settings or sidebar.
4. Extend user creation to assign `tenant_id` automatically.
5. Make `app_settings` tenant-aware.
6. Add a “Tenant admin” role separate from “App admin”.

---

## Security note

The `X-App-Tenant` header is treated as a hint. The database always validates it against the user's `user_tenants` membership via the fallback function. A malicious user cannot access another tenant just by changing the header — the RLS policy enforces the real tenant boundary.
