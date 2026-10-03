'use client';

import React, { useState } from 'react';
import { Key, X, Copy, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RecoveryKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRecoveryKey: string;
  onRestore: (recoveryKey: string) => Promise<boolean>;
}

export const RecoveryKeyModal: React.FC<RecoveryKeyModalProps> = ({
  isOpen,
  onClose,
  activeRecoveryKey,
  onRestore,
}) => {
  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(activeRecoveryKey);
    setCopied(true);
    confetti({ particleCount: 35, spread: 50, origin: { y: 0.4 } });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let val = inputKey.trim().toUpperCase();
    // Auto-extract SNAP-XXXX-XXXX even if user pasted extra text (e.g. "Key: SNAP-ABCD-1234")
    const match = val.match(/SNAP-[A-Z0-9]{4}-[A-Z0-9]{4}/);
    if (match) {
      val = match[0];
    }

    if (!val) {
      setErrorMsg('Please enter a valid Recovery Key (e.g. SNAP-XXXX-XXXX)');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const success = await onRestore(val);
      if (success) {
        onClose();
        setInputKey('');
      } else {
        setErrorMsg('Invalid or expired Recovery Key. Please check and try again.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error restoring inbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/10 max-w-md w-full rounded-3xl p-5 sm:p-7 relative shadow-2xl space-y-5 sm:space-y-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Recovery Key</h3>
            <p className="text-xs text-zinc-400">Restore your temporary inbox anytime (30 days)</p>
          </div>
        </div>

        {/* Current Key Section */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400">
            Active Recovery Key
          </span>
          <div className="flex items-center justify-between gap-2 bg-[#0a0a0c] p-3 rounded-xl border border-amber-500/25">
            <span className="font-mono text-base font-bold text-amber-400 tracking-wider">
              {activeRecoveryKey}
            </span>
            <button
              onClick={handleCopyKey}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            Save this key. You can use it to re-open this exact mailbox from another device.
          </p>
        </div>

        {/* Restore Section */}
        <form onSubmit={handleRestoreSubmit} className="space-y-3">
          <span className="text-xs font-semibold text-zinc-200">Restore a previous mailbox:</span>
          <div className="space-y-2">
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter Recovery Key (e.g. SNAP-9A21-44B2)"
              className="w-full bg-[#0a0a0c] border border-white/15 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none transition uppercase"
            />
            {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs sm:text-sm text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Restoring...' : 'Restore Inbox'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
