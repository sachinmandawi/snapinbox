'use client';

import React from 'react';
import Link from 'next/link';
import { SnapInboxLogo } from './SnapInboxLogo';

interface HeaderProps {
  domain?: string;
  onOpenSetupGuide?: () => void;
  onOpenRecoveryModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenRecoveryModal }) => {
  return (
    <header className="border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo Link */}
        <Link href="/" className="flex items-center">
          <SnapInboxLogo size="md" />
        </Link>

        {/* Right side navigation links */}
        <div className="flex items-center gap-3 text-xs font-medium text-zinc-400">
          {onOpenRecoveryModal && (
            <button
              onClick={onOpenRecoveryModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition shadow-sm active:scale-95"
            >
              <span>🔑 Restore Inbox</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
