import React, { useState, useEffect } from 'react';
import { BarChart2, PieChart, Star, Film, CheckCircle, Clock, Bookmark, Heart, Award } from 'lucide-react';
import { getStats } from '../utils/api';

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
          Personal Statistics & Insights
        </h1>
        <p className="text-slate-400 text-sm">
          A deep dive into your watching habits, preferences, and journal analytics.
        </p>
      </div>

      {/* Top Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Film className="w-7 h-7" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Collection</div>
            <div className="text-3xl font-black text-slate-100 mt-1">{stats.totalItems}</div>
            <div className="text-xs text-amber-400 mt-0.5">Media logged</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Completion Rate</div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              {stats.totalItems > 0 ? Math.round((stats.completedItems / stats.totalItems) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{stats.completedItems} completed</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <Heart className="w-7 h-7 fill-rose-500" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Favorites</div>
            <div className="text-3xl font-black text-rose-400 mt-1">{stats.favoriteCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Marked masterpieces</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Star className="w-7 h-7 fill-purple-400" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Average Score</div>
            <div className="text-3xl font-black text-purple-400 mt-1">{stats.avgRating} <span className="text-xs font-normal text-slate-400">/10</span></div>
            <div className="text-xs text-slate-400 mt-0.5">Personal rating</div>
          </div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* By Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-lg">Status Breakdown</h3>
          </div>
          <div className="space-y-3">
            {stats.byStatus.map((item) => {
              const percentage = stats.totalItems > 0 ? Math.round((item.count / stats.totalItems) * 100) : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.status}</span>
                    <span className="text-amber-400 font-bold">{item.count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Media Type */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-slate-100 text-lg">Media Types</h3>
          </div>
          <div className="space-y-3">
            {stats.byType.map((item) => {
              const percentage = stats.totalItems > 0 ? Math.round((item.count / stats.totalItems) * 100) : 0;
              return (
                <div key={item.media_type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.media_type}</span>
                    <span className="text-blue-400 font-bold">{item.count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Quality */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-lg">Quality Watched</h3>
          </div>
          <div className="space-y-3">
            {stats.byQuality.map((item) => {
              const percentage = stats.totalItems > 0 ? Math.round((item.count / stats.totalItems) * 100) : 0;
              return (
                <div key={item.quality} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.quality}</span>
                    <span className="text-emerald-400 font-bold">{item.count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
