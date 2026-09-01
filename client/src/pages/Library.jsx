import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import MediaCard from '../components/MediaCard';
import PosterArt from '../components/PosterArt';
import EntryEditor from '../components/EntryEditor';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui';
import {
  SORT_OPTIONS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  TYPE_LABELS,
  TYPE_ORDER,
  formatDate,
  formatRating,
} from '../lib/constants';
import { entryToCard } from '../components/Shelf';
import useSeo from '../lib/seo';

function ListRow({ entry, onEdit }) {
  const m = entry.media || {};
  return (
    <li className="surface flex items-center gap-3 p-2.5 transition hover:border-brass-500/30">
      <Link to={`/title/${entry.mediaId}`} className="w-14 shrink-0 sm:w-16">
        <PosterArt src={m.posterUrl} title={m.title} alt={m.title} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/title/${entry.mediaId}`} className="block">
          <h3 className="truncate text-sm font-black" dir="auto">
            {m.title}
          </h3>
          <p className="truncate text-[0.7rem] text-white/45">
            {[m.releaseYear, TYPE_LABELS[m.mediaType], (m.genres || [])[0], entry.quality].filter(Boolean).join(' • ')}
          </p>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.65rem]">
          <span className="font-bold" style={{ color: STATUS_COLORS[entry.status] }}>
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.rating != null && <span className="chip chip-brass py-0.5">★ {formatRating(entry.rating)}</span>}
          {entry.isFavorite && <span className="text-rose-heart">❤</span>}
          {entry.progress?.totalEpisodes > 0 && (
            <span className="text-white/40">
              {entry.progress.watchedEpisodes}/{entry.progress.totalEpisodes} حلقة
            </span>
          )}
          {entry.dateFinished && <span className="text-white/30">أنهيته {formatDate(entry.dateFinished)}</span>}
        </div>
      </div>
      <button type="button" className="btn shrink-0 px-2.5 py-1 text-xs" onClick={() => onEdit(entry)}>
        تعديل
      </button>
    </li>
  );
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const { libraryVersion, tags, options } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('mummy:view') || 'grid');
  const [editing, setEditing] = useState(null);

  const filters = useMemo(
    () => ({
      status: params.get('status') || 'all',
      type: params.get('type') || 'all',
      favorite: params.get('favorite') === 'true' ? 'true' : undefined,
      quality: params.get('quality') || '',
      genre: params.get('genre') || '',
      year: params.get('year') || '',
      tagId: params.get('tagId') || '',
      minRating: params.get('minRating') || '',
      q: params.get('q') || '',
      sort: params.get('sort') || 'recently_added',
    }),
    [params]
  );

  useSeo({ title: 'مكتبتي', description: 'مكتبتي الشخصية في Mummy شافت: كل عمل أضفته مع حالته وتقييمي وملاحظاتي.', noIndex: true });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .library(filters)
      .then((data) => setEntries(data.entries || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load, libraryVersion]);

  useEffect(() => localStorage.setItem('mummy:view', view), [view]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const clearAll = () => setParams(new URLSearchParams());

  const genres = useMemo(() => {
    const set = new Set();
    for (const e of entries) for (const g of e.media?.genres || []) set.add(g);
    return [...set].sort();
  }, [entries]);

  const years = useMemo(() => {
    const set = new Set();
    for (const e of entries) if (e.media?.releaseYear) set.add(e.media.releaseYear);
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  const activeFilterCount = ['status', 'type', 'favorite', 'quality', 'genre', 'year', 'tagId', 'minRating', 'q'].filter(
    (k) => params.get(k)
  ).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">مكتبتي</h1>
          <p className="mt-1 text-sm text-white/50">{entries.length} عمل {activeFilterCount ? '(مُصفّى)' : ''}</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={`btn px-3 py-1.5 text-xs ${view === 'grid' ? 'btn-primary' : ''}`} onClick={() => setView('grid')}>
            شبكة
          </button>
          <button type="button" className={`btn px-3 py-1.5 text-xs ${view === 'list' ? 'btn-primary' : ''}`} onClick={() => setView('list')}>
            قائمة
          </button>
        </div>
      </header>

      <div className="surface space-y-3 p-3 sm:p-4">
        <input
          className="field text-sm"
          placeholder="ابحث داخل مكتبتي (العنوان أو الملاحظات)…"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={`chip cursor-pointer ${filters.status === 'all' ? 'chip-brass' : ''}`} onClick={() => setFilter('status', 'all')}>
            كل الحالات
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" onClick={() => setFilter('status', s)} className={`chip cursor-pointer ${filters.status === s ? 'chip-brass' : ''}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={`chip cursor-pointer ${filters.type === 'all' ? 'chip-plum' : ''}`} onClick={() => setFilter('type', 'all')}>
            كل الأنواع
          </button>
          {TYPE_ORDER.map((t) => (
            <button key={t} type="button" onClick={() => setFilter('type', t)} className={`chip cursor-pointer ${filters.type === t ? 'chip-plum' : ''}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter('favorite', filters.favorite ? '' : 'true')}
            className={`chip cursor-pointer ${filters.favorite ? 'chip-brass' : ''}`}
          >
            ❤ المفضلة فقط
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select className="field py-1.5 text-xs" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="الترتيب">
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                ترتيب: {s.label}
              </option>
            ))}
          </select>
          <select className="field py-1.5 text-xs" value={filters.genre} onChange={(e) => setFilter('genre', e.target.value)} aria-label="التصنيف">
            <option value="">كل التصنيفات</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select className="field py-1.5 text-xs" value={filters.quality} onChange={(e) => setFilter('quality', e.target.value)} aria-label="الجودة">
            <option value="">كل الجودات</option>
            {(options.qualities || []).map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <select className="field py-1.5 text-xs" value={filters.year} onChange={(e) => setFilter('year', e.target.value)} aria-label="السنة">
            <option value="">كل السنوات</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select className="field py-1.5 text-xs" value={filters.tagId} onChange={(e) => setFilter('tagId', e.target.value)} aria-label="الوسم">
            <option value="">كل الوسوم</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[0.7rem] text-white/45" htmlFor="minRating">
            أقل تقييم شخصي: {filters.minRating || '0'}
          </label>
          <input
            id="minRating"
            type="range"
            min="0"
            max="10"
            step="0.25"
            value={filters.minRating || 0}
            onChange={(e) => setFilter('minRating', e.target.value === '0' ? '' : e.target.value)}
            className="max-w-xs flex-1 accent-[#d4ab5f]"
          />
          {activeFilterCount > 0 && (
            <button type="button" className="btn px-3 py-1 text-xs" onClick={clearAll}>
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {loading && <CardSkeleton count={12} />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon="📚"
          title={activeFilterCount ? 'لا نتائج مطابقة للفلاتر' : 'مكتبتك فارغة'}
          hint={activeFilterCount ? 'جرّب تخفيف الفلاتر أو مسحها.' : 'ابحث عن عمل وأضِفه لتبدأ رحلتك.'}
          action={
            <Link to="/search" className="btn btn-primary mt-3">
              اذهب للبحث
            </Link>
          }
        />
      )}

      {!loading && entries.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {entries.map((entry) => (
            <MediaCard key={entry.id} width="w-full" {...(({ cardId, ...rest }) => rest)(entryToCard(entry))} />
          ))}
        </div>
      )}

      {!loading && entries.length > 0 && view === 'list' && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <ListRow key={entry.id} entry={entry} onEdit={setEditing} />
          ))}
        </ul>
      )}

      <EntryEditor
        open={!!editing}
        onClose={() => setEditing(null)}
        media={editing?.media}
        entry={editing}
        onSaved={() => load()}
        onDeleted={() => load()}
      />
    </div>
  );
}
