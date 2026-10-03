'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Edit3,
  Key,
  Mail,
  Trash2,
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
  onDeleteAll,
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
    <div className="w-full max-w-4xl mx-auto space-y-3.5">
      {/* Centerpiece: TempMailLab Pill Address Bar */}
      <div className="bg-[#121215]/90 border border-white/15 hover:border-indigo-500/40 focus-within:border-indigo-500/50 rounded-full p-1.5 sm:p-2.5 pl-3.5 sm:pl-6 flex items-center justify-between shadow-2xl backdrop-blur-xl transition-all duration-300">
        {/* Left: Envelope Icon + Monospace Address */}
        <div
          onClick={handleCopy}
          className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0 pr-2 cursor-pointer group"
          title="Click to copy address"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 group-hover:text-indigo-300 transition shadow-inner">
            <Mail className="w-4 h-4" />
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

      {/* The 4 Signature Action Cards Grid - Zero Text Truncation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* 1. Refresh Button Card */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-[74px] sm:h-[76px] bg-[#121215]/80 hover:bg-white/[0.06] border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl px-3 sm:px-4 flex items-center justify-between text-left transition-all duration-200 shadow-lg group active:scale-95 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/40 shrink-0 transition">
              <RefreshCw
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}
              />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-zinc-100 whitespace-nowrap">Refresh</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap">Sync inbox</div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 shrink-0 ml-1">
            10s
          </span>
        </button>

        {/* 2. Change / Custom Email Card */}
        <button
          onClick={onOpenCustomModal}
          className="h-[74px] sm:h-[76px] bg-[#121215]/80 hover:bg-white/[0.06] border border-white/[0.08] hover:border-violet-500/30 rounded-2xl px-3 sm:px-4 flex items-center justify-between text-left transition-all duration-200 shadow-lg group active:scale-95 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-zinc-300 group-hover:text-violet-400 group-hover:border-violet-500/40 shrink-0 transition">
              <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-zinc-100 whitespace-nowrap">Change</div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap">Custom alias</div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-300 bg-white/5 group-hover:bg-white/10 px-2 py-0.5 rounded-full border border-white/10 shrink-0 ml-1 transition">
            Edit
          </span>
        </button>

        {/* 3. Delete / Clear Mailbox Card */}
        <button
          onClick={onDeleteAll}
          className="h-[74px] sm:h-[76px] bg-rose-500/[0.03] hover:bg-rose-500/[0.08] border border-rose-500/20 hover:border-rose-500/40 rounded-2xl px-3 sm:px-4 flex items-center justify-between text-left transition-all duration-200 shadow-lg group active:scale-95 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 group-hover:border-rose-400/50 group-hover:scale-105 shrink-0 transition">
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-rose-200 whitespace-nowrap transition">
                Delete
              </div>
              <div className="text-[10px] sm:text-[11px] text-rose-400/80 whitespace-nowrap">
                Wipe inbox
              </div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0 ml-1">
            Wipe
          </span>
        </button>

        {/* 4. Recovery Key Card */}
        <button
          onClick={onOpenRecoveryModal}
          className="h-[74px] sm:h-[76px] bg-amber-500/[0.03] hover:bg-amber-500/[0.08] border border-amber-500/20 hover:border-amber-400/40 rounded-2xl px-3 sm:px-4 flex items-center justify-between text-left transition-all duration-200 shadow-lg group active:scale-95 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:border-amber-400/40 group-hover:scale-105 transition">
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-amber-200 whitespace-nowrap transition">
                Recovery Key
              </div>
              <div className="text-[10px] sm:text-[11px] text-amber-400/80 whitespace-nowrap font-mono">
                30d restore
              </div>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 ml-1">
            30d
          </span>
        </button>
      </div>
    </div>
  );
};
