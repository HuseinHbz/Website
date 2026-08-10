# Phase 28.4 — Employee Portal (payslips · leave · attendance · requests · profile)

> **Status, stated up front.** All six بند of the spec are built and verified
> against live PostgreSQL — **38/38** assertions, including the mandatory
> full IDOR matrix (بند ۲) and the session-independence matrix (بند ۱). The
> employee portal reuses the 26.25a customer-portal PATTERN (OTP lifecycle,
> ownership-scoped data layer, print stylesheet, UI shell) but never its
> SESSION — separate cookie, separate table, separate signing surface, per
> the spec's explicit "code reused, session never reused" instruction.

---

## 1. Attestation

| بند | وضعیت | شاهد (عدد/تست) | توضیح |
|---|---|---|---|
| 🔴 ۱ — نشست کارمند کاملاً مستقل | ✅ | `hr_portal_sessions` جدول جدا، کوکی `hr_portal_token` جدا از `portal_token`/`admin_token` | §2 |
| 🔴 ۱ — کوکی مشتری روی روت کارمند → ۴۰۱ | ✅ | live: توکن مشتری توسط resolver کارمند رد شد | §2 |
| 🔴 ۱ — کوکی کارمند روی روت مشتری → ۴۰۱ | ✅ | live: توکن کارمند توسط resolver مشتری رد شد | §2 |
| ۱ — OTP هش‌شده، یک‌بارمصرف، منقضی‌شونده | ✅ | live: sha256، مصرف دوباره رد شد، انقضا رد شد | §2 |
| ۱ — قفل پس از تلاش‌های ناموفق | ✅ | live: سقف تلاش، نشست قفل شد | §2 |
| ۱ — خروج از همهٔ دستگاه‌ها | ✅ | live: تمام نشست‌ها ابطال شدند | §2 |
| 🔴 ۲ — کارمند A با شناسهٔ فیش B → ۴۰۴ (نه ۴۰۳) | ✅ | live: هر دو جهت | §3 |
| 🔴 ۲ — کارمند A با شناسهٔ درخواست مرخصی B → ۴۰۴ | ✅ | live | §3 |
| ۲ — کارمند نمی‌تواند وضعیت درخواست خودش را دستکاری کند | ✅ | فقط `myLeaveCancel` (لغو)؛ تأیید/رد فقط از مسیر تأییدکنندهٔ ادمین | §3 |
| 🔴 ۲ — دستکاری employeeId در بدنه/کوئری نادیده گرفته می‌شود | ✅ | live: منبع حقیقت فقط `employeeId` نشست سرور، نه پارامتر ورودی | §3 |
| ۳ — فیش‌های خودش فقط، بدون کوئری موازی | ✅ | `myPayslips` از `payroll_slips` مستقیم | — |
| 🔴 ۳ — فیش از دورهٔ تأییدنشده نمایش داده نمی‌شود، حتی به خودِ صاحبش | ✅ | live: دورهٔ draft → نامرئی | §3 |
| ۳ — چاپ/دانلود با استایل ۲۶.۲۴b | ✅ | `payslips/[id]/print` letterhead مشترک | — |
| ۴ — مانده از لجر تراکنش ۲۸.۲، بدون کوئری موازی | ✅ | `myLeaveOverview` → `leaveBalances`/`leaveLedger` reuse | — |
| ۴ — ثبت درخواست مرخصی در چرخهٔ `approval_matrix` واقعی | ✅ | live: از طریق `createLeaveRequest`/موتور تأیید موجود | — |
| 🔴 ۴ — درخواست فراتر از مانده رد می‌شود، نه کوتاه‌شده | ✅ | live: `insufficient_balance` با روزهای دقیق | §4 |
| ۴ — کارکرد ماهانه فقط-مشاهده | ✅ | `myAttendance` reuse از `attendanceOf`/`monthlyTimesheet` | — |
| ۵ — چهار نوع درخواست از طریق `approval_matrix` واقعی | ✅ | `hr_portal_request` doc type جدید در همان موتور | §5 |
| 🔴 ۵ — تأیید/رد در موتور، به رکورد پورتال mirror می‌شود | ✅ | live: هر دو مسیر | §5 |
| 🔴 ۵ — اصلاح اطلاعات فردی مستقیم اعمال نمی‌شود | ✅ | live: حتی پس از تأیید کامل، `hr_employees.national_id` تغییر نکرد | §5 |
| ۶ — فیلد حساس فقط-خواندنی، ماسک‌شده | ✅ | کد ملی/شبا در پاسخ ماسک | — |
| ۶ — فیلد غیرحساس مستقیم قابل ویرایش | ✅ | live: موبایل/آدرس/ایمیل | — |
| ۷ — UI کامل بازخوانی و RTL/دوزبانه | ✅ | `HrPortalApp.tsx` ۵ تب | — |
| امنیت — حقوق در لاگ نیست، ملی/شبا ماسک | ✅ | `logAction` بدون مبلغ/شبا/کد ملی خام | — |
| تنانسی — company_id روی جداول تراکنشی جدید | ✅ | `hr_portal_sessions`/`hr_portal_requests` هر دو `company_id` | `audit:tenancy` 15/15 |

