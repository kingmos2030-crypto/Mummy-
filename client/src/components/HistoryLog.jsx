import React, { useState, useEffect } from 'react';
import { History, Film, Clock, Star, CheckCircle, RefreshCw } from 'lucide-react';
import { getStats } from '../utils/api';

export default function HistoryLog() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await getStats();
      setHistory(res.data.recentActivity || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Media History Timeline
          </h1>
          <p className="text-slate-400 text-sm">
            Chronological record of all updates, additions, and tracking milestones.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-4 py-2 rounded-xl text-sm transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-amber-400" />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-16 text-center space-y-3">
          <History className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-medium">No history logged yet.</p>
          <p className="text-slate-500 text-sm">Your actions will appear here as you track your media journal.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="relative border-l-2 border-slate-800 ml-4 space-y-6">
            {history.map((log) => (
              <div key={log.id} className="relative pl-6 flex items-start space-x-4">
                {/* Timeline dot */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-amber-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-16 rounded-xl bg-slate-900 flex-shrink-0 overflow-hidden border border-slate-800">
                      {log.poster_path ? (
                        <img src={log.poster_path} alt={log.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{log.title || 'Unknown Media'}</h4>
                      <p className="text-xs text-amber-400 font-medium mt-0.5">{log.details}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400 font-semibold uppercase tracking-wider border border-slate-800">
                        {log.action}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center space-x-1 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
