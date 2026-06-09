# دليل شاشات تطبيق Sara Arch — شرح المنطق والمعادلات

> إصدار v105 — دليل شامل لكل تاب في التطبيق مع المعادلات الدقيقة

---

## 1. 📊 Dashboard (الرئيسية)

### البيانات اللي بتتحمل
أربع استدعاءات بالتوازي:
- كل العملاء (`clients`)
- كل المشاريع (`projects`)
- كل الموظفين (`employees`)
- كل المعاملات (`transactions`)

### الكاردات العلوية (KPIs)

| الكارد | المعادلة |
|--------|----------|
| العملاء | `clients.length` |
| المشاريع | `projects.length` |
| النشطة | `projects.filter(p => p.status === 'active').length` |
| الموظفين | `employees.length` |
| إجمالي الحركة | `totalIncome + totalExp` |

```js
totalIncome = معاملات type = 'project_deposit' + 'owner_deposit' (sum amount)
totalExp    = معاملات type = 'project_expense' + 'office_expense' (sum amount)
```
> ⚠️ "إجمالي الحركة" = الوارد + المصروفات (مش صافي الربح)

---

### أرصدة العملاء

**الفلتر:** بيظهر **كل العملاء اللي عندهم مشاريع** (مش بس اللي عندهم رصيد)

**المعادلة لكل عميل:**
```js
// لكل مشروع للعميل:
constr      = expenses - design_expenses
sup_project = constr × supervision_percentage / 100

// إجمالي العميل:
totalExp  = Σ expenses لكل مشاريعه
totalSup  = Σ sup_project لكل مشاريعه
dep       = Σ deposits للعميل
balance   = dep - totalExp - totalSup
```

| العمود | المعادلة |
|--------|----------|
| الوارد | `dep` |
| المصروفات | `totalExp` |
| الإشراف | `totalSup` |
| الرصيد | `dep - totalExp - totalSup` |

- **أخضر** = الرصيد ≥ 0 (العميل لسه مدفوع)
- **أحمر** = الرصيد < 0 (العميل مديون)

**الترتيب:** حسب **قيمة الرصيد المطلقة** (أكبر رصيد أولاً)

---

### الموردين النشطين

**بيانات:** الموردين + معاملات المصروفات (`project_expense`) + المشتريات (`procurements`)

**تكلفة الخدمات (من المعاملات):**
```js
serviceCost = Σ amount لكل project_expense للمورد
servicePaid = isNew ? Σ paid_amount : Σ amount
```

**المشتريات (من procurements):**
```js
merchandise = Σ total_price
merchPaid   = isNew ? Σ paid_amount : 0    // ⚠️ القديم = 0 (يعني غير مدفوع كله)
```

**الرصيد:**
```js
totalCost = serviceCost + merchandise
totalPaid = servicePaid + merchPaid
balance   = totalCost - totalPaid
```

| اللون | المعنى |
|-------|--------|
| أحمر | علينا (`balance > 0`) |
| أخضر | له (`balance < 0`) |

**الترتيب:** حسب قيمة الرصيد المطلقة

---

## 2. 🏢 Office (المكتب)

### البيانات
- `owner_deposit` (توريدات صاحب المكتب)
- `office_expense` + `withdrawal` (مصروفات + مسحوبات)
- كل المشاريع + مصروفات المشاريع (`project_expense`)

### المعادلات

```js
// إيرادات المكتب
income       = Σ owner_deposit
supervision  = Σ [ (project_expenses - design) × supervision% ] لكل مشروع
totalIncome  = income + supervision

// مصروفات المكتب
expense = Σ office_expense + Σ withdrawal

// رصيد المكتب
balance = totalIncome - expense
```

### الجدول
بيجمع 3 مصادر في جدول واحد:
1. `owner_deposit` → شارة خضراء
2. `office_expense` + `withdrawal` → شارة حمراء
3. **إشراف** (محسوب) → صف افتراضي ما عندوش `id` (مش قابل للتعديل)

