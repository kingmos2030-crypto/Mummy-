import React, { useState, useEffect } from 'react';
import { Film, CheckCircle, Clock, Bookmark, Star, Heart, Plus, Play, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { getMediaItems, getStats, updateMediaItem } from '../utils/api';

export default function Dashboard({ setActiveTab, onSelectItem, onOpenSearch, onOpenAdd }) {
  const [stats, setStats] = useState(null);
  const [watchingItems, setWatchingItems] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, watchingRes, recentRes] = await Promise.all([
        getStats(),
        getMediaItems({ status: 'Watching' }),
        getMediaItems({})
      ]);
      setStats(statsRes.data);
      setWatchingItems(watchingRes.data);
      setRecentItems(recentRes.data.slice(0, 6));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuickEpisodeUpdate = async (item, delta, e) => {
    e.stopPropagation();
    const newEp = Math.max(0, (item.current_episode || 0) + delta);
    const newStatus = (item.total_episodes && newEp >= item.total_episodes) ? 'Completed' : item.status;
    const updates = { current_episode: newEp, status: newStatus };
    if (newStatus === 'Completed') updates.date_finished = new Date().toISOString();

    try {
      await updateMediaItem(item.id, updates);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Media Journal & Tracker</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
              Mummy شافت
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Everything I watched, everything I’m watching, and everything I want to watch. Your personal cinematic & series sanctuary.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenSearch}
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Search & Add Media</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-5 py-3 rounded-xl border border-slate-700 transition"
            >
              <span>Explore Library</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Total Media</span>
              <Film className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{stats.totalItems}</div>
            <div className="text-xs text-slate-400 mt-1">In your collection</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Watching</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">{stats.watchingItems}</div>
            <div className="text-xs text-slate-400 mt-1">In progress</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{stats.completedItems}</div>
            <div className="text-xs text-slate-400 mt-1">Fully watched</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Watchlist</span>
              <Bookmark className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400">{stats.planItems}</div>
            <div className="text-xs text-slate-400 mt-1">Plan to watch</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Favorites</span>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-400">{stats.favoriteCount}</div>
            <div className="text-xs text-slate-400 mt-1">Marked favorites</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Avg Rating</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{stats.avgRating} <span className="text-xs text-slate-400 font-normal">/10</span></div>
            <div className="text-xs text-slate-400 mt-1">Personal score</div>
          </div>
        </div>
      )}

      {/* Currently Watching Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
            <h2 className="text-xl font-bold text-slate-100">Currently Watching</h2>
          </div>
          <button
            onClick={() => setActiveTab('library')}
            className="text-sm font-medium text-amber-400 hover:text-amber-300 flex items-center space-x-1"
          >
            <span>View All ({watchingItems.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {watchingItems.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
            <Clock className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-medium">No media currently in progress.</p>
            <p className="text-slate-500 text-sm">Start watching a series or movie from your library or search for something new.</p>
            <button
              onClick={onOpenSearch}
              className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium px-4 py-2 rounded-xl border border-slate-700 text-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Find Something to Watch</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {watchingItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition hover:shadow-xl cursor-pointer flex flex-col justify-between"
              >
                <div className="p-4 flex space-x-4">
                  <div className="relative w-24 h-36 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800 shadow-md">
                    {item.poster_path ? (
                      <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Film className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-amber-400 uppercase tracking-wider border border-slate-800">
                      {item.media_type}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-100 truncate group-hover:text-amber-400 transition" title={item.title}>
                          {item.title}
                        </h3>
                        {item.is_favorite === 1 && (
                          <Heart className="w-4 h-4 text-rose-500 fill-rose-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Quality: <span className="text-slate-200 font-medium">{item.quality}</span>
                      </p>
                      {item.rating > 0 && (
                        <div className="flex items-center space-x-1 mt-1 text-amber-400 text-xs font-semibold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.rating}/10</span>
                        </div>
                      )}
                    </div>

                    {/* Episode Progress Tracker */}
                    {(item.media_type === 'TV Show' || item.media_type === 'Anime' || item.media_type === 'Cartoon' || item.media_type === 'Web Series') && (
                      <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 my-2">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400 font-medium">Progress</span>
                          <span className="text-amber-400 font-bold">
                            S{item.current_season} E{item.current_episode} {item.total_episodes ? `/ ${item.total_episodes}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={(e) => handleQuickEpisodeUpdate(item, -1, e)}
                            disabled={item.current_episode <= 0}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center justify-center text-sm transition"
                          >
                            -
                          </button>
                          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
                              style={{
                                width: item.total_episodes ? `${Math.min(100, (item.current_episode / item.total_episodes) * 100)}%` : '30%'
                              }}
                            ></div>
                          </div>
                          <button
                            onClick={(e) => handleQuickEpisodeUpdate(item, 1, e)}
                            className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center text-sm transition shadow-sm"
                            title="Next Episode (+1)"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Added Media */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">Recent Additions</h2>
          <button
            onClick={() => setActiveTab('library')}
            className="text-sm font-medium text-amber-400 hover:text-amber-300 flex items-center space-x-1"
          >
            <span>View Library</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {recentItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition hover:shadow-xl cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] bg-slate-800 overflow-hidden">
                {item.poster_path ? (
                  <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Film className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-amber-400 uppercase tracking-wider border border-slate-800">
                  {item.media_type}
                </div>
                {item.is_favorite === 1 && (
                  <div className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2 pt-6">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    item.status === 'Watching' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    item.status === 'Plan to Watch' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-slate-700/50 text-slate-300'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-amber-400 transition" title={item.title}>
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>{item.quality}</span>
                  {item.rating > 0 && (
                    <span className="flex items-center text-amber-400 font-semibold">
                      <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                      {item.rating}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
