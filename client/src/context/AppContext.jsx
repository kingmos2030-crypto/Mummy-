import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { QUALITY_FALLBACK } from '../lib/constants';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [options, setOptions] = useState({ qualities: QUALITY_FALLBACK, providers: {} });
  const [tags, setTags] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [libraryVersion, setLibraryVersion] = useState(0);
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

  useEffect(() => {
    api
      .options()
      .then((data) => setOptions({ ...data, qualities: data.qualities?.length ? data.qualities : QUALITY_FALLBACK }))
      .catch(() => setOptions({ qualities: QUALITY_FALLBACK, providers: {} }));
    refreshTags();
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, [refreshTags]);

  const value = useMemo(
    () => ({ options, tags, refreshTags, toast, toasts, dismissToast, libraryVersion, bumpLibrary }),
    [options, tags, refreshTags, toast, toasts, dismissToast, libraryVersion, bumpLibrary]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
