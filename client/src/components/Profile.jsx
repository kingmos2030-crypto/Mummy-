import React, { useState, useEffect } from 'react';
import { User, Save, Download, Upload, RefreshCw, Sparkles, Film, CheckCircle } from 'lucide-react';
import { getProfile, updateProfile, getBackup, restoreBackup, addMediaItem } from '../utils/api';

export default function Profile() {
  const [profile, setProfile] = useState({ name: '', tagline: '', avatar: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await getProfile();
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateProfile(profile);
      setProfile(res.data);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await getBackup();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mummy_shaft_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImport = (e) => {
    const fileReader = new FileReader();
    if (e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await restoreBackup(json);
          alert('Backup restored successfully!');
          window.location.reload();
        } catch (err) {
          alert('Failed to restore backup: Invalid JSON format.');
          console.error(err);
        }
      };
    }
  };

  const handleSeedSampleData = async () => {
    if (window.confirm("Add sample media items (Breaking Bad, Attack on Titan, Interstellar, Spirited Away) to your journal?")) {
      try {
        const samples = [
          {
            title: "Breaking Bad",
            media_type: "TV Show",
            status: "Completed",
            rating: 10,
            quality: "4K / 2160p",
            notes: "Absolute cinematic masterpiece. Walter White's descent is legendary.",
            is_favorite: 1,
            total_episodes: 62,
            current_episode: 62,
            total_seasons: 5,
            current_season: 5,
            poster_path: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
            overview: "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student.",
            release_date: "2008-01-20"
          },
          {
            title: "Interstellar",
            media_type: "Movie",
            status: "Completed",
            rating: 9.5,
            quality: "4K / 2160p",
            notes: "Hans Zimmer soundtrack is out of this world. Mind-bending sci-fi.",
            is_favorite: 1,
            poster_path: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
            overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
            release_date: "2014-11-05"
          },
          {
            title: "Attack on Titan",
            media_type: "Anime",
            status: "Completed",
            rating: 10,
            quality: "1080p",
            notes: "Best plot progression in anime history. Incredible animation by WIT and MAPPA.",
            is_favorite: 1,
            total_episodes: 89,
            current_episode: 89,
            total_seasons: 4,
            current_season: 4,
            poster_path: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
            overview: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.",
            release_date: "2013-04-07"
          },
          {
            title: "Spirited Away",
            media_type: "Anime",
            status: "Completed",
            rating: 9.0,
            quality: "BluRay",
            notes: "Studio Ghibli magic at its absolute finest. Breathtaking world-building.",
            is_favorite: 1,
            poster_path: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
            overview: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
            release_date: "2001-07-20"
          }
        ];

        for (const sample of samples) {
          await addMediaItem(sample);
        }
        alert("Sample media successfully added to your journal!");
        window.location.reload();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
          Profile & Journal Settings
        </h1>
        <p className="text-slate-400 text-sm">
          Customize your Mummy شافت identity and manage data backups.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <User className="w-6 h-6 text-amber-400" />
          <h2 className="text-lg font-bold text-slate-100">Personal Profile</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-950 border-2 border-amber-500/50 shadow-xl flex-shrink-0">
              <img src={profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'} alt="Avatar" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={profile.avatar || ''}
                  onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Personal Tagline / Bio</label>
            <input
              type="text"
              value={profile.tagline || ''}
              onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backup & Data Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <Download className="w-6 h-6 text-amber-400" />
          <h2 className="text-lg font-bold text-slate-100">Data Backup & Recovery</h2>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">
          Export your complete Mummy شافت media journal as a JSON backup file, or restore from a previous backup.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3 rounded-xl border border-slate-700 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3 rounded-xl border border-slate-700 transition shadow-sm cursor-pointer">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Import JSON Backup</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={handleSeedSampleData}
            className="flex items-center space-x-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-400 font-semibold px-5 py-3 rounded-xl border border-amber-500/30 transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed Sample Media</span>
          </button>
        </div>
      </div>
    </div>
  );
}