الترتيب: حسب `created_at` تنازلي

---

## 3. 👥 Clients & Projects (العملاء والمشاريع)

### الشاشة الرئيسية

بتجيب:
- كل العملاء + مشاريعهم
- كل المصروفات (`project_expense`) + العربونات (`project_deposit`)

**لكل عميل كارد فيه:**
- بيانات العميل (اسم، تليفون، إيميل، عنوان)
- أزرار: تعديل | حذف | كشف حساب العميل
- زر "+ مشروع" لكل عميل
- جدول مشاريع العميل

### جدول المشاريع (لكل مشروع)

```js
exp    = Σ project_expense للمشروع
design = Σ project_expense where expense_category = 'design'
constr = exp - design
sup    = constr × supervision_percentage / 100
dep    = Σ project_deposit للمشروع
```

الأعمدة: المشروع | العنوان | القيمة | مصروفات | إشراف% | إشراف | الحالة | إجراءات

الإجراءات: تعديل | حذف | كشف حساب | ميزانية

### كشف حساب المشروع (Project Statement)

**البيانات:** العربونات + المصروفات للمشروع

**فلتر التاريخ:** من/إلى (بشمل التاريخين)

**بناء الـ ledger:**
| النوع | in | out |
|-------|-----|-----|
| وارد (عربون) | `amount` | 0 |
| منصرف (تشطيب) | 0 | `amount` |
| فاصل ━━ مصروفات تصميم ━━ | 0 | 0 |
| منصرف تصميم | 0 | `amount` |
| إشراف | 0 | `supervisionAmount` |

```js
supervisionAmount = (totalExp - designExp) × supervision% / 100
```

**الرصيد الجاري:**
```js
balance += in - out   // متراكم من أول صف لآخر صف
```

**جدول تفاصيل المصروفات:**
```js
paid = isNew ? paid_amount : amount
bal  = amount - paid
```

القسم: `section_name` أو "تصميم" أو "تشطيب"

---

### كشف حساب العميل (Client Statement)

**بيجيب:** كل العربونات + المصروفات (كل المشاريع)، وبعدين بيفلتر client-side على مشاريع العميل

**لكل مشروع للعميل:**
```js
dep    = Σ deposits للمشروع
exp    = Σ expenses للمشروع
design = Σ design expenses
constr = exp - design
sup    = constr × supervision%
bal    = dep - exp - sup
```

**الإجمالي:**
```js
totalDep = Σ dep لكل مشاريع
totalExp = Σ exp لكل مشاريع
totalSup = Σ sup لكل مشاريع
totalBal = totalDep - totalExp - totalSup
```

**العرض:**
- ملخص عام في الأعلى
- لكل مشروع: شارات (وارد/مصروفات/إشراف/رصيد) + جدول العربونات + جدول التشطيب + جدول التصميم + سطر الإشراف

---

### ميزانية المشروع (Project Budget)

```js
budget          = project.value
totalDep        = Σ deposits
totalExp        = Σ expenses
totalDesign     = Σ design expenses
totalConstr     = totalExp - totalDesign
supervision     = totalConstr × supervision%
remainingBudget = budget - totalExp
clientBalance   = totalDep - totalExp - supervision
expPct          = budget > 0 ? Math.min(100, (totalExp / budget) × 100) : 0
```

**الكاردات:**
| الكارد | لونه |
|--------|------|
| ميزانية المشروع | عادي |
| الوارد | أخضر |
| المصروفات | أحمر |
| إشراف المكتب | ذهبي |
| المتبقي من الميزانية | أخضر لو ≥ 0، أحمر لو < 0 |
| رصيد العميل | أزرق لو ≥ 0، أحمر لو < 0 |

**الشريط:** `expPct%` — أخضر لو expenses ≤ budget، أحمر لو تجاوز

