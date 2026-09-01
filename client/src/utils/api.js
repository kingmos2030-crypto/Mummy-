import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const getMediaItems = (params) => api.get('/media', { params });
export const getMediaItem = (id) => api.get(`/media/${id}`);
export const addMediaItem = (data) => api.post('/media', data);
export const updateMediaItem = (id, data) => api.put(`/media/${id}`, data);
export const deleteMediaItem = (id) => api.delete(`/media/${id}`);

export const searchExternalMedia = (query) => api.get('/search', { params: { q: query } });
export const getStats = () => api.get('/stats');
export const getProfile = () => api.get('/profile');
export const updateProfile = (data) => api.put('/profile', data);
export const getBackup = () => api.get('/backup');
export const restoreBackup = (data) => api.post('/restore', data);

export default api;
