import React, { useState, useEffect } from 'react';
import { Film, Search, Star, Heart, Plus, Filter, ArrowUpDown, Trash2, Edit3, Clock, CheckCircle, Bookmark } from 'lucide-react';
import { getMediaItems, deleteMediaItem, updateMediaItem } from '../utils/api';

export default function Library({ onSelectItem, onOpenAdd }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated'); // updated, rating, title, release

  const statuses = ['All', 'Watching', 'Completed', 'Plan to Watch', 'On Hold', 'Dropped'];
  const mediaTypes = ['All', 'Movie', 'TV Show', 'Anime', 'Cartoon', 'Documentary', 'Special', 'Web Series', 'Other'];
  const qualities = ['All', '1080p', '4K / 2160p', '720p', 'BluRay', 'WEB-DL', 'HDRip', 'CAM', 'DVD', 'Other'];

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (media_type => typeFilter !== 'All') params.media_type = typeFilter;
      if (searchQuery) params.search = searchQuery;
      if (favoriteOnly) params.favorite = 'true';

      const res = await getMediaItems(params);
      let data = res.data;

      // Quality filter client-side if needed
      if (qualityFilter !== 'All') {
        data = data.filter(item => item.quality === qualityFilter);
      }

      // Sorting
      data.sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'release') return (b.release_date || '').localeCompare(a.release_date || '');
        // default 'updated'
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      });

      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [statusFilter, typeFilter, qualityFilter, favoriteOnly, searchQuery, sortBy]);

  const handleDelete = async (id, title, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove "${title}" from your library?`)) {
      try {
        await deleteMediaItem(id);
        fetchLibrary();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleQuickEpisodeUpdate = async (item, delta, e) => {
    e.stopPropagation();
    const newEp = Math.max(0, (item.current_episode || 0) + delta);
    const newStatus = (item.total_episodes && newEp >= item.total_episodes) ? 'Completed' : item.status;
    const updates = { current_episode: newEp, status: newStatus };
    if (newStatus === 'Completed') updates.date_finished = new Date().toISOString();

    try {
      await updateMediaItem(item.id, updates);
      fetchLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            My Media Library
          </h1>
          <p className="text-slate-400 text-sm">
            Browse, filter, and track everything in your personal journal.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, overview, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition shadow-sm"
            />
          </div>

          <button
            onClick={onOpenAdd}
            className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Add Media</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition shadow-sm ${
              statusFilter === status
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Media Type Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {mediaTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Quality Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400">Quality:</span>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {qualities.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* Favorites Toggle */}
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              favoriteOnly
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoriteOnly ? 'fill-rose-500' : ''}`} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Sort By */}
        <div className="flex items-center space-x-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="updated">Recently Updated</option>
            <option value="rating">Highest Rating</option>
            <option value="title">Title (A-Z)</option>
            <option value="release">Release Date</option>
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-16 text-center space-y-4">
          <Film className="w-16 h-16 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-200">No media found in this view</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Try adjusting your filters or search query, or add new media to your journal.
          </p>
          <button
            onClick={onOpenAdd}
            className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Media Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition hover:shadow-2xl cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Poster container */}
                <div className="relative aspect-[2/3] bg-slate-800 overflow-hidden">
                  {item.poster_path ? (
                    <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Film className="w-10 h-10" />
                    </div>
                  )}

                  {/* Media Type Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-amber-400 uppercase tracking-wider border border-slate-800/80">
                    {item.media_type}
                  </div>

                  {/* Favorite Badge */}
                  {item.is_favorite === 1 && (
                    <div className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800/80">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    </div>
                  )}

                  {/* Status Overlay Badge */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3 pt-6 flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      item.status === 'Watching' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      item.status === 'Plan to Watch' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      item.status === 'On Hold' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      {item.quality}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-slate-100 truncate group-hover:text-amber-400 transition" title={item.title}>
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{item.release_date ? item.release_date.substring(0, 4) : 'N/A'}</span>
                    {item.rating > 0 ? (
                      <div className="flex items-center space-x-1 text-amber-400 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{item.rating}/10</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">Unrated</span>
                    )}
                  </div>

                  {/* TV / Anime Episode Progress Tracker in Card */}
                  {(item.media_type === 'TV Show' || item.media_type === 'Anime' || item.media_type === 'Cartoon' || item.media_type === 'Web Series') && (
                    <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800/80 mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Ep {item.current_episode || 0} {item.total_episodes ? `/ ${item.total_episodes}` : ''}</span>
                        <span className="text-amber-400 font-medium">S{item.current_season}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => handleQuickEpisodeUpdate(item, -1, e)}
                          disabled={item.current_episode <= 0}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center justify-center text-xs transition"
                        >
                          -
                        </button>
                        <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all"
                            style={{
                              width: item.total_episodes ? `${Math.min(100, (item.current_episode / item.total_episodes) * 100)}%` : '20%'
                            }}
                          ></div>
                        </div>
                        <button
                          onClick={(e) => handleQuickEpisodeUpdate(item, 1, e)}
                          className="w-6 h-6 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center text-xs transition shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-xs text-slate-400 italic truncate mt-1">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/40">
                <span className="text-[10px] text-slate-500">
                  Updated {new Date(item.updated_at).toLocaleDateString()}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem(item);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition"
                    title="Edit Item"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.id, item.title, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
