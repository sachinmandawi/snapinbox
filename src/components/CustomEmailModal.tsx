'use client';

import React, { useState } from 'react';
import { X, Check, Edit3 } from 'lucide-react';

interface CustomEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  onSelectCustom: (newEmail: string) => void;
}

export const CustomEmailModal: React.FC<CustomEmailModalProps> = ({
  isOpen,
  onClose,
  domain,
  onSelectCustom,
}) => {
  const [prefix, setPrefix] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

    if (!cleanPrefix) {
      setError('Please enter a valid alias (letters, numbers, dots, dashes)');
      return;
    }

    if (cleanPrefix.length < 3) {
      setError('Alias must be at least 3 characters long');
      return;
    }

    onSelectCustom(`${cleanPrefix}@${domain}`);
    setPrefix('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create Custom Email</h3>
            <p className="text-xs text-slate-400">Choose your desired username</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Username
            </label>
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 focus-within:border-indigo-500 overflow-hidden">
              <input
                type="text"
                value={prefix}
                onChange={(e) => {
                  setPrefix(e.target.value);
                  setError('');
                }}
                placeholder="e.g. myname, testuser, verify"
                autoFocus
                className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <span className="bg-slate-800 px-3 py-2.5 text-xs text-slate-400 font-mono border-l border-slate-700 shrink-0">
                @{domain}
              </span>
            </div>
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
            >
              <Check className="w-4 h-4" />
              <span>Use This Address</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