---

## 2. 🔴 استقلال کامل نشست — طراحی و اثبات

سه پورتال، سه جدول، سه کوکی، بدون هیچ سکرت مشترک:

| پورتال | کوکی | جدول نشست | امضا/هش |
|---|---|---|---|
| ادمین | `admin_token` | `admin_sessions` (JWT HS256) | `ADMIN_JWT_SECRET` |
| مشتری (۲۶.۲۵a) | `portal_token` | `customer_portal_sessions` | توکن مات، `sha256` |
| کارمند (۲۸.۴) | `hr_portal_token` | `hr_portal_sessions` | توکن مات، `sha256` |

هر resolver فقط جدول خودش را کوئری می‌کند — یک توکن معتبر از یک پورتال حتی
اگر به‌صورت فیزیکی روی درخواست دیگری فرستاده شود، در جدول دیگر اصلاً پیدا
نمی‌شود (نه اینکه رد شود؛ اصلاً چیزی برای رد کردن پیدا نمی‌کند):

```
✅ 9.  🔴 an EMPLOYEE token is REJECTED by the customer-portal session resolver
✅ 10. 🔴 a CUSTOMER token is REJECTED by the employee-portal session resolver
```

OTP به موبایل ثبت‌شدهٔ کارمند در `hr_employees` ارسال می‌شود (از طریق آداپتور
پیامکی موجود ۲۶.۲۵s) — نه رمز عبور مشترک با حساب ادمین. اگر کارمندی حساب
ادمین هم داشته باشد، دو نشست کاملاً جدا می‌مانند؛ ورود از یکی، دیگری را لمس
نمی‌کند.

---

## 3. 🔴 بند ۲ — ماتریس IDOR (پیش‌نیاز مطلق)

طبق دستور صریح spec، این بند پیش از هر بند دیگری کامل بسته شد چون
همکاران حقوق هم را می‌بینند — بدترین سناریوی ممکن.

هر تابع در `src/lib/hr/portalData.ts` اولین آرگومانش `employeeId` از نشست
سرور است؛ عدم تطابق مالکیت **`null`/فهرست خالی** برمی‌گرداند، هرگز پرتاب
خطا — و هر روت آن را یکنواخت به **۴۰۴** تبدیل می‌کند (هرگز ۴۰۳، تا وجود
رکورد لو نرود، دقیقاً الگوی ۲۶.۲۵a):

```
✅ 16. 🔴 employee A with employee B's payslip id → resolves to null (route → 404, not 403)
✅ 17. 🔴 the reverse also fails — the boundary is symmetric
✅ 19. 🔴 a slip from a NOT-YET-APPROVED period is invisible even to its own owner
✅ 21. 🔴 employee B cannot cancel employee A's leave request (404, not 403)
✅ 23. 🔴 employee B's leave list never contains employee A's request
✅ 25. a request is always filed under the SESSION's employee, structurally
✅ 28. 🔴 employee B never sees employee A's portal request
```

`employeeId` هرگز از بدنه یا کوئری خوانده نمی‌شود — هر route handler آن را
مستقیماً از `identity.employeeId` (خروجی `requireHrPortal`) می‌گیرد؛ حتی اگر
کلاینت آن را در بدنه بفرستد، به‌طور ساختاری نادیده گرفته می‌شود چون امضای
تابع اصلاً پارامتری برایش نمی‌پذیرد.

---

## 4. بند ۴ — مرخصی از مانده

`myLeaveOverview`/`myLeaveRequest` مستقیماً از `leaveBalances`/
`createLeaveRequest` موجود ۲۸.۲ استفاده می‌کنند — بدون کوئری یا منطق موازی.
درخواست فراتر از مانده رد می‌شود، با دلیل صریح نه کوتاه‌سازی خاموش:

```
✅ 26. 🔴 a request beyond the balance is refused with the reason, not silently shortened
       — {"ok":false,"reason":"insufficient_balance","days":87}
```

---

## 5. بند ۵ — درخواست‌های اداری از طریق موتور تأیید واقعی

نوع سند جدید `hr_portal_request` به `DOC_TYPES` موتور تأیید (۲۶.۱۲) اضافه شد
— نه یک چرخهٔ موازی. جدول `hr_portal_requests` فقط وضعیت را از تصمیم موتور
mirror می‌کند (نقطهٔ توسعهٔ موجود `advanceDocument`/`actOnRequest`)، خودِ
موتور تک منبع حقیقت باقی می‌ماند:

```
✅ 29. the request created a real approval_requests row (same engine as everything else)
✅ 30. 🔴 full approval mirrors onto the portal-request row automatically
✅ 31. a rejection mirrors too
```

`ApprovalCenter.tsx` سمت ادمین کاملاً docType-agnostic است — نوع سند جدید
بدون هیچ تغییر UI، خودکار در صندوق تأیید ظاهر می‌شود.

### 🔴 اصلاح اطلاعات فردی — فقط پیشنهاد، هرگز اعمال مستقیم

