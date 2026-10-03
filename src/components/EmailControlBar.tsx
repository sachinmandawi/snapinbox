'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Shuffle,
  Edit3,
  QrCode,
  Zap,
  Clock,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface EmailControlBarProps {
  currentEmail: string;
  onRefresh: () => void;
  onRandomize: () => void;
  onOpenCustomModal: () => void;
  onOpenQrModal: () => void;
  onTriggerTestSend: () => void;
  onDeleteAll: () => void;
  isRefreshing: boolean;
  expirySeconds: number;
  onExtendExpiry: () => void;
}

export const EmailControlBar: React.FC<EmailControlBarProps> = ({
  currentEmail,
  onRefresh,
  onRandomize,
  onOpenCustomModal,
  onOpenQrModal,
  onTriggerTestSend,
  onDeleteAll,
  isRefreshing,
  expirySeconds,
  onExtendExpiry,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentEmail);
      setCopied(true);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.35 },
        colors: ['#6366f1', '#a855f7', '#38bdf8'],
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Background glow effect */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top row: Label & Expiry timer */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Your Disposable Email Address
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
            Catch-All Enabled
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Expires in {formatTimer(expirySeconds)}</span>
          </div>
          <button
            onClick={onExtendExpiry}
            title="Extend lifespan by 10 minutes"
            className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md border border-slate-700 transition"
          >
            +10m
          </button>
        </div>
      </div>

      {/* Email Display & Main Copy Box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div
          onClick={handleCopy}
          className="flex-1 flex items-center justify-between bg-[#0a0f1d] border border-indigo-500/30 hover:border-indigo-400/60 rounded-xl px-4 py-3 cursor-pointer group transition-all duration-200 shadow-inner"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-lg sm:text-xl font-bold tracking-wide text-white truncate group-hover:text-indigo-200 transition">
              {currentEmail}
            </span>
          </div>
          <span className="text-xs font-medium text-indigo-400 group-hover:text-indigo-300 shrink-0 ml-2">
            {copied ? 'Copied!' : 'Click to copy'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-500/25 ring-2 ring-emerald-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh inbox"
            className="flex items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Action Row */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRandomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
          >
            <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Randomize</span>
          </button>

          <button
            onClick={onOpenCustomModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Custom Name</span>
          </button>

          <button
            onClick={onOpenQrModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-400" />
            <span>QR Code</span>
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Simulate Test Email Button */}
          <button
            onClick={onTriggerTestSend}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 transition shadow-sm font-medium"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Simulate Test Email</span>
          </button>

          <button
            onClick={onDeleteAll}
            title="Delete all emails in this inbox"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
