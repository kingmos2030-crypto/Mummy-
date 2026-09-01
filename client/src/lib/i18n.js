/**
 * Chrome-level i18n (Arabic default / English optional).
 *
 * Scope: the application shell (navigation, common buttons, settings) — the
 * content pages are Arabic-first editorial copy. The dictionary is designed
 * to grow; anything not listed falls back to Arabic.
 */

export const LANGUAGES = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
];

const AR = {
  'nav.home': 'الرئيسية',
  'nav.discover': 'اكتشف',
  'nav.library': 'مكتبتي',
  'nav.watchlist': 'أريد مشاهدته',
  'nav.watchlist.short': 'قائمتي',
  'nav.favorites': 'المفضلة',
  'nav.stats': 'إحصائياتي',
  'nav.stats.short': 'إحصائي',
  'nav.profile': 'ملفي',
  'nav.history': 'سجل المشاهدة',
  'nav.tags': 'الوسوم',
  'nav.settings': 'الإعدادات',
  'nav.main': 'التنقل الرئيسي',
  'nav.mobile': 'تنقل الجوال',
  'nav.more': 'قائمة إضافية',
  'search.placeholder': 'ابحث عن فيلم، مسلسل، أنمي…',
  'search.label': 'ابحث عن عمل',
  'search.submit': 'بحث',
  'a11y.skip': 'تخطَّ إلى المحتوى',
  'footer.line1':
    'Mummy شافت — مكتشف ومتتبّع شخصي للأعمال. لا يستضيف هذا الموقع أي ملفات فيديو أو روابط مشاهدة؛ يعرض بيانات عامة فقط.',
  'footer.line2': 'مصادر البيانات: TMDB · Jikan (MyAnimeList) · TVmaze — هذا المشروع غير تابع أو معتمد من أيٍّ منها.',

  'settings.title': 'الإعدادات',
  'settings.subtitle': 'الملف الشخصي، المظهر، اللغة، إدارة الوسوم، وتصدير المكتبة.',
  'settings.profile': 'الملف الشخصي',
  'settings.displayName': 'الاسم المعروض',
  'settings.bio': 'النبذة',
  'settings.avatarUrl': 'رابط صورة الملف',
  'settings.avatarHint': 'ضع رابط صورة عام (لا يوجد رفع ملفات). اتركه فارغًا لاستخدام الحرف الأول.',
  'settings.save': 'حفظ',
  'settings.saved': 'تم الحفظ بنجاح',
  'settings.appearance': 'المظهر واللغة',
  'settings.theme': 'السمة',
  'settings.theme.cinema': 'سينمائي (افتراضي)',
  'settings.theme.midnight': 'أسود منتصف الليل (OLED)',
  'settings.language': 'اللغة',
  'settings.languageHint': 'تغيّر لغة واتجاه واجهة التطبيق (التنقل والإعدادات).',
  'settings.tracking': 'خيارات التتبّع',
  'settings.qualities': 'الجودات المتاحة عند التسجيل',
  'settings.qualitiesHint': 'تُدار هذه القائمة من الخادم (ثابتة) وتظهر في نموذج «تجربتي».',
  'settings.statuses': 'الحالات المتاحة',
  'settings.tags': 'إدارة الوسوم',
  'settings.tagsHint': 'وسومك الخاصة لتصنيف أعمالك.',
  'settings.tagsManage': 'إدارة كاملة للوسوم ←',
  'settings.export': 'تصدير المكتبة',
  'settings.exportHint': 'حمّل بياناتك الشخصية فقط (الحالة، التقييم، الجودة، الملاحظات، التواريخ) — لا يشمل أي محتوى محميّ.',
  'settings.exportJson': 'تنزيل JSON',
  'settings.exportCsv': 'تنزيل CSV',
  'settings.about': 'حول وإسناد',
  'settings.aboutBody':
    'Mummy شافت موقع اكتشاف وتتبّع شخصي فقط: لا يستضيف ولا يبثّ ولا يحمّل أي أفلام أو حلقات أو ملفات فيديو، ولا يوفّر روابط مشاهدة أو تحميل أو تورنت.',
  'settings.aboutTmdb': 'بيانات وصور الأفلام والمسلسلات من TMDB (themoviedb.org) — هذا المنتج يستخدم TMDB API لكنه غير معتمد أو مصادق عليه من TMDB.',
  'settings.aboutAnime': 'بيانات الأنمي من Jikan / MyAnimeList، وبيانات المسلسلات الإضافية من TVmaze (شروط CC BY-SA).',
  'settings.loading': 'جارٍ تحميل الإعدادات…',
};

