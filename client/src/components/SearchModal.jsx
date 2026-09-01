import React, { useState } from 'react';
import { Search, X, Film, Plus, Star, Check } from 'lucide-react';
import { searchExternalMedia, addMediaItem } from '../utils/api';

export default function SearchModal({ onClose, onMediaAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      const res = await searchExternalMedia(query);
      setResults(res.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuickly = async (item) => {
    try {
      setAddingId(item.external_id);
      const payload = {
        external_id: item.external_id,
        source: item.source,
        title: item.title,
        original_title: item.original_title,
        media_type: item.media_type || 'Movie',
        status: 'Plan to Watch',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        release_date: item.release_date,
        vote_average: item.vote_average,
        genres: JSON.stringify(item.genres || []),
        quality: '1080p',
        rating: 0,
        is_favorite: 0
      };

      await addMediaItem(payload);
      setAddedIds(prev => new Set(prev).add(item.external_id));
      if (onMediaAdded) onMediaAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">Search TMDB & TVMaze</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search movies, TV shows, anime, documentaries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl pl-12 pr-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none transition text-sm shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>Search</span>
              )}
            </button>
          </form>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Film className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-medium">No results found.</p>
              <p className="text-slate-500 text-sm">Type a title above to discover media from TMDB and TVMaze databases.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((item, idx) => {
                const isAdded = addedIds.has(item.external_id);
                const isAdding = addingId === item.external_id;

                return (
                  <div
                    key={`${item.external_id}-${idx}`}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 flex space-x-3 items-start transition group shadow-md"
                  >
                    <div className="relative w-20 h-28 flex-shrink-0 bg-slate-900 rounded-xl overflow-hidden">
                      {item.poster_path ? (
                        <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-slate-950/80 text-[9px] font-bold text-amber-400 uppercase">
                        {item.media_type}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between h-28">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm truncate" title={item.title}>
                          {item.title}
                        </h4>
                        <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                          <span>{item.release_date ? item.release_date.substring(0, 4) : 'N/A'}</span>
                          {item.vote_average > 0 && (
                            <span className="flex items-center text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                              {item.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {item.overview || 'No overview available.'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleAddQuickly(item)}
                        disabled={isAdded || isAdding}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition ${
                          isAdded
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Watchlist</span>
                          </>
                        ) : isAdding ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Add to Watchlist</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
