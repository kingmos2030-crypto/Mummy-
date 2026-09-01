# Mummy شافت 🎬

**مكتشف وسائط بأسلوب IMDb + متتبّع شخصي + يوميات مشاهدة.**
كل ما شاهدته، وكل ما أشاهده، وكل ما أنوي مشاهدته.

> ⚠️ هذا الموقع **لا يستضيف ولا يبثّ ولا يرفع** أي أفلام أو حلقات أو ملفات فيديو،
> ولا يوفّر روابط مشاهدة أو تحميل أو تورنت. يعرض **بيانات عامة وصورًا** من
> TMDB / Jikan / TVmaze — تمامًا كما تفعل IMDb — ويضيف فوقها **بياناتك الشخصية** فقط.

---

## ما الذي يقدّمه

| المجال | التفاصيل |
| --- | --- |
| اكتشاف | بحث موحّد عبر TMDB + Jikan + TVmaze، بالعربية أو الإنجليزية أو العنوان الأصلي، مع **تسامح مع الأخطاء الإملائية** (interstelar ← Interstellar)، دمج النتائج عبر المعرّفات الخارجية ومنع التكرار |
| صفحة العمل | بوستر/خلفية، عنوان أصلي، سنة، تصنيفات، مدة، قصة، طاقم، إخراج/كتابة/إنتاج، شركات، دول، لغات، تقييم خارجي، مواسم/حلقات، إعلانات، **أعمال مشابهة**، معرّفات خارجية |
| تجربتي | الحالة (شاهدته / أشاهده / أريد مشاهدته / متوقف / تركته / إعادة مشاهدة)، تقييمي 0→10 بخطوة **0.25**، الجودة، المفضلة ❤، الملاحظات، تواريخ البدء/الانتهاء/آخر مشاهدة، عدّاد الإعادات، وسوم مخصّصة |
| تتبّع الحلقات | حالة لكل حلقة، «تعليم حتى هنا»، موسم كامل، نسبة التقدّم مع شريط جميل، الحلقة التالية، «أكمل المشاهدة»، وتحديث حالة العمل تلقائيًا |
| مكتبتي | عرض شبكة/قائمة + فلاتر (نوع، حالة، تقييم، مفضلة، تصنيف، جودة، سنة، وسم، بحث نصّي) + 7 طرق ترتيب + صفحة «مفضلتي» |
| الإحصائيات | إجماليات، حالات، أنواع، تصنيفات، سنوات، جودات، توزيع التقييمات، إنجاز شهري، الأعلى/الأدنى تقييمًا، وقت مشاهدة تقريبي (رسوم تفاعلية) |
| الملف الشخصي | صورة، اسم، نبذة، إحصائيات كاملة، أحدث ما شوهد، الأعلى تقييمًا، المفضلة، أكثر التصنيفات |
| الإعدادات | ملف شخصي، سمة (سينمائي / أسود OLED)، لغة الواجهة (عربي RTL / English LTR)، الجودات، الوسوم، تصدير JSON/CSV، صفحة إسناد |
| إضافي | سجل نشاط تلقائي، تصدير JSON + CSV، sitemap/robots/JSON-LD، تصميم داكن سينمائي RTL أولًا |

---

## التشغيل محليًا

```bash
git clone <repo> && cd Mummy-
npm run install:all          # تثبيت الخادم والواجهة
cp .env.example .env         # ثم ضع مفتاح TMDB (مُوصى به بشدة)
npm run dev                  # الخادم على :5000 والواجهة على :3000
```

افتح <http://localhost:3000>.

> لا يوجد أي تثبيت لقاعدة بيانات — تُنشأ تلقائيًا كملف libSQL مضمّن (`database.sqlite`).

بيانات تجريبية اختيارية (شغّلها والخادم **متوقف**، ثم شغّل الخادم):

```bash
npm run seed:demo            # أو: npm run seed:demo -- --reset
```

الاختبارات:

```bash
npm test                     # 20 اختبار API + 10 اختبارات واجهة
```

بناء وتشغيل الإنتاج محليًا (الخادم يقدّم الواجهة من `client/dist`):

