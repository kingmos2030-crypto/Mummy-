import React, { useState } from 'react';
import { X, Star, Heart, Film, Clock, Calendar, Check, Save, Trash2 } from 'lucide-react';
import { updateMediaItem, addMediaItem, deleteMediaItem } from '../utils/api';

export default function MediaDetailModal({ item, onClose, onUpdated }) {
  const isEditing = Boolean(item && item.id);

  const [formData, setFormData] = useState({
    title: item?.title || '',
    original_title: item?.original_title || '',
    media_type: item?.media_type || 'Movie',
    status: item?.status || 'Plan to Watch',
    poster_path: item?.poster_path || '',
    backdrop_path: item?.backdrop_path || '',
    overview: item?.overview || '',
    release_date: item?.release_date || '',
    vote_average: item?.vote_average || 0,
    genres: typeof item?.genres === 'string' ? item.genres : JSON.stringify(item?.genres || []),
    rating: item?.rating || 0,
    quality: item?.quality || '1080p',
    notes: item?.notes || '',
    is_favorite: item?.is_favorite ? 1 : 0,
    total_episodes: item?.total_episodes || 0,
    current_episode: item?.current_episode || 0,
    total_seasons: item?.total_seasons || 1,
    current_season: item?.current_season || 1,
    rewatch_count: item?.rewatch_count || 0,
    date_started: item?.date_started || '',
    date_finished: item?.date_finished || ''
  });

  const [loading, setLoading] = useState(false);

  const statuses = ['Watching', 'Completed', 'Plan to Watch', 'On Hold', 'Dropped'];
  const mediaTypes = ['Movie', 'TV Show', 'Anime', 'Cartoon', 'Documentary', 'Special', 'Web Series', 'Other'];
  const qualities = ['1080p', '4K / 2160p', '720p', 'BluRay', 'WEB-DL', 'HDRip', 'CAM', 'DVD', 'Other'];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEditing) {
        await updateMediaItem(item.id, formData);
      } else {
        await addMediaItem(formData);
      }
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${formData.title}"?`)) {
      try {
        setLoading(true);
        await deleteMediaItem(item.id);
        if (onUpdated) onUpdated();
        onClose();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {isEditing ? `Edit Journal Entry: ${formData.title}` : 'Add New Media to Journal'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top Section: Poster & Basic Info */}
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-full sm:w-40 flex-shrink-0 space-y-3">
              <div className="relative aspect-[2/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
                {formData.poster_path ? (
                  <img src={formData.poster_path} alt={formData.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Film className="w-10 h-10" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleChange('is_favorite', formData.is_favorite ? 0 : 1)}
                  className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md border transition ${
                    formData.is_favorite
                      ? 'bg-rose-500/20 text-rose-500 border-rose-500/40'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-rose-400'
                  }`}
                  title="Toggle Favorite"
                >
                  <Heart className={`w-4 h-4 ${formData.is_favorite ? 'fill-rose-500' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Poster Image URL</label>
                <input
                  type="text"
                  value={formData.poster_path}
                  onChange={(e) => handleChange('poster_path', e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500 text-sm shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Media Type</label>
                  <select
                    value={formData.media_type}
                    onChange={(e) => handleChange('media_type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  >
                    {mediaTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Personal Rating (1-10)</label>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={formData.rating}
                      onChange={(e) => handleChange('rating', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Quality Watched</label>
                  <select
                    value={formData.quality}
                    onChange={(e) => handleChange('quality', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  >
                    {qualities.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* TV / Anime Progress Tracker Section */}
          {(formData.media_type === 'TV Show' || formData.media_type === 'Anime' || formData.media_type === 'Cartoon' || formData.media_type === 'Web Series') && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Episode & Season Progress</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Current Season</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.current_season}
                    onChange={(e) => handleChange('current_season', parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Total Seasons</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.total_seasons}
                    onChange={(e) => handleChange('total_seasons', parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Current Episode</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.current_episode}
                    onChange={(e) => handleChange('current_episode', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Total Episodes</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.total_episodes}
                    onChange={(e) => handleChange('total_episodes', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Personal Notes & Journal */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Personal Notes & Journal Entry</label>
            <textarea
              rows="3"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Write your personal thoughts, favorite quotes, or review here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 shadow-inner"
            ></textarea>
          </div>

          {/* Overview / Synopsis */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Synopsis / Overview</label>
            <textarea
              rows="2"
              value={formData.overview}
              onChange={(e) => handleChange('overview', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs focus:outline-none focus:border-amber-500 shadow-inner"
            ></textarea>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Add to Journal'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
