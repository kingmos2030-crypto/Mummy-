import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import PosterArt from '../components/PosterArt';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui';
import { TYPE_LABELS, formatDate, formatRuntime } from '../lib/constants';
import useSeo from '../lib/seo';

export default function Watchlist() {
  const { libraryVersion, bumpLibrary, toast } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useSeo({ title: 'أريد مشاهدته', description: 'قائمة الأعمال التي أنوي مشاهدتها.', noIndex: true });

  const load = useCallback(() => {
    setLoading(true);
    api
      .library({ status: 'want_to_watch', sort: 'recently_added' })
      .then((d) => setEntries(d.entries || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, libraryVersion]);

  const move = async (entry, status) => {
    setBusy(entry.id);
    try {
      await api.updateEntry(entry.id, { status });
      bumpLibrary();
      toast(status === 'watching' ? 'بدأت المشاهدة 🎬' : 'تم وضعه كمشاهد ✅', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`إزالة «${entry.media?.title}» من قائمة أريد مشاهدته؟`)) return;
    setBusy(entry.id);
    try {
      await api.deleteEntry(entry.id);
      bumpLibrary();
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">أريد مشاهدته</h1>
        <p className="mt-1 text-sm text-white/50">{entries.length} عمل بانتظار دورك.</p>
      </header>

      {loading && <CardSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon="🍿"
          title="القائمة فارغة"
          hint="ابحث عن أي عمل واضغط «+ أريد مشاهدته» ليظهر هنا."
          action={
            <Link to="/search" className="btn btn-primary mt-3">
              ابحث الآن
            </Link>
          }
        />
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => {
          const m = entry.media || {};
          return (
            <li key={entry.id} className="surface flex gap-3 p-3">
              <Link to={`/title/${entry.mediaId}`} className="w-16 shrink-0 sm:w-20">
                <PosterArt src={m.posterUrl} title={m.title} alt={m.title} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/title/${entry.mediaId}`}>
                  <h2 className="truncate text-sm font-black" dir="auto">
                    {m.title}
                  </h2>
                </Link>
                <p className="mt-0.5 truncate text-[0.7rem] text-white/45">
                  {[m.releaseYear, TYPE_LABELS[m.mediaType], formatRuntime(m.runtime), (m.genres || [])[0]]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-relaxed text-white/40" dir="auto">
                  {m.overview}
                </p>
                <p className="mt-1 text-[0.62rem] text-white/30">أُضيف: {formatDate(entry.createdAt?.slice(0, 10))}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="chip cursor-pointer chip-plum" disabled={busy === entry.id} onClick={() => move(entry, 'watching')}>
                    ابدأ المشاهدة
                  </button>
                  <button type="button" className="chip cursor-pointer" disabled={busy === entry.id} onClick={() => move(entry, 'watched')}>
                    شاهدته
                  </button>
                  <button type="button" className="chip cursor-pointer text-rose-heart" disabled={busy === entry.id} onClick={() => remove(entry)}>
                    إزالة
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
