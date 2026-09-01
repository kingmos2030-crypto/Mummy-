/**
 * Thin API client. All external-API traffic goes through our own backend,
 * so no third-party keys ever exist in the browser bundle.
 */

const BASE = '/api';

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body means we never reached the app's API (proxy/host error
    // page). Surface the status code so the failure is diagnosable at a glance.
    data = { error: `استجابة غير صالحة من الخادم (HTTP ${res.status})` };
  }
  if (!res.ok) {
    const error = new Error(data?.error || `فشل الطلب (${res.status})`);
    error.status = res.status;
    error.details = data?.details;
    throw error;
  }
  return data;
}

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === 'all') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  options: () => request('/discover/options'),
  search: (q, type, signal) => request(`/discover/search${qs({ q, type })}`, { signal }),
  trending: () => request('/discover/trending'),
  externalDetails: (source, type, id, refresh) =>
    request(`/discover/media/${source}/${type}/${encodeURIComponent(id)}${qs({ refresh: refresh ? 1 : '' })}`),
  internalDetails: (mediaId) => request(`/discover/internal/${mediaId}`),
  episodes: (mediaId, season) => request(`/discover/internal/${mediaId}/episodes${qs({ season })}`),
  similarExternal: (source, type, id) =>
    request(`/discover/media/${source}/${type}/${encodeURIComponent(id)}/similar`),
  similarInternal: (mediaId) => request(`/discover/internal/${mediaId}/similar`),

  library: (filters) => request(`/library${qs(filters)}`),
  addToLibrary: (payload) => request('/library', { method: 'POST', body: payload }),
  updateEntry: (id, patch) => request(`/library/${id}`, { method: 'PATCH', body: patch }),
  deleteEntry: (id) => request(`/library/${id}`, { method: 'DELETE' }),
  rewatch: (id, delta = 1) => request(`/library/${id}/rewatch`, { method: 'POST', body: { delta } }),
  setEpisodeStatus: (entryId, episodeId, status) =>
    request(`/library/${entryId}/episodes/${episodeId}`, { method: 'POST', body: { status } }),
  markUpTo: (entryId, episodeId) =>
    request(`/library/${entryId}/episodes/${episodeId}/up-to`, { method: 'POST' }),
  setSeason: (entryId, season, watched) =>
    request(`/library/${entryId}/seasons/${season}`, { method: 'POST', body: { watched } }),

  home: () => request('/home'),
  stats: () => request('/stats'),
  profile: () => request('/profile'),
  updateProfile: (patch) => request('/profile', { method: 'PATCH', body: patch }),
  history: (limit = 80) => request(`/history${qs({ limit })}`),
  tags: () => request('/tags'),
  createTag: (name, color) => request('/tags', { method: 'POST', body: { name, color } }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),

  /** Direct download links (JSON by default, CSV with format='csv'). */
  exportUrl: (format) => `${BASE}/export${format === 'csv' ? '?format=csv' : ''}`,
};

export default api;
