import React, { useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import Statistics from './components/Statistics';
import HistoryLog from './components/HistoryLog';
import Profile from './components/Profile';
import SearchModal from './components/SearchModal';
import MediaDetailModal from './components/MediaDetailModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMedia, setSelectedMedia] = useState(null); // for detail/edit modal
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAdd={() => setIsAddOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            key={refreshKey}
            setActiveTab={setActiveTab}
            onSelectItem={(item) => setSelectedMedia(item)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAdd={() => setIsAddOpen(true)}
          />
        )}
        {activeTab === 'library' && (
          <Library
            key={refreshKey}
            onSelectItem={(item) => setSelectedMedia(item)}
            onOpenAdd={() => setIsAddOpen(true)}
          />
        )}
        {activeTab === 'statistics' && <Statistics key={refreshKey} />}
        {activeTab === 'history' && <HistoryLog key={refreshKey} />}
        {activeTab === 'profile' && <Profile />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-amber-400">Mummy شافت</span>
            <span>— Personal Media Journal & Tracker</span>
          </div>
          <p>© 2026 Mummy شافت. Not a streaming website.</p>
        </div>
      </footer>

      {/* Search Modal */}
      {isSearchOpen && (
        <SearchModal
          onClose={() => setIsSearchOpen(false)}
          onMediaAdded={() => {
            triggerRefresh();
          }}
        />
      )}

      {/* Add / Edit Media Detail Modal */}
      {(isAddOpen || selectedMedia !== null) && (
        <MediaDetailModal
          item={selectedMedia}
          onClose={() => {
            setIsAddOpen(false);
            setSelectedMedia(null);
          }}
          onUpdated={() => {
            triggerRefresh();
          }}
        />
      )}
      <SpeedInsights />
    </div>
  );
}
