import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const NAV = [
  { to: '/', labelKey: 'nav.home', shortKey: 'nav.home', icon: '◉', end: true },
  { to: '/search', labelKey: 'nav.discover', shortKey: 'nav.discover', icon: '⌕' },
  { to: '/library', labelKey: 'nav.library', shortKey: 'nav.library', icon: '▤' },
  { to: '/watchlist', labelKey: 'nav.watchlist', shortKey: 'nav.watchlist.short', icon: '＋' },
  { to: '/stats', labelKey: 'nav.stats', shortKey: 'nav.stats.short', icon: '◔' },
  { to: '/profile', labelKey: 'nav.profile', shortKey: 'nav.profile', icon: '☺' },
];

const MORE = [
  { to: '/favorites', labelKey: 'nav.favorites', icon: '❤' },
  { to: '/history', labelKey: 'nav.history', icon: '🕘' },
  { to: '/tags', labelKey: 'nav.tags', icon: '🏷' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙' },
];

function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-2xl backdrop-blur-md animate-rise ${
            t.tone === 'error'
              ? 'border-rose-heart/40 bg-rose-heart/15 text-rose-100'
              : t.tone === 'success'
                ? 'border-mint-400/40 bg-mint-400/15 text-emerald-100'
                : 'border-white/15 bg-ink-800/90 text-white/90'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const { t } = useApp();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-8">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-brass-500 focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-ink-950">
        {t('a11y.skip')}
      </a>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Mummy شافت — الرئيسية">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brass-500 to-plum-500 text-sm font-black text-ink-950 shadow-lg">
              مـش
            </span>
            <span className="hidden text-lg font-black leading-none sm:block">
              <span className="title-gradient">Mummy</span> <span className="text-white">شافت</span>
            </span>
          </Link>

          <form onSubmit={submit} className="relative flex-1" role="search">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              className="field py-2 pe-9 ps-3 text-sm"
            />
            <button
              type="submit"
              className="absolute inset-y-0 end-2 my-auto grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:text-brass-400"
              aria-label={t('search.submit')}
            >
              ⌕
            </button>
          </form>

          <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.main')}>
            {NAV.slice(1).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-bold transition ${
                    isActive ? 'bg-white/10 text-brass-400' : 'text-white/65 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="relative">
            <button type="button" className="btn px-2.5 py-2 text-sm" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label={t('nav.more')}>
              ⋯
            </button>
            {menuOpen && (
              <div className="surface absolute end-0 top-12 z-50 w-52 overflow-hidden p-1.5 animate-pop">
                {MORE.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/8 hover:text-white"
                  >
                    <span aria-hidden>{item.icon}</span>
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 pt-4 text-center text-[0.7rem] leading-relaxed text-white/35">
        <p>{t('footer.line1')}</p>
        <p className="mt-1">{t('footer.line2')}</p>
        <p className="mt-1">
          <Link to="/settings" className="underline decoration-white/20 underline-offset-4 hover:text-white/60">
            {t('nav.settings')}
          </Link>
        </p>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden" aria-label={t('nav.mobile')}>
        <div className="grid grid-cols-6">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[0.6rem] font-bold transition ${
                  isActive ? 'text-brass-400' : 'text-white/50'
                }`
              }
            >
              <span className="text-base leading-none" aria-hidden>
                {item.icon}
              </span>
              <span className="max-w-full truncate px-0.5">{t(item.shortKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toasts />
    </div>
  );
}
