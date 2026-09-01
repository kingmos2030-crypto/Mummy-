import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import Shelf from '../components/Shelf';
import MediaCard from '../components/MediaCard';
import { CardSkeleton, ErrorState } from '../components/ui';
import { formatNumber } from '../lib/constants';
import useSeo from '../lib/seo';

function StatPill({ value, label, to }) {
  const body = (
    <div className="surface-soft px-3 py-3 text-center transition hover:border-brass-500/40">
      <div className="text-xl font-black text-brass-400 tabular-nums sm:text-2xl">{formatNumber(value)}</div>
      <div className="mt-0.5 text-[0.68rem] text-white/55">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Home() {
  const { libraryVersion } = useApp();
  const [data, setData] = useState(null);
  const [discover, setDiscover] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .home()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, libraryVersion]);

  useEffect(() => {
    api.trending().then(setDiscover).catch(() => setDiscover(null));
  }, []);

  useSeo({
    title: 'الرئيسية',
    description:
      'Mummy شافت — كل ما شاهدته، وكل ما أشاهده، وكل ما أنوي مشاهدته. مكتشف أعمال ومتتبّع شخصي للأفلام والمسلسلات والأنمي.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Mummy شافت',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${window.location.origin}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  });

  const totals = data?.summary || {};
  const rows = data?.rows || {};
  const isEmpty = !loading && (data?.summary?.total ?? 0) === 0;

  return (
    <div className="space-y-8">
      <section className="surface relative overflow-hidden px-5 py-8 sm:px-10 sm:py-12 animate-rise">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-plum-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-brass-500/15 blur-3xl" />
        <div className="relative">
          <p className="chip chip-brass">مكتشف + متتبّع + يوميات شخصية</p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            <span className="title-gradient">Mummy</span> <span className="text-white">شافت</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60 sm:text-base">
            كل ما شاهدته، وكل ما أشاهده، وكل ما أنوي مشاهدته — في مكان واحد.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/search" className="btn btn-primary">
              ابدأ الاكتشاف
            </Link>
            <Link to="/library" className="btn">
              مكتبتي
            </Link>
            <Link to="/stats" className="btn btn-ghost">
              إحصائياتي
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatPill value={totals.total} label="إجمالي الأعمال" to="/library" />
            <StatPill value={totals.watched} label="شاهدتها" to="/library?status=watched" />
            <StatPill value={totals.watching} label="أشاهدها الآن" to="/library?status=watching" />
            <StatPill value={totals.wantToWatch} label="أريد مشاهدتها" to="/watchlist" />
            <StatPill value={totals.favorites} label="مفضّلة" to="/library?favorite=true" />
            <StatPill value={totals.episodesWatched} label="حلقات شوهدت" to="/stats" />
          </div>
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading && (
        <div className="space-y-5">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!loading && !error && (
        <>
          {isEmpty && (
            <section className="surface px-5 py-8 text-center animate-fade">
              <h2 className="text-lg font-black">مكتبتك فارغة… لنبدأ</h2>
              <p className="mx-auto mt-1 max-w-lg text-sm text-white/50">
                ابحث عن أي فيلم أو مسلسل أو أنمي، افتح صفحته، ثم أضِفه إلى مكتبتك وسجّل تجربتك: الحالة، تقييمك،
                الجودة، وملاحظاتك.
              </p>
              <Link to="/search" className="btn btn-primary mt-4">
                ابحث الآن
              </Link>
            </section>
          )}

          <Shelf
            title="أشاهده الآن"
            subtitle="أعمال بدأتها ولم أنهها بعد"
            entries={rows.currentlyWatching}
            moreTo="/library?status=watching"
            emptyHint={isEmpty ? null : 'لا يوجد عمل قيد المشاهدة حاليًا.'}
          />
          <Shelf
            title="أكمل المشاهدة"
            subtitle="مسلسلات وأنمي لديها حلقات متبقية"
            entries={rows.continueWatching}
            badgeFor={(e) => (e.progress?.nextEpisode ? `التالي: ح${e.progress.nextEpisode.episodeNumber}` : null)}
          />
          <Shelf title="أريد مشاهدته" entries={rows.wantToWatch} moreTo="/watchlist" />
          <Shelf title="شاهدته مؤخرًا" entries={rows.recentlyWatched} moreTo="/library?status=watched" />
          <Shelf title="المفضلة ❤" entries={rows.favorites} moreTo="/library?favorite=true" />
          <Shelf title="الأعلى تقييمًا عندي" entries={rows.highestRated} moreTo="/library?sort=rating_desc" />
          <Shelf title="أُضيف حديثًا" entries={rows.recentlyAdded} moreTo="/library" />
        </>
      )}

      {discover && (
        <div className="space-y-7">
          <div className="animate-rise">
            <h2 className="text-lg font-black sm:text-xl">اكتشف أعمالًا جديدة</h2>
            <p className="text-xs text-white/45">
              {discover.degraded
                ? 'مقترحات من الكتالوج المحلي (تعذّر الوصول للمزوّدات الخارجية).'
                : 'الأكثر رواجًا الآن حسب TMDB وJikan.'}
            </p>
          </div>
          <DiscoveryShelf title="رائج الآن" items={discover.trending} />
          <DiscoveryShelf title="أفلام رائجة" items={discover.popularMovies} />
          <DiscoveryShelf title="مسلسلات رائجة" items={discover.popularTV} />
          <DiscoveryShelf title="أنمي رائج" items={discover.anime} />
        </div>
      )}
    </div>
  );
}

function DiscoveryShelf({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <section className="animate-rise">
      <h3 className="mb-2.5 text-base font-black sm:text-lg">{title}</h3>
      <div className="scroll-row">
        {items.slice(0, 20).map((item) => (
          <MediaCard
            key={item.key}
            to={`/discover/${item.source}/${item.sourceType}/${encodeURIComponent(item.sourceId)}`}
            title={item.title}
            originalTitle={item.originalTitle}
            posterUrl={item.posterUrl}
            year={item.releaseYear}
            mediaType={item.mediaType}
            genres={item.genres}
            externalRating={item.externalRating}
          />
        ))}
      </div>
    </section>
  );
}
