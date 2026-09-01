import { Link } from 'react-router-dom';
import PosterArt from './PosterArt';
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, formatRating } from '../lib/constants';

function ProgressBar({ percent }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-l from-brass-400 to-plum-400 transition-[width] duration-500"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

/**
 * One card = one title.
 * `item` is either a discovery card (source/sourceId) or a library entry's media.
 */
export default function MediaCard({
  to,
  title,
  originalTitle,
  posterUrl,
  year,
  mediaType,
  genres = [],
  externalRating,
  personalRating,
  status,
  isFavorite,
  progress,
  badge,
  width = 'w-[9.5rem] sm:w-[11rem]',
  onQuickAdd,
  quickAddLabel = '+ أريد مشاهدته',
}) {
  return (
    <article className={`group relative ${width}`}>
      <Link to={to} className="block focus-visible:outline-none">
        <div className="relative">
          <PosterArt src={posterUrl} title={title} alt={title} className="ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-1 group-hover:ring-brass-500/40" />
          <div className="pointer-events-none absolute inset-0 rounded-[1rem] bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80" />

          <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex flex-wrap items-start justify-between gap-1">
            <span className="chip bg-black/60 text-[10px] backdrop-blur-sm">{TYPE_LABELS[mediaType] || mediaType}</span>
            {isFavorite && <span className="chip bg-black/60 text-[10px] text-rose-heart backdrop-blur-sm">❤</span>}
          </div>

          <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-1">
            {personalRating != null ? (
              <span className="chip chip-brass text-[10px] font-black">★ {formatRating(personalRating)}</span>
            ) : externalRating ? (
              <span className="chip bg-black/60 text-[10px] backdrop-blur-sm">☆ {Number(externalRating).toFixed(1)}</span>
            ) : (
              <span />
            )}
            {badge && <span className="chip bg-black/60 text-[10px] backdrop-blur-sm">{badge}</span>}
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-[0.82rem] font-bold leading-snug text-white/95" title={title}>
            {title}
          </h3>
          <p className="mt-0.5 truncate text-[0.7rem] text-white/45">
            {[year || '—', genres[0]].filter(Boolean).join(' • ')}
          </p>
          {originalTitle && originalTitle !== title && (
            <p className="truncate text-[0.65rem] text-white/30" dir="auto">
              {originalTitle}
            </p>
          )}
          {status && (
            <span className="mt-1 inline-flex items-center gap-1 text-[0.68rem] font-bold" style={{ color: STATUS_COLORS[status] }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              {STATUS_LABELS[status] || status}
            </span>
          )}
          {progress?.totalEpisodes > 0 && (
            <>
              <ProgressBar percent={progress.percent} />
              <p className="mt-1 text-[0.65rem] text-white/45">
                {progress.watchedEpisodes} / {progress.totalEpisodes} حلقة
              </p>
            </>
          )}
        </div>
      </Link>

      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          className="btn mt-2 w-full py-1.5 text-[0.7rem] opacity-90 group-hover:opacity-100"
        >
          {quickAddLabel}
        </button>
      )}
    </article>
  );
}