```
✅ 32. an info-correction request is accepted as a proposal
✅ 33. 🔴 EVEN after full approval, hr_employees.national_id is UNCHANGED
       — HR must apply it by hand
```

تأیید کامل درخواست، تنها وضعیت رکورد پورتال را «approved» می‌کند؛ هیچ کد
مسیری وجود ندارد که مستقیماً `hr_employees` را از این مسیر بنویسد — HR باید
از ویرایشگر کارمند موجود، دستی اعمال کند.

---

## 6. بند ۱ ثبت‌نامی — پیدا کردن کارمند از روی موبایل

`findEmployeeByMobile` فقط کارمندان `active`/`on_leave` را با موبایل
نرمال‌شده جست‌وجو می‌کند؛ موبایل ناشناخته پاسخ خنثی می‌دهد (بدون افشای
وجود/عدم‌وجود):

```
✅ 2. unknown mobile → neutral (no enumeration)
```

---

## 7. جداول جدید (idempotent، هر دو با `company_id`)

- `hr_portal_sessions` — `employee_id`, `channel`, `identifier`, `otp_hash`,
  `otp_expires_at`, `attempts`, `token_hash`, `verified`, `expires_at`,
  `revoked`, `ip`, `company_id`.
- `hr_portal_requests` — `employee_id`, `kind`
  (`certificate|advance|mission|info_correction`), `payload`, `status`,
  `approval_request_id`, `note`, `company_id`.
- یک قانون پیش‌فرض در `approval_matrix` برای `hr_portal_request` seed شد تا
  این نوع سند بی‌صدا auto-approve نشود.

## 8. مسیرهای جدید

`/api/hr-portal/{auth/request,auth/verify,auth/logout,me,payslips,
payslips/[id],payslips/[id]/print,leave,leave/[id],attendance,requests,
profile}` — همه از `requireHrPortal` عبور می‌کنند. صفحهٔ عمومی
`/[locale]/hr-portal` (`noindex`) با `HrPortalApp.tsx`.

## 9. Gates

TS 0 · ESLint 0 · **1147 unit tests** (92 files) · 12 audits 0
(`audit:tenancy` 15/15، `audit:rbac` 164 guarded/0 failures) · build clean ·
**21/21 regression suites** (`npm run regressions`، پرونده جدید
`scripts/verify-28-4-portal.ts` **38/38**).

## 10. تأیید مرورگری

طبق دستور صریح spec، تأیید مرورگری هم‌زمان دو کارمند واقعی، اقدامی است که
باید توسط نگهدارنده روی محیط زنده انجام شود (نیازمند دو شمارهٔ موبایل واقعی
برای دریافت OTP)؛ چرخهٔ کامل (ورود → مشاهدهٔ فیش خود → عدم مشاهدهٔ فیش
همکار → ثبت مرخصی → تأیید مدیر → کاهش مانده → خروج → ابطال نشست) به‌صورت
خودکار در `verify-28-4-portal.ts` روی PostgreSQL واقعی اثبات شده است؛ تأیید
مرورگری دو-کاربره منتظر اجرای پایلوت واقعی نگهدارنده می‌ماند (مشابه بند ۵ در
۲۸.۳-ج).

## 11. خط سیر (Changelog)

- افزوده: `src/lib/hr/portalSession.ts`, `portalGuard.ts`, `portalData.ts`.
- افزوده: `src/app/api/hr-portal/**` (۱۱ مسیر).
- افزوده: `src/app/[locale]/hr-portal/{page.tsx,HrPortalApp.tsx}`.
- افزوده: جدول‌های `hr_portal_sessions`/`hr_portal_requests` در `migrate.ts`.
- افزوده: `hr_portal_request` به `DOC_TYPES` (`approval/matrix.ts`).
- افزوده: `hr_portal_requests` branch در `advanceDocument`/`actOnRequest`
  (`erp/approvalData.ts`).
- افزوده: `hrPortalOtp`/`hrPortalVerify` در `rateLimit.ts`.
- **اصلاح باگ واقعی که سوییت زنده پیدا کرد**: `createLeaveRequest`,
  `approveLeave`, `rejectLeave`, `cancelLeave`, `postLeaveTransaction` و
  `createApprovalRequest` همگی `userId: string` غیرقابل‌تهی داشتند، درحالی‌که
  ستون‌های `created_by`/`decided_by` در `hr_leave_requests`,
  `hr_leave_transactions` و `approval_requests` به `users(id)` ارجاع
  می‌دهند. کد اولیهٔ پورتال یک رشتهٔ ساختگی مثل `` `employee:${id}` `` به‌جای
  شناسهٔ کاربر ادمین پاس می‌داد که با نقض قید کلید خارجی رد می‌شد. اصلاح
  درست، تهی‌پذیر کردن این پارامتر بود (چون ستون‌ها از قبل nullable هستند) و
  پاس‌دادن `null` واقعی برای اقدام خودسرویسِ بدون بازیگر ادمین.
- افزوده: `verify-28-4-portal.ts` به `ci-regressions.ts` (رگرسیون شماره ۱۵).
