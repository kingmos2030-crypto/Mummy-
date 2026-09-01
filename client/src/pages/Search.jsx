import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import MediaCard from '../components/MediaCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui';
import { SOURCE_LABELS, TYPE_LABELS, TYPE_ORDER } from '../lib/constants';
import useSeo from '../lib/seo';

const TYPE_FILTERS = [{ value: 'all', label: 'الكل' }, ...TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }))];

const SUGGESTIONS = ['Interstellar', 'One Piece', 'Breaking Bad', 'Attack on Titan', 'Spirited Away', 'Planet Earth II'];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') || 'all';
  const { toast, bumpLibrary } = useApp();

  const [input, setInput] = useState(q);
  const [state, setState] = useState({ loading: false, results: [], notices: [], degraded: false, sources: [] });
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);
  const abortRef = useRef(null);

  useSeo({
    title: q ? `نتائج البحث عن «${q}»` : 'اكتشف',
    description: q
      ? `نتائج البحث عن ${q} في Mummy شافت — أفلام ومسلسلات وأنمي مع بيانات TMDB وJikan وTVmaze.`
      : 'ابحث عن الأفلام والمسلسلات والأنمي والوثائقيات وأضِفها إلى مكتبتك الشخصية.',
    noIndex: !!q,
  });

  useEffect(() => setInput(q), [q]);

  const runSearch = useCallback(
    (query, mediaType) => {
      if (!query || query.trim().length < 2) {
        setState({ loading: false, results: [], notices: [], degraded: false, sources: [] });
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setState((s) => ({ ...s, loading: true }));
      api
        .search(query.trim(), mediaType, controller.signal)
        .then((data) =>
          setState({
            loading: false,
            results: data.results || [],
            notices: data.notices || [],
            degraded: data.degraded,
            sources: data.sources || [],
          })
        )
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setError(e.message);
          setState((s) => ({ ...s, loading: false }));
        });
    },
    []
  );

  useEffect(() => {
    runSearch(q, type);
    return () => abortRef.current?.abort();
  }, [q, type, runSearch]);

  // debounce while typing
  useEffect(() => {
    if (input === q) return undefined;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (input.trim()) next.set('q', input.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 450);
    return () => clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const setType = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('type');
    else next.set('type', value);
    setParams(next);
  };

  const quickAdd = async (item) => {
    setAdding(item.key);
    try {
      await api.addToLibrary({
        source: item.source,
        sourceType: item.sourceType,
        sourceId: String(item.sourceId),
        status: 'want_to_watch',
      });
      bumpLibrary();
      toast(`أُضيف «${item.title}» إلى قائمة أريد مشاهدته`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAdding(null);
    }
  };

  const grouped = useMemo(() => state.results, [state.results]);

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">اكتشف</h1>
        <p className="mt-1 text-sm text-white/50">
          ابحث بالعنوان الإنجليزي أو العربي أو الأصلي — نُجمّع النتائج من TMDB وJikan وTVmaze ونمنع التكرار.
        </p>
      </header>

      <div className="surface p-3 sm:p-4">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب اسم العمل… مثال: Interstellar / ون بيس"
          className="field text-base"
          aria-label="حقل البحث"
          autoFocus
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setType(f.value)}
              className={`chip cursor-pointer ${type === f.value ? 'chip-brass' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!q && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-white/40">
            <span>جرّب:</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip cursor-pointer" onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {state.degraded && (
        <p className="surface-soft px-4 py-2.5 text-xs text-brass-400">
          تعذّر الوصول إلى المزوّدات الخارجية الآن — تُعرض نتائج من الكتالوج المحلي المحدود. تعمل كل ميزات التتبّع
          بشكل طبيعي.
        </p>
      )}
      {state.notices?.length > 0 && !state.degraded && (
        <p className="surface-soft px-4 py-2.5 text-xs text-white/45">
          {state.notices.map((n) => `${SOURCE_LABELS[n.source] || n.source}: ${n.message}`).join(' • ')}
        </p>
      )}

      {error && <ErrorState message={error} onRetry={() => runSearch(q, type)} />}
      {state.loading && <CardSkeleton count={10} />}

      {!state.loading && !error && q && grouped.length === 0 && (
        <EmptyState
          icon="🔍"
          title={`لا نتائج لـ «${q}»`}
          hint="جرّب كتابة العنوان بالإنجليزية، أو تحقّق من الإملاء، أو غيّر نوع الوسيط."
        />
      )}

      {!state.loading && grouped.length > 0 && (
        <>
          <p className="text-xs text-white/40">
            {grouped.length} نتيجة • المصادر: {(state.sources || []).map((s) => SOURCE_LABELS[s] || s).join(' · ')}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {grouped.map((item) => (
              <MediaCard
                key={item.key}
                width="w-full"
                to={`/discover/${item.source}/${item.sourceType}/${encodeURIComponent(item.sourceId)}`}
                title={item.title}
                originalTitle={item.originalTitle}
                posterUrl={item.posterUrl}
                year={item.releaseYear}
                mediaType={item.mediaType}
                genres={item.genres}
                externalRating={item.externalRating}
                badge={(item.matchedSources || []).map((s) => SOURCE_LABELS[s] || s)[0]}
                onQuickAdd={() => quickAdd(item)}
                quickAddLabel={adding === item.key ? 'جارٍ الإضافة…' : '+ أريد مشاهدته'}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
