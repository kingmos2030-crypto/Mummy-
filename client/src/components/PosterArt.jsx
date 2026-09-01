import { useMemo, useState } from 'react';

const PALETTES = [
  ['#2b2140', '#4b2f63'],
  ['#1f2a3d', '#2f4a63'],
  ['#3a2418', '#5e3a22'],
  ['#182a24', '#245043'],
  ['#2d1a2b', '#5a2d4d'],
  ['#20232f', '#3a3f56'],
];

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Poster / backdrop image with a deterministic generated fallback.
 * Some providers (and the offline catalog) have no artwork — we never show
 * a broken image, and we never host media files.
 */
export default function PosterArt({ src, alt, title = '', ratio = '2 / 3', className = '', rounded = '1rem' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [from, to] = useMemo(() => PALETTES[hash(title || alt || '') % PALETTES.length], [title, alt]);
  const initials = useMemo(() => {
    const clean = (title || alt || '؟').trim();
    const words = clean.split(/\s+/).slice(0, 2);
    return words.map((w) => w[0]).join('');
  }, [title, alt]);

  const showFallback = !src || failed;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: ratio, borderRadius: rounded, background: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      {showFallback ? (
        <div className="absolute inset-0 grid place-items-center p-3 text-center">
          <div>
            <div className="text-2xl font-black text-white/80 sm:text-3xl">{initials}</div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-white/45 sm:text-xs">{title || alt}</div>
          </div>
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 shimmer" />}
          <img
            src={src}
            alt={alt || title}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
    </div>
  );
}
