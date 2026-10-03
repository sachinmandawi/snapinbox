'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Edit3,
  Key,
  Mail,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface EmailControlBarProps {
  currentEmail: string;
  onRefresh: () => void;
  onRandomize: () => void;
  onOpenCustomModal: () => void;
  onOpenRecoveryModal: () => void;
  onDeleteAll: () => void;
  isRefreshing: boolean;
  recoveryKeyPreview?: string;
}

export const EmailControlBar: React.FC<EmailControlBarProps> = ({
  currentEmail,
  onRefresh,
  onOpenCustomModal,
  onOpenRecoveryModal,
  isRefreshing,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentEmail);
      setCopied(true);
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.35 },
        colors: ['#6366f1', '#a855f7', '#38bdf8'],
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 sm:space-y-3.5">
      {/* Centerpiece: TempMailLab Pill Address Bar */}
      <div className="bg-[#141416] border border-white/15 hover:border-indigo-500/40 focus-within:border-indigo-500/50 rounded-full p-1.5 sm:p-2.5 pl-3.5 sm:pl-6 flex items-center justify-between shadow-2xl transition-all duration-300">
        {/* Left: Envelope Icon + Monospace Address */}
        <div
          onClick={handleCopy}
          className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0 pr-2 cursor-pointer group"
          title="Click to copy address"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 transition">
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="font-mono text-xs sm:text-base md:text-lg font-bold tracking-wide text-white select-all truncate group-hover:text-indigo-300 transition">
            {currentEmail}
          </span>
        </div>

        {/* Right: Rounded Pill Copy Button */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 sm:py-3 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg shrink-0 active:scale-95 ${
            copied
              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* The 3 Signature Action Cards Grid - Exact Identical Size (h-[68px] sm:h-[70px]) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. Refresh Button Card */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-[68px] sm:h-[70px] bg-white/[0.035] hover:bg-white/[0.075] border border-white/[0.08] hover:border-white/20 rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98 min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 shrink-0 transition">
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">Refresh</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate">Sync inbox</div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-indigo-500/20 shrink-0">
            10s
          </span>
        </button>

        {/* 2. Change / Custom Email Card */}
        <button
          onClick={onOpenCustomModal}
          className="h-[68px] sm:h-[70px] bg-white/[0.035] hover:bg-white/[0.075] border border-white/[0.08] hover:border-white/20 rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98 min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 shrink-0 transition">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">Change</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate">Custom username</div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-300 bg-white/5 group-hover:bg-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/10 shrink-0 transition">
            Edit
          </span>
        </button>

        {/* 3. Recovery Key Card (Exact Identical Size) */}
        <button
          onClick={onOpenRecoveryModal}
          className="h-[68px] sm:h-[70px] bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border border-amber-500/20 hover:border-amber-400/40 rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98 min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:border-amber-400/40 transition">
              <Key className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                Recovery Key
              </div>
              <div className="text-[10px] sm:text-[11px] text-amber-400/80 truncate font-mono">
                30-day restore
              </div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-amber-500/20 shrink-0">
            30d
          </span>
        </button>
      </div>
    </div>
  );
};
