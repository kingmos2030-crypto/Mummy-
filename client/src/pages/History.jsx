import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import PosterArt from '../components/PosterArt';
import { BlockSkeleton, EmptyState, ErrorState } from '../components/ui';
import { ACTION_LABELS, STATUS_LABELS, formatDateTime, formatRating } from '../lib/constants';
import useSeo from '../lib/seo';

function describe(item) {
  const d = item.details || {};
  switch (item.action) {
    case 'added':
      return `أُضيف بحالة: ${STATUS_LABELS[d.status] || d.status || '—'}`;
    case 'updated':
      return [
        d.from && d.to && d.from !== d.to ? `${STATUS_LABELS[d.from] || d.from} ← ${STATUS_LABELS[d.to] || d.to}` : null,
        d.rating != null ? `تقييم: ${formatRating(d.rating)}` : null,
      ]
        .filter(Boolean)
        .join(' • ') || 'تحديث بيانات';
    case 'episode':
      return `م${d.season}·ح${d.episode} → ${d.status === 'watched' ? 'مشاهدة' : d.status === 'watching' ? 'قيد المشاهدة' : 'غير مشاهدة'}`;
    case 'episode_bulk':
      return `تعليم ${d.count} حلقة حتى ${d.upTo}`;
    case 'rewatch':
      return `إجمالي الإعادات: ${d.count}`;
    default:
      return '';
  }
}

export default function History() {
  const { libraryVersion } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useSeo({ title: 'سجل المشاهدة', description: 'سجل نشاطي الشخصي داخل Mummy شافت.', noIndex: true });

  const load = useCallback(() => {
    setLoading(true);
    api
      .history(120)
      .then((d) => setItems(d.history || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, libraryVersion]);

  if (loading) return <BlockSkeleton height={320} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">سجل المشاهدة</h1>
        <p className="mt-1 text-sm text-white/50">كل تغيير تقوم به يُسجَّل هنا تلقائيًا.</p>
      </header>

      {!items.length && <EmptyState icon="🕘" title="لا يوجد نشاط بعد" hint="ابدأ بإضافة عمل أو تتبّع حلقة." />}

      <ol className="relative space-y-2 border-white/10 ps-4 sm:border-s">
        {items.map((item) => (
          <li key={item.id} className="surface flex items-center gap-3 p-2.5">
            {item.mediaId ? (
              <Link to={`/title/${item.mediaId}`} className="w-11 shrink-0">
                <PosterArt src={item.posterUrl} title={item.mediaTitle || '?'} alt={item.mediaTitle || ''} />
              </Link>
            ) : (
              <div className="w-11 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold" dir="auto">
                {item.mediaTitle || 'عمل محذوف'}
              </p>
              <p className="truncate text-[0.7rem] text-white/50">
                <span className="text-brass-400">{ACTION_LABELS[item.action] || item.action}</span>
                {describe(item) ? ` — ${describe(item)}` : ''}
              </p>
            </div>
            <time className="shrink-0 text-[0.62rem] text-white/35">{formatDateTime(item.createdAt)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
