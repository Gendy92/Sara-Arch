# Sara Arch — النظام المالي والمحاسبي

**Sara Abo Elela Financial & Accounting System**

A single-page web application for managing the finances, projects, vendors, employees, and payroll of a construction/design office. Built as a lightweight Progressive Web App (PWA) using vanilla HTML/CSS/JS and backed by Supabase (PostgreSQL + Auth + REST).

---

## 🚀 Live App

- **Production URL:** https://gendy92.github.io/Sara-Arch/
- **Supabase Project:** https://tvjkctttcijymqvaetsv.supabase.co
- **Region:** `eu-north-1`

---

## ✨ Features

### Financial Management
- Client and project ledger with deposits, expenses, and calculated supervision fees.
- Office cash flow: owner deposits/withdrawals, office expenses, and real-time office balance.
- Vendor management with service/merchandise classification, statements, and procurement tracking.

### Construction Operations
- Work sections and work items catalog for project categorization.
- Project budget vs. actual expenses with remaining balance.
- Procurement records linked to vendors, projects, and items.

### Human Resources
- Employee records and monthly payroll.
- Fingerprint attendance upload (Excel/CSV) with auto-detection.
- Custody (petty cash / عهد نقدية) tracking for office and projects.

### Administration
- Role-based access control (admin vs. user) with per-screen permissions.
- Audit log of create/update/delete actions.
- Local JSON/ZIP backup export from the browser.
- Automatic daily backups via GitHub Actions.

### Reporting & UX
- Client, project, vendor, and office statements.
- Excel export and print/PDF export for statements.
- Dashboard KPIs and charts.
- Arabic RTL interface with mobile-responsive layout.
- PWA support: installable app, offline static caching, service worker.

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Pure HTML5 / CSS3 / JavaScript (no framework) |
| Styling | Custom RTL dark theme, responsive CSS, print styles |
| Backend-as-a-Service | Supabase: PostgreSQL, PostgREST, Auth |
| Data Access | Direct Supabase REST API calls from the browser |
| Excel/Spreadsheets | SheetJS (`xlsx`) via CDN |
| ZIP Export | JSZip via CDN |
| Hosting | GitHub Pages |
| CI/Backup | GitHub Actions (daily JSON backup) |
| Versioning | `version.json` + cache-busting query params |

---

## 📋 Prerequisites

- A modern web browser (Chrome, Edge, Firefox, Safari).
- A Supabase project with the schema applied.
- (Optional) GitHub repository with Actions enabled for automatic backups.

---

## ⚙️ Installation

### 1. Clone or download the project

```bash
git clone https://github.com/Gendy92/Sara-Arch.git
cd Sara-Arch
```

### 2. Create and configure your Supabase project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Open the **SQL Editor**.
3. Run the schema files in the following order:
   ```text
   schema.sql
   schema_full_fix.sql
   migration_v109.sql
   migration_v119_drop_tax.sql
   migration_v130_fix_transactions.sql
   import_work_sections_items.sql
   cleanup_duplicate_master_data.sql   -- if needed
   ```
4. Go to **Authentication → Settings** and note your **Project URL** and **Anon Key**.

### 3. Configure the frontend

1. Copy the example local config file:
   ```bash
   cp js/config.local.js.example js/config.local.js
   ```
2. Edit `js/config.local.js` with your real Supabase credentials:
   ```js
   window.SARA_LOCAL_CONFIG = {
     SUPABASE_URL: 'https://your-project.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-key'
   };
   ```
3. `js/config.local.js` is gitignored and will override the placeholders in `js/config.js`.

> **Security note:** Do not commit Supabase keys to source control. The app does not store service-role keys in the browser; admin user operations use public signup. Rotate your keys if they were ever exposed.

### 4. Run locally

Because the app uses ES modules and `import`/`export`, open it through a local server rather than directly from disk:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# VS Code Live Server extension
```

Then open: http://localhost:8000

### 5. Create the first admin user

1. Open the app.
2. Go to **تسجيل مستخدم جديد** (Register).
3. Register the first user; by default, newly registered users receive the `user` role.
4. In Supabase SQL Editor, update the role to `admin`:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE username = 'your_username';
   ```

---

## 🚀 Deployment

### GitHub Pages (recommended)

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Select the source branch (usually `main`).
4. GitHub will deploy to `https://<username>.github.io/<repo>/`.
5. Ensure `js/config.local.js` is created on the deployment target with real credentials (do not commit it).

### Automatic Backups

The repository includes `.github/workflows/backup.yml`:

- Runs daily at **03:00 UTC**.
- Exports all tables as JSON into `backups/YYYY-MM-DD/`.
- Commits the backup to the repository.
- Manual trigger: **Actions → Daily Database Backup → Run workflow**.

To enable it, add `SUPABASE_SERVICE_ROLE_KEY` as a GitHub repository secret:

1. Go to **Settings → Secrets and variables → Actions**.
2. Add a new repository secret named `SUPABASE_SERVICE_ROLE_KEY`.
3. The workflow in `.github/workflows/backup.yml` will use it.

### Supabase Native Backups

- **Free plan:** automatic daily backups with 7-day retention.
- **Pro plan:** Point-in-Time Recovery (PITR) — restore to any moment in the last 14 days.

---

## 📝 Additional Documentation

- [DOCUMENTATION.md](./DOCUMENTATION.md) — detailed system description, roles, modules, and workflows.
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — full database schema, relationships, and Supabase structure.
- [FEATURES.md](./FEATURES.md) — existing, planned, and missing features.
- [ROADMAP.md](./ROADMAP.md) — recommended development roadmap.
- [CHANGELOG.md](./CHANGELOG.md) — version history and recent changes.

---

## 🔐 Security Notes

- RLS policies now restrict non-admin users to reading all rows but only modifying rows they created. Admin users have full access.
- Keep the Supabase **service-role key** secret and rotate it regularly.
- Do not expose any Supabase keys in client-side code or public repositories.
- If keys were previously committed, rotate them immediately in the Supabase dashboard.

---

## 📧 Support

For issues or feature requests, use the GitHub Issues page or refer to the in-app **APP_TABS_GUIDE.md** / **APP_TABS_GUIDE_EN.md** for tab-by-tab instructions.
