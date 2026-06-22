# Factory Reset — Clear All Test Data

Use this when you want to delete all test/demo data and start using Sara Arch with real information.

## What stays

- Database schema (tables, views, RLS, triggers)
- Admin user(s) in `profiles` / `auth.users`
- Tenant configuration (`tenants`, `user_tenants`)
- Company settings in `app_settings`
- Master data: sectors, items, work sections, work items
- Audit logs and user permissions

## What gets deleted

- Clients, projects, project tasks
- Transactions and procurements
- Vendors, employees, payroll, attendance
- Custody records and custody expenses

## Steps

1. **Optional but recommended:** Download a backup first.
   - Open the app → **⚙️ الإعدادات → النسخ الاحتياطي** → **📥 تحميل النسخة الاحتياطية**.

2. Open the Supabase SQL Editor for your project.

3. Copy the contents of `clear_all_data.sql` and run it.

4. Go back to the app, refresh the page (`F5` or **مسح الكاش وإعادة التحميل**).

5. Start entering real data:
   - **البيانات الأساسية** (sectors, work sections, items)
   - **العملاء والمشاريع**
   - **الموردين**
   - **الموظفين**

## Need to delete test users too?

This script does **not** delete auth users. To remove test users:

- Go to Supabase Dashboard → Authentication → Users.
- Delete the test accounts manually.
- Or keep them and change their passwords/emails.

---

**Last updated:** v241