```bash
npm run build && npm start   # http://localhost:5000
```

---

## النشر على Vercel (الإعداد المتوقع)

المشروع جاهز: `vercel.json` + دوال serverless في `api/`. قاعدة البيانات في السحابة
= أي قاعدة متوافقة مع SQLite عبر HTTP — أسهل خيار مجاني هو **Turso**.

### الخطوة 1 — أنشئ قاعدة Turso مجانية (مرة واحدة)

```bash
# الخيار أ: من الموقع https://turso.tech ← New Database ← انسخ URL + Token
# الخيار ب: من الطرفية
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create mummy-shaft
turso db show --url mummy-shaft          # libsql://mummy-shaft-xxx.turso.io
turso db tokens create mummy-shaft       # eyJhbGciOi...
```

### الخطوة 2 — اربط المستودع بـ Vercel

1. لوحة Vercel ← **Add New… → Project** ← استورد هذا المستودع. لا حاجة لأي إعداد
   إضافي (الإطار: *Other* — يُقرأ من `vercel.json`).
2. **Settings → Environment Variables** أضف:

| المتغيّر | القيمة | مطلوب؟ |
| --- | --- | --- |
| `DATABASE_URL` | `libsql://mummy-shaft-xxx.turso.io` | ✅ مطلوب |
| `DATABASE_AUTH_TOKEN` | رمز Turso | ✅ مطلوب |
| `TMDB_API_KEY` | مفتاح TMDB v3 | مُوصى به بشدة |
| `SITE_URL` | `https://your-app.vercel.app` | بعد أول نشر (للـ sitemap) |
| `OWNER_USERNAME` / `OWNER_DISPLAY_NAME` | اختياري | لا |

3. **Deploy**. أول طلب ينشئ الجداول والمستخدم تلقائيًا — لا خطوات هجرة يدوية.

بعد النشر جرّب: `https://<app>.vercel.app/api/health` يجب أن يعرض `"db":"remote"`.

### كيف يعمل التوجيه على Vercel؟

```
/                     → الواجهة الساكنة (client/dist, مع SPA fallback)
/assets/*             → ملفات Vite (تخزين مؤقت immutable لسنة)
/robots.txt           → الدالة /api/seo/robots
/sitemap.xml          → الدالة /api/seo/sitemap
/api/*                → دالة Express واحدة (api/[...all].js)
```

### بدائل الاستضافة

- **VPS / Fly.io / Render / Railway**: `npm run build` ثم `npm start` مع قرص دائم —
  تُستخدم قاعدة الملف المضمّنة تلقائيًا (دون `DATABASE_URL`).
- أي مزوّد Node ≥ 20: نفس الأمران أعلاه.

---

## المفاتيح ومتغيّرات البيئة

كل الأسرار على الخادم فقط — **لا يوجد أي مفتاح داخل حزمة المتصفح**
(لا نستخدم أي متغيّر `VITE_*` إطلاقًا).

| المتغيّر | مطلوب؟ | الوصف |
| --- | --- | --- |
| `DATABASE_URL` | للنشر | `libsql://…`/`https://…` للتخزين البعيد (Turso). محليًا يمكن أن يكون `file:` |
| `DATABASE_AUTH_TOKEN` | للنشر | رمز قاعدة البيانات البعيدة (`TURSO_AUTH_TOKEN` يعمل أيضًا) |
| `DATABASE_PATH` | لا | مسار الملف المحلي (افتراضي `./database.sqlite`) |
| `TMDB_API_KEY` | مُوصى به | مفتاح TMDB v3 المجاني (بدونه تُعطَّل نتائج TMDB الحيّة) |
| `TMDB_ACCESS_TOKEN` | بديل | توكن v4 بدلًا من المفتاح |
| `TMDB_LANGUAGE` | لا | الافتراضي `ar-SA` مع رجوع تلقائي للإنجليزية |
| `PORT` | لا | المنفذ للتشغيل الذاتي (افتراضي 5000) |
| `OWNER_USERNAME` / `OWNER_DISPLAY_NAME` | لا | ملف المالك الافتراضي |
| `CACHE_*_TTL_MS`, `EXTERNAL_TIMEOUT_MS` | لا | ضبط الكاش والمهلات |
| `ALLOW_OFFLINE_CATALOG` | لا | تفعيل الكتالوج الاحتياطي عند تعذّر الشبكة |
| `SITE_URL` | للنشر | يُستخدم في `sitemap.xml` و`robots.txt` |

