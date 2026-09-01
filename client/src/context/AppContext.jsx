import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { QUALITY_FALLBACK } from '../lib/constants';
import { dirOf, makeTranslator } from '../lib/i18n';

const AppContext = createContext(null);

const PREFS_KEY = 'mummy:prefs';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { lang: 'ar', theme: 'cinema', ...JSON.parse(raw) };
  } catch {
    /* corrupted prefs -> defaults */
  }
  return { lang: 'ar', theme: 'cinema' };
}

export function AppProvider({ children }) {
  const [options, setOptions] = useState({ qualities: QUALITY_FALLBACK, providers: {} });
  const [tags, setTags] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const timers = useRef(new Map());

  const toast = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, tone }]);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 3800);
    timers.current.set(id, t);
  }, []);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const refreshTags = useCallback(async () => {
    try {
      const data = await api.tags();
      setTags(data.tags || []);
    } catch {
      /* tags are non critical */
    }
  }, []);

  const bumpLibrary = useCallback(() => setLibraryVersion((v) => v + 1), []);

  // ---------------- appearance / language preferences ----------------
  const setPrefs = useCallback((patch) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = prefs.lang || 'ar';
    root.dir = dirOf(prefs.lang);
    root.dataset.theme = prefs.theme || 'cinema';
  }, [prefs.lang, prefs.theme]);

  const t = useMemo(() => makeTranslator(prefs.lang), [prefs.lang]);

  useEffect(() => {
    api
      .options()
      .then((data) => setOptions({ ...data, qualities: data.qualities?.length ? data.qualities : QUALITY_FALLBACK }))
      .catch(() => setOptions({ qualities: QUALITY_FALLBACK, providers: {} }));
    refreshTags();
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, [refreshTags]);

  const value = useMemo(
    () => ({
      options,
      tags,
      refreshTags,
      toast,
      toasts,
      dismissToast,
      libraryVersion,
      bumpLibrary,
      prefs,
      setPrefs,
      t,
    }),
    [options, tags, refreshTags, toast, toasts, dismissToast, libraryVersion, bumpLibrary, prefs, setPrefs, t]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
