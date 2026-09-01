import { Link } from 'react-router-dom';
import MediaCard from './MediaCard';

export function entryToCard(entry) {
  const m = entry.media || {};
  return {
    cardId: entry.id,
    to: `/title/${entry.mediaId}`,
    title: m.title,
    originalTitle: m.originalTitle,
    posterUrl: m.posterUrl,
    year: m.releaseYear,
    mediaType: m.mediaType,
    genres: m.genres || [],
    externalRating: m.externalRating,
    personalRating: entry.rating,
    status: entry.status,
    isFavorite: entry.isFavorite,
    progress: entry.progress,
  };
}

/** Horizontal, snap-scrolling shelf of personal entries. */
export default function Shelf({ title, subtitle, entries = [], emptyHint, moreTo, badgeFor }) {
  if (!entries.length && !emptyHint) return null;

  return (
    <section className="animate-rise">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black sm:text-xl">{title}</h2>
          {subtitle && <p className="text-xs text-white/45">{subtitle}</p>}
        </div>
        {moreTo && entries.length > 0 && (
          <Link to={moreTo} className="shrink-0 text-xs font-bold text-brass-400 hover:text-brass-500">
            عرض الكل ←
          </Link>
        )}
      </div>

      {entries.length ? (
        <div className="scroll-row">
          {entries.map((entry) => {
            const card = entryToCard(entry);
            const { cardId, ...rest } = card;
            return <MediaCard key={cardId} {...rest} badge={badgeFor?.(entry)} />;
          })}
        </div>
      ) : (
        <div className="surface-soft px-4 py-6 text-center text-xs text-white/45">{emptyHint}</div>
      )}
    </section>
  );
}
