'use client';

import React from 'react';
import { X, Clock, Check, Trash2, Mail } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  history: string[];
  onSelectAddress: (address: string) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  history,
  onSelectAddress,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0e0f12] border border-white/10 rounded-[28px] w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl relative space-y-5 transition-all">
        
        {/* Top Header: Title & Pill Close Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Recent Mailboxes</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed -mt-2">
          Switch back to any of your recently generated temporary email addresses.
        </p>

        {/* History List */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pt-1">
          {history.length === 0 ? (
            <div className="text-center py-8 px-4 text-zinc-500 text-xs">
              No previous email addresses found in your browser history.
            </div>
          ) : (
            history.map((addr) => {
              const isActive = addr === currentEmail;
              return (
                <div
                  key={addr}
                  onClick={() => {
                    onSelectAddress(addr);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isActive
                      ? 'bg-sky-500/10 border-sky-500/30 text-white'
                      : 'bg-[#121318] hover:bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <Mail className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-zinc-500'}`} />
                    <span className="font-mono text-xs truncate font-medium">{addr}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isActive ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                        Switch &rarr;
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Actions */}
        {history.length > 0 && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-[11px] text-zinc-500 font-mono">
              {history.length} saved
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
