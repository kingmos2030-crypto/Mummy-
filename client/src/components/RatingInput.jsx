import { useEffect, useRef } from 'react';
import { formatRating } from '../lib/constants';

/**
 * Personal rating control: 0 → 10 in 0.25 steps.
 * Deliberately styled apart from external ratings (brass, "تقييمي").
 */
export default function RatingInput({ value, onChange, id = 'personal-rating' }) {
  const inputRef = useRef(null);
  const numeric = value == null ? 0 : Number(value);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = String(numeric);
  }, [numeric]);

  const step = (delta) => {
    const next = Math.min(10, Math.max(0, Math.round((numeric + delta) * 4) / 4));
    onChange(next);
  };

  return (
    <div className="surface-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-black text-brass-400">
          تقييمي الشخصي
        </label>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn px-2.5 py-1 text-sm" onClick={() => step(-0.25)} aria-label="إنقاص ربع نقطة">
            −
          </button>
          <span className="min-w-[4.5rem] rounded-lg bg-black/40 px-2 py-1 text-center text-lg font-black text-brass-400 tabular-nums">
            {value == null ? '—' : `${formatRating(value)}/10`}
          </span>
          <button type="button" className="btn px-2.5 py-1 text-sm" onClick={() => step(0.25)} aria-label="زيادة ربع نقطة">
            +
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="range"
        min="0"
        max="10"
        step="0.25"
        defaultValue={numeric}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#d4ab5f]"
        aria-valuetext={`${numeric} من 10`}
      />

      <div className="mt-1 flex justify-between text-[0.62rem] text-white/35 tabular-nums">
        <span>0</span>
        <span>2.5</span>
        <span>5</span>
        <span>7.5</span>
        <span>10</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`chip cursor-pointer transition ${Number(value) === v ? 'chip-brass' : ''}`}
          >
            {v}
          </button>
        ))}
        {value != null && (
          <button type="button" onClick={() => onChange(null)} className="chip cursor-pointer text-rose-heart">
            مسح
          </button>
        )}
      </div>
    </div>
  );
}
