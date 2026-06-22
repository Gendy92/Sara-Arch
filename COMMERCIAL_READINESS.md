# Sara Arch — Commercial Readiness Package

> Use this document when offering the system to a paying customer.
> It is a starting template; have a lawyer review before signing with clients.

---

## 1. Product Positioning (30-second pitch)

**Sara Arch** is a financial and accounting system designed for architecture, construction, and design offices. It tracks clients, projects, expenses, vendors, employees, payroll, custody, and tasks in one Arabic, mobile-friendly web app.

**Key value:**
- Know your office cash position in real time.
- Never lose track of project profitability.
- Pay employees correctly with attendance + payroll.
- Control who can see/do what with role-based permissions.

---

## 2. Pricing Model (Recommended)

### Option A — SaaS (Monthly Subscription)
| Tier | Users | Projects | Price (EGP/month) | Includes |
|------|-------|----------|-------------------|----------|
| Starter | 2 users | Unlimited | 1,500 | Core accounting, reports, backups |
| Professional | 5 users | Unlimited | 3,500 | + Payroll, custody, tasks |
| Enterprise | 10+ users | Unlimited | 6,500+ | + Priority support, custom reports, onboarding |

- Annual payment: 2 months free.
- Extra user: 300 EGP/user/month.
- Setup & onboarding (one-time): 2,000 – 5,000 EGP depending on data migration.

### Option B — Self-Hosted / One-Time License
| Item | Price (EGP) |
|------|-------------|
| Source code license + deployment | 35,000 – 60,000 |
| Annual maintenance (updates + support) | 15% of license / year |
| Per-client Supabase setup (optional) | 2,000/setup |

> **Note:** Current architecture is single-tenant. For SaaS with multiple clients sharing one instance, a multi-tenancy refactor is required (estimate: +40–60 hours).

---

## 3. Terms of Service (Arabic Template)

**بيان شروط استخدام نظام سارة المحاسبي**

1. **الملكية:** البرنامج مملوك لـ [اسم شركتك]. العميل يحصل على ترخيص استخدام محدود.
2. **البيانات:** البيانات التي يدخلها العميل تبقى ملكًا للعميل. نحن لا نبيع البيانات ولا نشاركها.
3. **النسخ الاحتياطي:** يتم توفير نسخ احتياطي يومي تلقائي. العميل مسؤول أيضًا عن تحميل نسخة احتياطية محلية دوريًا.
4. **الدعم:** يشمل الاشتراك دعمًا عبر الواتساب/البريد خلال أيام العمل. وقت الاستجابة يتراوح بين 2–24 ساعة حسب الباقة.
5. **التعطل:** نبذل جهدًا معقولًا للحفاظ على توفر النظام 99% شهريًا. التعطل الناتج عن صيانة Supabase أو الإنترنت خارج عن إرادتنا.
6. **الإلغاء:** يمكن للعميل إلغاء الاشتراك في أي نهاية دورة شهرية. لا يوجد استرداد للمدفوعات المسبقة.
7. **السرية:** نلتزم بسرية بيانات العميل ولا نطلع عليها إلا بناءً على طلب الدعم.

---

## 4. Service Level Agreement (SLA)

| Severity | Definition | Response Time | Resolution Target |
|----------|------------|---------------|-------------------|
| Critical | System down or data loss risk | 2 hours | 24 hours |
| High | Major feature broken (cannot add transactions, payroll wrong) | 4 hours | 48 hours |
| Medium | UI bug, report issue | 1 business day | 5 business days |
| Low | Feature request, cosmetic | 3 business days | Best effort |

**Uptime target:** 99% monthly, excluding scheduled maintenance and third-party outages (Supabase, GitHub Pages, DNS).

---

## 5. Support Workflow

1. **Client reports issue** via WhatsApp / email / support portal.
2. **Triage:** classify severity within 2 business hours.
3. **Reproduce:** request screenshots / screen recording if needed.
4. **Fix / workaround:** deploy patch or provide workaround.
5. **Confirm resolution:** client confirms fix.
6. **Document:** add to internal knowledge base.

**Support channels:**
- WhatsApp Business: [your number]
- Email: support@[yourdomain].com
- Documentation: link to the user manual

---

## 6. Privacy Policy (Arabic Template)

**سياسة الخصوصية**

- نجمع فقط البيانات التي يدخلها العميل في النظام (عملاء، مشاريع، مصروفات، موظفين، ...).
- لا نستخدم هذه البيانات لأغراض تسويقية.
- البيانات تُخزن على خوادم Supabase (PostgreSQL) مع تشفير أثناء النقل (HTTPS/TLS).
- يمكن للعميل طلب تصدير بياناته الكاملة في أي وقت.
- عند إلغاء الاشتراك، يمكن للعميل طلب حذف دائم لبياناته خلال 30 يومًا.

---

## 7. Deployment Options for a Paying Client

### Option 1 — Separate Supabase Project per Client (Recommended now)
- Pros: True data isolation, easy to customize, simple RLS.
- Cons: Manual setup per client, higher overhead.
- Setup time: 2–4 hours.

### Option 2 — Multi-Tenant Single Supabase Project (Future)
- Pros: One deployment serves many clients.
- Cons: Requires schema refactor (tenant_id on every table), stricter RLS, more testing.
- Effort: +40–60 hours development.

---

## 8. Onboarding Checklist for New Client

- [ ] Sign contract / terms of service.
- [ ] Create Supabase project (or tenant) and apply `schema_full_fix.sql`.
- [ ] Configure GitHub Pages deployment with client branding.
- [ ] Add first admin user.
- [ ] Enter master data: sectors, work sections, work items, items.
- [ ] Import existing clients and projects (Excel template provided).
- [ ] Import vendors and opening balances.
- [ ] Train 2–3 users using the user manual.
- [ ] Schedule first-month review call.

---

## 9. What to Say When a Client Asks “Is My Data Safe?”

> "Your data lives in its own Supabase database, encrypted in transit and at rest. Access is controlled by individual user accounts and permissions. We perform automatic daily backups, and you can download a full backup at any time. We do not share or sell your data."

---

## 10. Next Steps Before First Sale

1. Pick Option A (subscription) or Option B (license).
2. Customize this document with your company name, prices, and contact info.
3. Have a local lawyer review the terms.
4. Prepare a simple contract template.
5. Create a demo account with sample data.
6. Build a one-page marketing landing page (`landing.html`).

---

**Last updated:** 2026-06-22  
**Version:** v238