**Jikan وTVmaze لا يحتاجان أي مفتاح** (واجهات عامة بدون مصادقة).

الحصول على مفتاح TMDB: حساب مجاني على themoviedb.org ← Settings ← API ← Developer.

---

## البنية

```
server/
  config.js            إعدادات + قراءة .env
  db/                  client.js (libSQL: ملف محلي أو HTTPS بعيد) · index.js (المخطط + المستخدم)
  lib/                 http · cache · normalize · validation
  providers/           tmdb · jikan · tvmaze · offline (احتياطي)
  services/            discovery (دمج المزوّدات + fuzzy) · library (بياناتي) · stats
  routes/              discover · library · meta
  index.js             Express app + robots/sitemap + خدمة الواجهة المبنية
api/                   نقاط دخول Vercel serverless (نفس تطبيق Express)
client/src/
  pages/               Home · Search · Title · Library · Watchlist · Stats · Profile · History · Tags · Settings
  components/          Layout · MediaCard · PosterArt · Shelf · RatingInput · EntryEditor · EpisodeTracker · ui
  lib/                 seo · i18n · constants · api/client.js (كل النداءات عبر /api فقط)
scripts/seed-demo.js   بيانات تجريبية اختيارية
test/                  api.test.js · ui.smoke.test.js (30 اختبارًا)
vercel.json            build + تمريرات SPA/SEO + ترويسات الكاش
docs/ARCHITECTURE.md   خطة البنية الكاملة
```

---

## قاعدة البيانات

محرّك واحد (libSQL) بمسارَين:

| البيئة | النقل | الإعداد |
| --- | --- | --- |
| محلي | ملف مضمّن `file:` | لا شيء — يُنشأ تلقائيًا |
| Vercel/سيرفرلس | HTTPS إلى Turso | `DATABASE_URL` + `DATABASE_AUTH_TOKEN` |

المخطط يفصل صارمًا بين **مرآة البيانات الخارجية** (media + media_sources + seasons +
episodes + api_cache — قابلة للحذف وإعادة البناء) و**البيانات الشخصية**
(personal_entries + watch_progress + viewing_history + tags — المصدر الوحيد للحقيقة).
منع التكرار عبر جدول `media_sources` بمفتاح فريد لكل (مصدر، نوع، معرّف).
كل الاستعلامات مُجمَّعة (batched) لتقليل الجولات عند التخزين البعيد.

---

## حدود الطبقة المجانية

- **TMDB**: مجاني للاستخدام غير التجاري مع إسناد إلزامي (موجود في التذييل وصفحة الإعدادات).
- **Jikan**: ~3 طلبات/ثانية و60/دقيقة — التطبيق يطبّق throttle وكاش تلقائيًا.
- **TVmaze**: ~20 طلب/10 ثوانٍ.
- **Turso**: الطبقة المجانية تكفي تمامًا لمستخدم واحد (حدود سخية بواقع آلاف الطلبات/يوم).
- **الصور**: تُحمَّل من مزوّداتها مباشرة (لا تخزين ولا تكلفة).
- عند تعذّر الوصول لكل المزوّدات يتحوّل الموقع تلقائيًا إلى **كتالوج محلي محدود** مع تنبيه واضح.

## الترخيص والإسناد

هذا المشروع غير تابع لـ TMDB أو MyAnimeList/Jikan أو TVmaze. البيانات والصور مملوكة
لأصحابها وتُعرض وفق شروط الاستخدام العامة لكل مزوّد (TMDB: إسناد إلزامي،
TVmaze: CC BY-SA). لا يوجد أي محتوى محميّ داخل المشروع أو قاعدة بياناته.
