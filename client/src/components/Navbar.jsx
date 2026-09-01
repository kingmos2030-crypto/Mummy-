import React from 'react';
import { Film, Home, Library, BarChart2, History, User, Search, Plus } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenSearch, onOpenAdd }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'library', label: 'My Library', icon: Library },
    { id: 'statistics', label: 'Statistics', icon: BarChart2 },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold text-xl">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                  Mummy شافت
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Journal
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Everything I watched & want to watch</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenSearch}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium border border-slate-700 transition shadow-sm"
              title="Search TMDB & TVMaze"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Search Media</span>
            </button>

            <button
              onClick={onOpenAdd}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Media</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Subheader Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800 bg-slate-900/95 py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg text-xs font-medium transition ${
                isActive ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
