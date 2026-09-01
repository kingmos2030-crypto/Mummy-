import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import PosterArt from '../components/PosterArt';
import MediaCard from '../components/MediaCard';
import EntryEditor from '../components/EntryEditor';
import EpisodeTracker from '../components/EpisodeTracker';
import { BlockSkeleton, ErrorState } from '../components/ui';
import {
  SOURCE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  TYPE_LABELS,
  formatDate,
  formatNumber,
  formatRating,
  formatRuntime,
} from '../lib/constants';
import useSeo from '../lib/seo';

function Section({ title, children, aside }) {
  if (!children) return null;
  return (
    <section className="surface p-4 sm:p-5 animate-rise">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-black sm:text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PersonChips({ people = [], emptyText }) {
  if (!people.length) return <p className="text-xs text-white/40">{emptyText}</p>;
  return (
    <ul className="scroll-row">
      {people.map((p, i) => (
        <li key={`${p.name}-${i}`} className="w-24 text-center sm:w-28">
          <PosterArt src={p.image} title={p.name} alt={p.name} ratio="1 / 1" rounded="999px" className="mx-auto w-16 sm:w-20" />
          <p className="mt-1.5 line-clamp-2 text-[0.7rem] font-bold leading-tight" dir="auto">
            {p.name}
          </p>
          {(p.character || p.job) && (
            <p className="line-clamp-2 text-[0.62rem] text-white/40" dir="auto">
              {p.character || p.job}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Title() {
  const { mediaId, source, type, sourceId } = useParams();
  const { toast, bumpLibrary } = useApp();
  const [data, setData] = useState(null);
  const [entry, setEntry] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setSimilar([]);
    const promise = mediaId
      ? api.internalDetails(mediaId)
      : api.externalDetails(source, type, decodeURIComponent(sourceId));
    promise
      .then((res) => {
        setData(res);
        setEntry(res.entry);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mediaId, source, type, sourceId]);

  useEffect(load, [load]);

  // IMDb-style "more like this" — loaded lazily, optional by design
  useEffect(() => {
    const promise = mediaId
      ? api.similarInternal(mediaId)
      : api.similarExternal(source, type, decodeURIComponent(sourceId));
    promise
      .then((res) => setSimilar(res.items || []))
      .catch(() => setSimilar([]));
  }, [mediaId, source, type, sourceId]);

  const media = data?.media;

  useSeo({
    title: media ? `${media.title}${media.releaseYear ? ` (${media.releaseYear})` : ''}` : 'تفاصيل العمل',
    description: media?.overview?.slice(0, 180) || 'صفحة تفاصيل العمل في Mummy شافت.',
    image: media?.backdropUrl || media?.posterUrl || undefined,
    type: 'article',
    jsonLd: media
      ? {
          '@context': 'https://schema.org',
          '@type': media.mediaType === 'movie' ? 'Movie' : 'TVSeries',
          name: media.title,
          alternateName: media.originalTitle || undefined,
          image: media.posterUrl || undefined,
          description: media.overview || undefined,
          datePublished: media.releaseDate || undefined,
          genre: media.genres,
          aggregateRating: media.externalRating
            ? {
                '@type': 'AggregateRating',
                ratingValue: media.externalRating,
                ratingCount: media.externalVotes || 1,
                bestRating: 10,
              }
            : undefined,
        }
      : undefined,
  });

  const quickStatus = async (status) => {
    if (!media) return;
    setBusy(true);
    try {
      const result = entry?.id
        ? await api.updateEntry(entry.id, { status })
        : await api.addToLibrary({ internalId: media.id, status });
      setEntry(result.entry);
      bumpLibrary();
      toast(`الحالة الآن: ${STATUS_LABELS[status]}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!media) return;
    setBusy(true);
    try {
      const result = entry?.id
        ? await api.updateEntry(entry.id, { isFavorite: !entry.isFavorite })
        : await api.addToLibrary({ internalId: media.id, status: 'want_to_watch', isFavorite: true });
      setEntry(result.entry);
      bumpLibrary();
      toast(result.entry.isFavorite ? 'أُضيف إلى المفضلة ❤' : 'أُزيل من المفضلة', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const addRewatch = async () => {
    if (!entry?.id) return;
    setBusy(true);
    try {
      const result = await api.rewatch(entry.id, 1);
      setEntry(result.entry);
      bumpLibrary();
      toast('تم تسجيل إعادة مشاهدة', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <BlockSkeleton height={300} />
        <BlockSkeleton height={140} />
        <BlockSkeleton height={180} />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!media) return <ErrorState message="لم يتم العثور على العمل." />;

  const directors = media.crew?.filter((c) => ['Director', 'Creator'].includes(c.job)) || [];
  const writers = media.crew?.filter((c) => ['Writer', 'Screenplay', 'Story'].includes(c.job)) || [];
  const producers = media.crew?.filter((c) => (c.job || '').includes('Producer')) || [];
  const isEpisodic = media.mediaType !== 'movie';

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ hero */}
      <section className="surface relative overflow-hidden animate-fade">
        <div className="absolute inset-0">
          {media.backdropUrl ? (
            <img src={media.backdropUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-25" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-gradient-to-bl from-plum-500/20 via-transparent to-brass-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/40" />
        </div>

        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6">
          <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-44">
            <PosterArt src={media.posterUrl} title={media.title} alt={media.title} className="shadow-2xl ring-1 ring-white/15" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip chip-plum">{TYPE_LABELS[media.mediaType] || media.mediaType}</span>
              {media.status && <span className="chip">{media.status}</span>}
              <span className="chip">{SOURCE_LABELS[media.source] || media.source}</span>
              {data.meta?.degraded && <span className="chip chip-brass">بيانات محلية</span>}
            </div>

            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl" dir="auto">
              {media.title}
            </h1>
            {media.originalTitle && media.originalTitle !== media.title && (
              <p className="mt-0.5 text-sm text-white/45" dir="auto">
                {media.originalTitle}
              </p>
            )}
            {media.tagline && <p className="mt-1 text-sm italic text-brass-400/80" dir="auto">{media.tagline}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
              {media.releaseYear && <span>{media.releaseYear}{media.endYear && media.endYear !== media.releaseYear ? ` – ${media.endYear}` : ''}</span>}
              {media.runtime && <span>{formatRuntime(media.runtime)}</span>}
              {isEpisodic && media.totalEpisodes > 0 && <span>{formatNumber(media.totalEpisodes)} حلقة</span>}
              {isEpisodic && media.totalSeasons > 0 && <span>{media.totalSeasons} موسم</span>}
              {media.countries?.length > 0 && <span>{media.countries.slice(0, 2).join('، ')}</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(media.genres || []).map((g) => (
                <Link key={g} to={`/library?genre=${encodeURIComponent(g)}`} className="chip cursor-pointer">
                  {g}
                </Link>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {media.externalRating != null && (
                <div className="surface-soft px-3 py-1.5 text-center">
                  <div className="text-[0.6rem] text-white/45">تقييم خارجي</div>
                  <div className="text-base font-black text-white/90">☆ {Number(media.externalRating).toFixed(1)}</div>
                  {media.externalVotes ? <div className="text-[0.58rem] text-white/35">{formatNumber(media.externalVotes)} صوت</div> : null}
                </div>
              )}
              {entry?.rating != null && (
                <div className="surface-soft border-brass-500/40 px-3 py-1.5 text-center">
                  <div className="text-[0.6rem] text-brass-400/80">تقييمي</div>
                  <div className="text-base font-black text-brass-400">★ {formatRating(entry.rating)}</div>
                  <div className="text-[0.58rem] text-white/35">من 10</div>
                </div>
              )}
              {(media.trailers || []).slice(0, 1).map((t) => (
                <a key={t.key || t.url} href={t.url} target="_blank" rel="noreferrer noopener" className="btn">
                  ▶ مشاهدة الإعلان على {t.site}
                </a>
              ))}
            </div>

            {media.overview && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/75" dir="auto">
                {media.overview}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ my experience */}
      <section className="surface border-brass-500/25 p-4 sm:p-5 animate-rise">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-brass-400 sm:text-lg">تجربتي</h2>
            <p className="text-[0.7rem] text-white/45">بياناتك الشخصية — ليست من المصادر الخارجية.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={toggleFavorite} disabled={busy}>
              {entry?.isFavorite ? '❤ مفضّل' : '🤍 مفضلة'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditorOpen(true)}>
              {entry ? 'تعديل تجربتي' : '+ أضِف إلى مكتبتي'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => quickStatus(s)}
              className="chip cursor-pointer"
              style={
                entry?.status === s
                  ? { background: `${STATUS_COLORS[s]}26`, borderColor: `${STATUS_COLORS[s]}80`, color: STATUS_COLORS[s] }
                  : undefined
              }
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {entry ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['الحالة', STATUS_LABELS[entry.status]],
                ['تقييمي', entry.rating != null ? `${formatRating(entry.rating)}/10` : '—'],
                ['الجودة', entry.quality || '—'],
                ['بدأت', formatDate(entry.dateStarted)],
                ['أنهيت', formatDate(entry.dateFinished)],
                ['إعادة المشاهدة', `${entry.rewatchCount} مرة`],
              ].map(([k, v]) => (
                <div key={k} className="surface-soft px-3 py-2">
                  <dt className="text-[0.62rem] text-white/40">{k}</dt>
                  <dd className="mt-0.5 font-bold text-white/85">{v}</dd>
                </div>
              ))}
            </dl>

            {entry.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.tags.map((t) => (
                  <span key={t.id} className="chip" style={{ background: `${t.color}22`, borderColor: `${t.color}70`, color: t.color }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {entry.notes && (
              <div className="surface-soft mt-3 p-3">
                <p className="text-[0.62rem] text-white/40">ملاحظاتي</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80" dir="auto">
                  {entry.notes}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={addRewatch} disabled={busy}>
                + إعادة مشاهدة
              </button>
              {entry.lastWatchedAt && (
                <span className="chip">آخر مشاهدة: {formatDate(entry.lastWatchedAt.slice(0, 10))}</span>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-white/45">
            لم تُضِف هذا العمل بعد. اختر حالة بالأعلى للإضافة السريعة، أو استخدم «أضِف إلى مكتبتي» لتسجيل التقييم
            والجودة والملاحظات.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ episodes */}
      {isEpisodic && (
        <Section title="الحلقات والمواسم">
          <EpisodeTracker mediaId={media.id} entry={entry} onEntryChange={setEntry} />
        </Section>
      )}

      {/* ------------------------------------------------ people */}
      <Section title="طاقم التمثيل">
        <PersonChips people={media.cast || []} emptyText="لا تتوفر بيانات تمثيل من هذا المصدر." />
      </Section>

      {(directors.length > 0 || writers.length > 0 || producers.length > 0 || media.crew?.length > 0) && (
        <Section title="فريق العمل">
          <div className="space-y-3 text-sm">
            {[
              ['الإخراج', directors],
              ['الكتابة', writers],
              ['الإنتاج', producers],
            ].map(([label, list]) =>
              list.length ? (
                <p key={label} className="text-white/70">
                  <span className="font-black text-white/45">{label}: </span>
                  <span dir="auto">{[...new Set(list.map((p) => p.name))].join('، ')}</span>
                </p>
              ) : null
            )}
            {media.crew?.length > 0 && <PersonChips people={media.crew.slice(0, 16)} />}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------ similar titles */}
      {similar.length > 0 && (
        <Section title="أعمال مشابهة" aside={<span className="text-[0.65rem] text-white/35">حسب المصدر نفسه</span>}>
          <div className="scroll-row">
            {similar.map((item) => (
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
        </Section>
      )}

      {/* ------------------------------------------------ production */}
      <Section title="الإنتاج والمعلومات">
        <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['شركات الإنتاج / الاستوديوهات', media.companies?.join('، ')],
            ['الدول', media.countries?.join('، ')],
            ['اللغات', media.languages?.join('، ')],
            ['تاريخ الإصدار', media.releaseDate ? formatDate(media.releaseDate) : null],
            ['المدة', formatRuntime(media.runtime)],
            ['الحالة', media.status],
            [
              'المعرّفات الخارجية',
              Object.entries(media.externalIds || {})
                .filter(([, v]) => v)
                .map(([k, v]) => `${k.replace('Id', '').toUpperCase()}: ${v}`)
                .join(' · '),
            ],
            ['آخر تحديث للبيانات', media.fetchedAt ? formatDate(media.fetchedAt.slice(0, 10)) : null],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="surface-soft px-3 py-2">
                <dt className="text-[0.62rem] text-white/40">{k}</dt>
                <dd className="mt-0.5 text-white/80" dir="auto">
                  {v}
                </dd>
              </div>
            ))}
        </dl>

        {media.homepage && (
          <a href={media.homepage} target="_blank" rel="noreferrer noopener" className="btn btn-ghost mt-3 text-xs">
            الصفحة الرسمية ↗
          </a>
        )}
        <p className="mt-3 text-[0.65rem] leading-relaxed text-white/30">
          البيانات والصور من المصادر العامة ({SOURCE_LABELS[media.source] || media.source}). لا يستضيف هذا الموقع أي
          ملفات فيديو ولا يوفّر روابط مشاهدة أو تحميل.
        </p>
      </Section>

      <EntryEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        media={media}
        entry={entry}
        onSaved={setEntry}
        onDeleted={() => setEntry(null)}
      />
    </div>
  );
}
