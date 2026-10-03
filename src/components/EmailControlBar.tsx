'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Edit3,
  Key,
  Mail,
  Zap,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface EmailControlBarProps {
  currentEmail: string;
  onRefresh: () => void;
  onRandomize: () => void;
  onOpenCustomModal: () => void;
  onOpenRecoveryModal: () => void;
  onTriggerTestSend: () => void;
  onDeleteAll: () => void;
  isRefreshing: boolean;
  recoveryKeyPreview?: string;
}

export const EmailControlBar: React.FC<EmailControlBarProps> = ({
  currentEmail,
  onRefresh,
  onOpenCustomModal,
  onOpenRecoveryModal,
  onTriggerTestSend,
  onDeleteAll,
  isRefreshing,
  recoveryKeyPreview = 'SNAP-••••',
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
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Centerpiece: TempMailLab Pill Address Bar */}
      <div className="bg-[#141416] border border-white/15 hover:border-indigo-500/40 focus-within:border-indigo-500/50 rounded-full p-2 sm:p-2.5 pl-4 sm:pl-6 flex items-center justify-between shadow-2xl transition-all duration-300">
        {/* Left: Envelope Icon + Monospace Address */}
        <div
          onClick={handleCopy}
          className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2 cursor-pointer group"
          title="Click to copy address"
        >
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 transition">
            <Mail className="w-4 h-4" />
          </div>
          <span className="font-mono text-base sm:text-lg font-bold tracking-wide text-white select-all truncate group-hover:text-indigo-300 transition">
            {currentEmail}
          </span>
        </div>

        {/* Right: Rounded Pill Copy Button */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-6 sm:px-7 py-3 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 shadow-lg shrink-0 active:scale-95 ${
            copied
              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* The 3 Signature Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Refresh Button Card */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-white/[0.035] hover:bg-white/[0.075] border border-white/[0.08] hover:border-white/20 rounded-2xl p-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition">
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}
              />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-100">Refresh</div>
              <div className="text-[11px] text-zinc-400">Sync inbox</div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            10s
          </span>
        </button>

        {/* 2. Change / Custom Email Card */}
        <button
          onClick={onOpenCustomModal}
          className="bg-white/[0.035] hover:bg-white/[0.075] border border-white/[0.08] hover:border-white/20 rounded-2xl p-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-100">Change</div>
              <div className="text-[11px] text-zinc-400">Custom username</div>
            </div>
          </div>
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition">
            ✏️
          </span>
        </button>

        {/* 3. Recovery Key Card */}
        <button
          onClick={onOpenRecoveryModal}
          className="bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border border-amber-500/20 hover:border-amber-400/40 rounded-2xl p-3.5 flex items-center justify-between text-left transition duration-200 shadow-lg group active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:border-amber-400/40 transition">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
                <span>Recovery Key</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <div className="text-[11px] text-amber-400/90 font-mono tracking-wider">
                {recoveryKeyPreview}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            30d
          </span>
        </button>
      </div>
    </div>
  );
};
