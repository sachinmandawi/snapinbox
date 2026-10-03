'use client';

import React from 'react';
import { Mail, ShieldCheck, BookOpen, Sparkles, RefreshCw } from 'lucide-react';

interface HeaderProps {
  domain: string;
  onOpenSetupGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({ domain, onOpenSetupGuide }) => {
  return (
    <header className="border-b border-slate-800/80 bg-[#0c1222]/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Snap<span className="text-indigo-400">Inbox</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                @{domain}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Free disposable temporary email generator
            </p>
          </div>
        </div>

        {/* Action badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenSetupGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Domain & DNS Setup</span>
            <span className="sm:hidden">Setup</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden md:inline">Auto-Sync Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};