**الرسائل حسب الحالة:**
- `completed` + remaining > 0 → "المتبقي من الميزانية: X"
- `completed` + remaining < 0 → "تجاوز الميزانية بـ X"
- `active` → "المشروع قيد التنفيذ"

---

## 4. 💰 Transactions (المعاملات)

### التاب "الكل" (All)
بيجيب:
- آخر 50 معاملة (`project_deposit` + `project_expense`)
- كل المشاريع
- **كل** المصروفات (`project_expense` بدون limit) ← ⚠️ هيقع لو زادوا
- كل المعاملات (للـ KPIs)

### الـ KPIs
```js
deposits    = Σ project_deposit
expenses    = Σ project_expense
supervision = Σ [ (exp - design) × supervision% ] لكل مشروع
balance     = deposits - expenses - supervision
```

### الجدول
بيجمع معاملات حقيقية + صفوف إشراف (افتراضية):
- **عربون** → شارة خضراء
- **مصروف** → شارة حمراء
- **إشراف** → صف محسوب (مش قابل للتعديل)

**أعمدة المصروف:**
```js
// المدفوع (في تاب المصروفات)
paid = isNew ? paid_amount : amount
// الباقي
bal  = amount - paid
```

**شارات الدفع:**
- `payment_method`: نقدي/بنكي/تحويل → شارة رمادية
- `payment_term`: فوري (أخضر) / آجل (برتقالي) / تسديد (أزرق)

---

### إضافة مصروف مشروع

**الأعمدة:** العميل | المشروع | المورد | القسم | البند | طريقة الدفع | المبلغ | المدفوع | التاريخ | الوصف

**المنطق بعد الإدخال:**
```js
// 1. auto-compute payment_term
payment_term = 'immediate'
if (amount === 0 && paid_amount > 0)  payment_term = 'settlement'
else if (amount > paid_amount)         payment_term = 'credit'

// 2. auto-detect expense_category
expense_category = sectionName.includes('تصميم') ? 'design' : 'construction'

// 3. fallback لو العمود ناقص في DB
if (error contains 'section_id' || 'payment_method' || ...)
  → شيل الحقول الجديدة وحاول تاني
```

**Cascade:**
- Client → Project
- Section → Item (القسم يفلتر البنود)

---

### تعديل معاملة

**أنواع المعاملات:**

| النوع | الحقول | Cascade |
|-------|--------|---------|
| عربون مشروع | عميل، مشروع، مبلغ، طريقة دفع | Client→Project |
| مصروف مشروع | عميل، مشروع، مورد، قسم، بند، طريقة دفع، مبلغ، مدفوع | Client→Project + Section→Item |
| مصروف مكتبي | موظف، قطاع، مبلغ | — |
| إشراف | مشروع، نسبة | — |

نفس منطق `payment_term` و `expense_category` و `fallback` بيتطبق في التعديل.

---

## 5. 🏗️ Vendors (الموردين)

### قائمة الموردين
- الاسم، النوع (خدمات/بضاعة)، التخصص، المسؤول، التليفون
- إجراءات: تعديل | حذف | كشف حساب | مشتريات

### كشف حساب المورد (Vendor Statement)

**بيانات:** المورد + المشتريات (`procurements`) + المصروفات (`project_expense` + `office_expense`)

**بناء الـ ledger الموحد:**

| المصدر | amount | paid | المعنى |
|--------|--------|------|--------|
| procurement جديد | `total_price` | `paid_amount` | شراء جزئي |
| procurement قديم | `total_price` | `0` | ⚠️ محسوب كله غير مدفوع |
| transaction جديد | `amount` | `paid_amount` | مصروف جزئي |
| transaction قديم | `0` | `amount` | تسديد (بيقلل الرصيد) |

**الرصيد الجاري:**
```js
balanceChange = amount - paid
running += balanceChange
```

- أحمر = علينا (`running ≥ 0`)
- أخضر = له (`running < 0`)

---

### مشتريات المورد (Vendor Purchases)

