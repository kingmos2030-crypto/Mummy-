/** Shared UI vocabulary (Arabic labels for the server's canonical values). */

export const STATUS_LABELS = {
  watched: 'شاهدته',
  watching: 'أشاهده الآن',
  want_to_watch: 'أريد مشاهدته',
  paused: 'متوقف مؤقتًا',
  dropped: 'تركته',
  rewatching: 'إعادة مشاهدة',
};

export const STATUS_ORDER = ['watching', 'want_to_watch', 'watched', 'rewatching', 'paused', 'dropped'];

export const STATUS_COLORS = {
  watched: '#4ade9f',
  watching: '#8b5cf6',
  want_to_watch: '#d4ab5f',
  paused: '#60a5fa',
  dropped: '#f2617a',
  rewatching: '#f0abfc',
};

export const TYPE_LABELS = {
  movie: 'فيلم',
  tv: 'مسلسل',
  anime: 'أنمي',
  cartoon: 'كرتون',
  documentary: 'وثائقي',
  other: 'أخرى',
};

export const TYPE_ORDER = ['movie', 'tv', 'anime', 'cartoon', 'documentary', 'other'];

export const SOURCE_LABELS = {
  tmdb: 'TMDB',
  jikan: 'Jikan / MAL',
  tvmaze: 'TVmaze',
  imdb: 'IMDb',
  offline: 'كتالوج محلي',
};

export const QUALITY_FALLBACK = [
  'CAM',
  'SD',
  '480p',
  '720p',
  '1080p',
  '1080p WEB-DL',
  '1080p Blu-ray',
  '4K',
  '4K HDR',
  'Blu-ray',
];

export const SORT_OPTIONS = [
  { value: 'recently_added', label: 'أضيف حديثًا' },
  { value: 'recently_watched', label: 'شوهد حديثًا' },
  { value: 'rating_desc', label: 'الأعلى تقييمًا' },
  { value: 'rating_asc', label: 'الأقل تقييمًا' },
  { value: 'year_desc', label: 'سنة الإصدار (الأحدث)' },
  { value: 'year_asc', label: 'سنة الإصدار (الأقدم)' },
  { value: 'title', label: 'العنوان (أ - ي)' },
];

export const ACTION_LABELS = {
  added: 'أضيف إلى المكتبة',
  updated: 'تحديث السجل',
  removed: 'حُذف من المكتبة',
  rewatch: 'إعادة مشاهدة',
  episode: 'تحديث حلقة',
  episode_bulk: 'تحديث مجموعة حلقات',
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ar', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} س ${m} د`;
  if (h) return `${h} ساعة`;
  return `${m} دقيقة`;
};

export const formatNumber = (n) => new Intl.NumberFormat('ar-EG').format(n ?? 0);

export const formatRating = (r) =>
  r == null ? null : Number(r).toFixed(Number.isInteger(Number(r)) ? 0 : 2).replace(/0$/, '').replace(/\.$/, '');
