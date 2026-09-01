import { useEffect } from 'react';

export function Modal({ open, onClose, title, children, footer, size = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="إغلاق" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className={`surface relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-[1.35rem] ${size} animate-pop`}>
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 className="text-base font-black sm:text-lg">{title}</h2>
          <button type="button" onClick={onClose} className="btn px-2.5 py-1 text-sm" aria-label="إغلاق">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <footer className="border-t border-white/10 px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '🎞️', title, hint, action }) {
  return (
    <div className="surface flex flex-col items-center gap-2 px-6 py-12 text-center animate-fade">
      <div className="text-4xl opacity-70">{icon}</div>
      <h3 className="text-base font-black">{title}</h3>
      {hint && <p className="max-w-md text-sm text-white/50">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="text-3xl">⚠️</div>
      <p className="text-sm text-white/70">{message || 'حدث خطأ غير متوقع.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function CardSkeleton({ count = 6 }) {
  return (
    <div className="scroll-row">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[9.5rem] sm:w-[11rem]">
          <div className="shimmer rounded-2xl" style={{ aspectRatio: '2 / 3' }} />
          <div className="shimmer mt-2 h-3 w-4/5 rounded" />
          <div className="shimmer mt-1.5 h-2.5 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ height = 180 }) {
  return <div className="shimmer w-full rounded-[1.35rem]" style={{ height }} />;
}

export function Spinner({ label = 'جارٍ التحميل…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-white/50">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-brass-500" />
      {label}
    </div>
  );
}