const EN = {
  'nav.home': 'Home',
  'nav.discover': 'Discover',
  'nav.library': 'My Library',
  'nav.watchlist': 'Want to Watch',
  'nav.watchlist.short': 'Watchlist',
  'nav.favorites': 'Favorites',
  'nav.stats': 'My Stats',
  'nav.stats.short': 'Stats',
  'nav.profile': 'My Profile',
  'nav.history': 'Watch History',
  'nav.tags': 'Tags',
  'nav.settings': 'Settings',
  'nav.main': 'Main navigation',
  'nav.mobile': 'Mobile navigation',
  'nav.more': 'More',
  'search.placeholder': 'Search movies, TV, anime…',
  'search.label': 'Search for a title',
  'search.submit': 'Search',
  'a11y.skip': 'Skip to content',
  'footer.line1':
    'Mummy Shaft — a personal media discovery & tracking journal. This site hosts no video files or streaming links; it shows public metadata only.',
  'footer.line2': 'Data sources: TMDB · Jikan (MyAnimeList) · TVmaze — this project is not affiliated with or endorsed by any of them.',

  'settings.title': 'Settings',
  'settings.subtitle': 'Profile, appearance, language, tag management, and library export.',
  'settings.profile': 'Profile',
  'settings.displayName': 'Display name',
  'settings.bio': 'Bio',
  'settings.avatarUrl': 'Avatar image URL',
  'settings.avatarHint': 'Paste a public image URL (no file uploads). Leave empty to use your initial.',
  'settings.save': 'Save',
  'settings.saved': 'Saved successfully',
  'settings.appearance': 'Appearance & language',
  'settings.theme': 'Theme',
  'settings.theme.cinema': 'Cinema (default)',
  'settings.theme.midnight': 'Midnight black (OLED)',
  'settings.language': 'Language',
  'settings.languageHint': 'Changes the app shell language and direction (navigation & settings).',
  'settings.tracking': 'Tracking options',
  'settings.qualities': 'Available watched qualities',
  'settings.qualitiesHint': 'Managed server-side (fixed list) and shown inside the "My Experience" form.',
  'settings.statuses': 'Available statuses',
  'settings.tags': 'Tag management',
  'settings.tagsHint': 'Your custom tags for organizing the library.',
  'settings.tagsManage': 'Full tag manager →',
  'settings.export': 'Export library',
  'settings.exportHint': 'Download your personal tracking data only (status, rating, quality, notes, dates) — no copyrighted content.',
  'settings.exportJson': 'Download JSON',
  'settings.exportCsv': 'Download CSV',
  'settings.about': 'About & credits',
  'settings.aboutBody':
    'Mummy Shaft is a personal discovery & tracking site only: it does not host, stream, upload, or download any movies, episodes, or video files, and provides no watch/download/torrent links.',
  'settings.aboutTmdb':
    'Movie & TV data/images from TMDB (themoviedb.org) — this product uses the TMDB API but is not endorsed or certified by TMDB.',
  'settings.aboutAnime': 'Anime data from Jikan / MyAnimeList; additional TV metadata from TVmaze (CC BY-SA terms).',
  'settings.loading': 'Loading settings…',
};

export const DICTS = { ar: AR, en: EN };

export function makeTranslator(lang) {
  const dict = DICTS[lang] || AR;
  return (key) => dict[key] ?? AR[key] ?? key;
}

export const dirOf = (lang) => (LANGUAGES.find((l) => l.code === lang)?.dir || 'rtl');
