# Sara Arch - النظام المالي لمكتب سارة أبو العلا

نظام محاسبي ومالي متكامل لإدارة المشاريع والعملاء والموظفين والمعاملات المالية.

## 🚀 Quick Start

### 1. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وسجّل دخولك
2. أنشئ مشروع جديد (`Sara-Arch`)
3. انتظر حتى يصبح المشروع جاهزًا

### 2. إعداد قاعدة البيانات

1. في لوحة تحكم Supabase، افتح **SQL Editor**
2. افتح ملف `schema.sql` من هذا المشروع
3. انسخ المحتوى والصقه في المحرر، ثم اضغط **Run**

### 3. ربط التطبيق بـ Supabase

1. في Supabase، اذهب إلى **Project Settings > API**
2. انسخ:
   - **Project URL** → الصقه في `js/supabase.js` بدلًا من `SUPABASE_URL`
   - **anon public** key → الصقه في `js/supabase.js` بدلًا من `SUPABASE_ANON_KEY`

### 4. تشغيل التطبيق

بما أن هذا مشروع Frontend بسيط، يمكنك تشغيله بعدة طرق:

**أ) مباشرة من الملف:**
افتح `index.html` في المتصفح (بعض ميزات Auth قد لا تعمل بشكل كامل من `file://`)

**ب) Live Server (VS Code):**
```bash
# إذا كان لديك Node.js
npx live-server
```

**ج) Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

ثم افتح: `http://localhost:8000`

### 5. إنشاء حساب أول

1. افتح التطبيق
2. اضغط **"سجل الآن"**
3. أدخل بياناتك
4. سجّل الدخول

---

## 📁 Project Structure

```
├── index.html          # Main app shell
├── css/
│   └── style.css       # All styles (dark theme, RTL)
├── js/
│   ├── supabase.js     # Supabase client config
│   ├── auth.js         # Auth module (login/register/logout)
│   └── app.js          # Main app logic & data loading
├── schema.sql          # Database schema for Supabase
└── README.md           # This file
```

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `clients` | العملاء |
| `projects` | المشاريع |
| `employees` | الموظفين |
| `vendors` | الموردين |
| `items` | البنود / المنتجات |
| `sectors` | قطاعات المصروفات |
| `transactions` | المعاملات المالية |
| `procurements` | مشتريات ومستخلصات |
| `employee_transactions` | سلف وجزاءات للموظفين |
| `employee_salary_history` | تاريخ تعديلات الرواتب |
| `custody_records` | سجلات العهد |

All tables support **soft delete** via `deleted_at` column.

---

## 🔐 Auth

This app uses **Supabase Auth** with email/password.

- Auto token refresh
- Session persistence
- Protected routes

---

## 🛡️ Row Level Security (RLS)

All tables have RLS enabled with a simplified policy: **authenticated users can perform all operations**.

You can later refine policies based on user roles (admin, accountant, viewer, etc.).

---

## 🎨 Features

- ✅ Arabic RTL interface
- ✅ Dark theme
- ✅ Supabase integration (official SDK)
- ✅ Authentication (login / register / logout)
- ✅ Dashboard with KPIs
- ✅ Clients, Projects, Transactions, Employees modules
- ✅ Responsive design
- ✅ Soft delete support
- ✅ Clean modular code (no giant single file!)

---

## 📝 Next Steps / TODO

- [ ] Add CRUD forms (modals) for all entities
- [ ] Add charts and reports
- [ ] Add print/export functionality
- [ ] Add file attachments (invoices, contracts)
- [ ] Add role-based access control
- [ ] Add notifications and activity log
- [x] Deploy to GitHub Pages

---

## 🙋 Support

If you need help:
1. Check the browser console (F12) for errors
2. Verify your Supabase credentials in `js/supabase.js`
3. Make sure RLS policies are applied correctly
4. Ensure the `schema.sql` was executed without errors

---

**Designed for:** Sara Abu Ela Office  
**Developer:** Ahmed El-Gendy


---

## 🔗 Connect GitHub to Supabase (CLI + CI/CD)

This repo includes Supabase CLI configuration and a GitHub Actions workflow.

### 1. Link locally (one time)

```bash
npx supabase login
npx supabase link --project-ref tvjkctttcijymqvaetsv
```

### 2. Setup GitHub Actions (optional)

Add this secret to your GitHub repo (`Settings → Secrets and variables → Actions`):

| Secret | How to get it |
|--------|---------------|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → **New Token** |

After adding the secret, every push to `main` will auto-deploy database changes to Supabase.

### 3. Supabase Dashboard Integration

You can also connect GitHub directly inside Supabase:
1. Go to **Project Settings → Integrations**
2. Click **GitHub**
3. Authorize Supabase to access your `Gendy92/Sara-Arch` repo