بيجيب كل `procurements` للمورد + فلتر تاريخ

الأعمدة: التاريخ | المشروع | البند | الكمية | سعر الوحدة | الإجمالي | التصنيف | إجراءات

> ⚠️ **مشكلة:** الإجمالي (`total_price`) مش بيتحسب أثناء الحفظ — لو DB مفيش trigger، القيمة هتبقى null

---

### إضافة/تعديل مشتريات

الحقول: المورد* | المشروع | البند* | الكمية | سعر الوحدة | التصنيف | التاريخ | ملاحظات

```js
quantity   = +fd.get('quantity') || 1
unit_price = +fd.get('unit_price') || 0
// total_price مش بيتحسب هنا! ⚠️
```

---

## 6. 🧑‍💼 Employees (الموظفين)

### قائمة الموظفين
- الاسم، الوظيفة، الراتب، العهدة النشطة
- إجراءات: تعديل | حذف | عهدة | حضور

### العهدة (الCustody)

**دورة العهدة الكاملة:**
```
تسليم عهدة → مصروفات منها → مرتد → تسوية
```

**معادلات العهدة:**
```js
given     = +custody.amount
spent     = Σ custody_expenses للعهدة
returned  = +custody.returned_amount
remaining = given - spent - returned
```

**ملخص العهد للموظف:**
```js
activeTotal  = Σ amount للعهود where status = 'active'
settledTotal = Σ amount للعهود where status = 'settled'
```

- **تسليم عهدة:** بيفتح فورم فيه المبلغ + عميل + مشروع + تاريخ
- **مصروف عهدة:** بيسجل في `custody_expenses` (مبلغ + وصف + تاريخ)
- **مرتد:** بيضيف على `returned_amount`
- **تسوية:** بيغير `status` لـ `'settled'` (مفيش validation على الرصيد)

---

### الحضور (البصمة)

**رفع ملف Excel:**
- بيقرأ `.xlsx` / `.csv`
- بيكتشف الأعمدة تلقائي: الاسم | التاريخ | الدخول | الخروج
- بيطابق اسم الموظف مع قاعدة البيانات (exact match ثم partial match)

**تحديد الحالة:**
```js
if (!checkIn && !checkOut)     status = 'absent'
else if (checkIn && !checkOut) status = 'half_day'
else if (checkIn > '09:15')    status = 'late'
else                            status = 'present'
```

> ملاحظة: وقت الخروج **مش بيأثر** على الحالة

**الحفظ:**
- بيحذف (soft delete) كل سجلات الشهر القديم
- بيدخل الجديد دفعات 50 سجل

---

### الرواتب (Payroll)

**حساب المرتب:**
```js
base       = +employee.salary || 0
dailyRate  = base / 30
deductions = round(absent × dailyRate + half_day × dailyRate × 0.5)
bonuses    = Σ employee_transactions where type = 'bonus'
penalties  = Σ employee_transactions where type = 'penalty'
net_salary = base - deductions + bonuses - penalties
```

> `late` و `leave` بيتعدّوا بس **مش بيخصموا** حالياً

**حالات المرتب:**
```
draft → approved → paid
```

- **توليد:** بيحسب وبيحفظ (لو موجود بيّحدّثه)
- **اعتماد:** بيغير `status` لـ `approved`
- **دفع:** بيغير `status` لـ `paid`

> ⚠️ لو ولّدت مرتب `paid` من تاني، بيحتفظ بـ `paid` مع أرقام جديدة (مفروض يرجع `draft`)

---

## 7. 📦 Master Data (البيانات الأساسية)

### الأقسام الموجودة
1. **قطاعات** (Sectors) — تصنيفات المصروفات المكتبية
2. **أصناف** (Items) — كتالوج المواد (اسم، مواصفات، ماركة، وحدة)
3. **أقسام العمل** (Work Sections) — مراحل المشروع (كهرباء، سباكة، إلخ)
4. **بنود الأقسام** (Work Items) — الأعمال داخل كل قسم

