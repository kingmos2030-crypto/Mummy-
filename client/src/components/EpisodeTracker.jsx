import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/constants';
import { Spinner } from './ui';

/**
 * Episode-level tracking for TV / anime.
 * Statuses per episode: not_watched | watching | watched.
 */
export default function EpisodeTracker({ mediaId, entry, onEntryChange }) {
  const { toast, bumpLibrary } = useApp();
  const [episodes, setEpisodes] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [showWatchedOnly, setShowWatchedOnly] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .episodes(mediaId)
      .then((data) => {
        setEpisodes(data.episodes || []);
        setSeasons(data.seasons || []);
        setSeason((cur) => cur ?? (data.seasons?.[0] ?? null));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mediaId]);

  useEffect(load, [load, entry?.id]);

  const visible = useMemo(() => {
    let list = episodes.filter((e) => (season == null ? true : e.seasonNumber === season));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (e) => String(e.episodeNumber).includes(q) || (e.title || '').toLowerCase().includes(q)
      );
    }
    if (showWatchedOnly === 'watched') list = list.filter((e) => e.personalStatus === 'watched');
    if (showWatchedOnly === 'unwatched') list = list.filter((e) => e.personalStatus !== 'watched');
    return list.slice(0, 400);
  }, [episodes, season, query, showWatchedOnly]);

  const seasonStats = useMemo(() => {
    const list = episodes.filter((e) => (season == null ? true : e.seasonNumber === season));
    const watched = list.filter((e) => e.personalStatus === 'watched').length;
    return { watched, total: list.length };
  }, [episodes, season]);

  const requireEntry = () => {
    if (!entry?.id) {
      toast('أضف العمل إلى مكتبتك أولًا لتتبّع الحلقات', 'error');
      return false;
    }
    return true;
  };

  const applyResult = (result) => {
    onEntryChange?.(result.entry);
    bumpLibrary();
    load();
  };

  const toggle = async (episode) => {
    if (!requireEntry()) return;
    const next = episode.personalStatus === 'watched' ? 'not_watched' : 'watched';
    setBusy(episode.id);
    try {
      applyResult(await api.setEpisodeStatus(entry.id, episode.id, next));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const setWatching = async (episode) => {
    if (!requireEntry()) return;
    setBusy(episode.id);
    try {
      applyResult(await api.setEpisodeStatus(entry.id, episode.id, 'watching'));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const markUpTo = async (episode) => {
    if (!requireEntry()) return;
    setBusy(episode.id);
    try {
      applyResult(await api.markUpTo(entry.id, episode.id));
      toast(`تم وضع علامة مشاهدة حتى الحلقة ${episode.episodeNumber}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const seasonAction = async (watched) => {
    if (!requireEntry() || season == null) return;
    setBusy('season');
    try {
      applyResult(await api.setSeason(entry.id, season, watched));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Spinner label="جارٍ جلب الحلقات…" />;
  if (error) return <p className="surface-soft px-4 py-3 text-xs text-white/50">تعذّر جلب الحلقات: {error}</p>;
  if (!episodes.length)
    return <p className="surface-soft px-4 py-3 text-xs text-white/50">لا تتوفر بيانات حلقات لهذا العمل من المزوّدات الحالية.</p>;

  const progress = entry?.progress;

  return (
    <div className="space-y-3">
      {progress?.totalEpisodes > 0 && (
        <div className="surface-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-black text-white/80">
              تقدّمي: {progress.watchedEpisodes} / {progress.totalEpisodes} حلقة ({progress.percent}%)
            </span>
            {progress.nextEpisode && (
              <span className="chip chip-plum">
                التالي: م{progress.nextEpisode.seasonNumber} · ح{progress.nextEpisode.episodeNumber}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-brass-400 to-plum-400 transition-[width] duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {seasons.length > 1 && (
          <select className="field w-auto min-w-32 py-1.5 text-xs" value={season ?? ''} onChange={(e) => setSeason(Number(e.target.value))}>
            {seasons.map((s) => (
              <option key={s} value={s}>
                الموسم {s}
              </option>
            ))}
          </select>
        )}
        <select className="field w-auto py-1.5 text-xs" value={showWatchedOnly} onChange={(e) => setShowWatchedOnly(e.target.value)}>
          <option value="all">كل الحلقات</option>
          <option value="unwatched">غير المشاهدة</option>
          <option value="watched">المشاهدة</option>
        </select>
        <input
          className="field w-auto flex-1 py-1.5 text-xs"
          placeholder="ابحث برقم أو عنوان الحلقة…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="chip">
          {seasonStats.watched}/{seasonStats.total}
        </span>
        {entry?.id && (
          <div className="flex gap-1.5">
            <button type="button" className="btn px-2.5 py-1 text-xs" disabled={busy === 'season'} onClick={() => seasonAction(true)}>
              تعليم الموسم كمشاهد
            </button>
            <button type="button" className="btn px-2.5 py-1 text-xs" disabled={busy === 'season'} onClick={() => seasonAction(false)}>
              إلغاء
            </button>
          </div>
        )}
      </div>

      <ul className="space-y-1.5">
        {visible.map((ep) => {
          const watched = ep.personalStatus === 'watched';
          const watching = ep.personalStatus === 'watching';
          return (
            <li
              key={ep.id}
              className={`surface-soft flex flex-wrap items-center gap-2 p-2 transition ${
                watched ? 'border-mint-400/25 bg-mint-400/5' : watching ? 'border-plum-400/30' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(ep)}
                disabled={busy === ep.id}
                aria-label={watched ? 'إلغاء علامة المشاهدة' : 'تعليم كمشاهدة'}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-sm transition ${
                  watched ? 'border-mint-400/50 bg-mint-400/20 text-mint-400' : 'border-white/15 text-white/40 hover:text-white'
                }`}
              >
                {watched ? '✓' : watching ? '▶' : '○'}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  <span className="text-white/45 tabular-nums">م{ep.seasonNumber}·ح{ep.episodeNumber}</span>{' '}
                  <span dir="auto">{ep.title}</span>
                </p>
                <p className="truncate text-[0.68rem] text-white/40">
                  {[ep.airDate ? formatDate(ep.airDate) : null, ep.runtime ? `${ep.runtime} د` : null]
                    .filter(Boolean)
                    .join(' • ') || '—'}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                {!watched && (
                  <button type="button" className="chip cursor-pointer" onClick={() => setWatching(ep)} disabled={busy === ep.id}>
                    أشاهدها
                  </button>
                )}
                <button type="button" className="chip cursor-pointer" onClick={() => markUpTo(ep)} disabled={busy === ep.id}>
                  حتى هنا
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && <p className="surface-soft px-4 py-3 text-center text-xs text-white/45">لا حلقات مطابقة للفلاتر.</p>}
      {visible.length === 400 && <p className="text-center text-[0.68rem] text-white/35">تُعرض أول 400 حلقة — استخدم البحث للوصول إلى بقية الحلقات.</p>}
    </div>
  );
}