### رفع Excel للأقسام والبنود (v105)

**الوضع 1: أقسام فقط**
- ملف فيه عمود واحد: القسم
- بيعمل preview: "وضع: أقسام فقط"
- بيحفظ الأقسام بس

**الوضع 2: أقسام + بنود**
- عمود القسم + عمود البند + (اختياري) ملاحظات
- بيعمل match مع الأقسام الموجودة
- الأقسام الجديدة بتتعمل أولاً
- البنود بتتعمل بعدها مع deduplicate بناءً على (قسم + اسم بند)

---

## 8. 🔐 Users & Permissions (المستخدمين والصلاحيات)

### المستخدمين
- بيجيب كل المستخدمين من Supabase Auth + جدول `profiles`
- الاسم: `profiles.name` → fallback `user_metadata.name` → `safeName()`
- الدور: `profiles.role` → fallback `user_metadata.role` → `'user'`

**إضافة مستخدم:**
- Spreadsheet: username | name | password | role
- بيعمل `authCreateUser` ثم `POST profiles`

**تعديل:**
- بيعدل `profiles` بس
- ⚠️ **مش بيعدل `user_metadata` في Auth** → الاسم القديم بيفضل

### الصلاحيات

**7 شاشات × 5 إجراءات = 35 checkbox لكل مستخدم**

الشاشات: dashboard | clients | vendors | transactions | office | employees | master

الإجراءات:
- `can_view` — مشاهدة
- `can_add` — إضافة
- `can_edit` — تعديل
- `can_delete` — حذف
- `can_print` — طباعة

> الـ `admin` بيتخطى كل الصلاحيات. المستخدمين العاديين بيتعملهم checkboxes.

---

## 9. 📜 Audit & Backup (السجل والنسخ الاحتياطي)

### سجل العمليات
- بيسجل: INSERT | UPDATE | DELETE
- لكل عملية: الجدول، الـ ID، النوع، المستخدم، التاريخ
- ⚠️ **`old_data` دايماً `null`** → مفيش قبل/بعد
- ⚠️ **limit = 100** → السجلات القديمة مش reachable
- فلتر بسيط: باسم الجدول

### النسخ الاحتياطي
- بيجيب 19 جدول كـ JSON
- بيحطهم في ZIP
- بيحملهم على الجهاز
- ⚠️ **مفيش Restore** → بس export مش import
- ⚠️ بيجيب كل البيانات (مش بيستثني المحذوف)

---

## 10. ⚙️ Settings (الإعدادات)

**الشاشة فيها 3 كاردات:**
1. المستخدمين والصلاحيات → زر يفتح شاشة Users
2. النسخ الاحتياطي → زر يفتح شاشة Backup
3. سجل العمليات → زر يفتح شاشة Audit

**مسح الكاش:**
- بيمسح `localStorage` + `sessionStorage`
- بيحافظ على `sara_token` (عشان اليوزر ميفصلش)
- بيعمل reload للصفحة

> ⚠️ مفيش إعدادات فعلية (زي تغيير العملة أو اسم الشركة أو نسبة الإشراف الافتراضية)

---

## ملخص المعادلات الأساسية

| المؤشر | المعادلة |
|--------|----------|
| **مصروفات التشطيب** | `totalExpenses - designExpenses` |
| **الإشراف** | `constr × supervision_percentage / 100` |
| **رصيد العميل** | `deposits - expenses - supervision` |
| **رصيد المورد** | `(serviceCost + merchandise) - (servicePaid + merchPaid)` |
| **المتبقي من الميزانية** | `budget - expenses` |
| **نسبة الصرف** | `Math.min(100, (expenses / budget) × 100)` |
| **الصافي** | `baseSalary - deductions + bonuses - penalties` |
| **الخصم اليومي** | `salary / 30` |
| **العهدة المتبقية** | `given - spent - returned` |
