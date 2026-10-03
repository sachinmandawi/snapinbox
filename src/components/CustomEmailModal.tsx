'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Edit3 } from 'lucide-react';

interface CustomEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain?: string;
  domains?: string[];
  currentEmail?: string;
  onSelectCustom: (newEmail: string) => void;
}

export const CustomEmailModal: React.FC<CustomEmailModalProps> = ({
  isOpen,
  onClose,
  domain = 'snapinbox.tech',
  domains = ['snapinbox.tech', 'mendoneet.me'],
  currentEmail = '',
  onSelectCustom,
}) => {
  const [prefix, setPrefix] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(domain);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentEmail) {
      const parts = currentEmail.split('@');
      if (parts[0]) setPrefix(parts[0]);
      if (parts[1] && domains.includes(parts[1])) setSelectedDomain(parts[1]);
    }
  }, [currentEmail, domains, isOpen]);

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

    onSelectCustom(`${cleanPrefix}@${selectedDomain}`);
    setPrefix('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#141416] border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative space-y-5">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create Custom Address</h3>
            <p className="text-xs text-zinc-400">Choose your username &amp; domain</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Email Username &amp; Domain
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 rounded-xl bg-[#0a0a0c] border border-white/15 focus-within:border-indigo-500 overflow-hidden px-3.5 py-2.5 transition">
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => {
                    setPrefix(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. myname, testuser"
                  autoFocus
                  className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none font-mono"
                />
              </div>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-[#0a0a0c] border border-white/15 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-indigo-300 font-mono font-semibold focus:outline-none shrink-0 cursor-pointer"
              >
                {domains.map((dom) => (
                  <option key={dom} value={dom} className="bg-[#141416] text-white">
                    @{dom}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:bg-white/5 border border-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
            >
              <Check className="w-4 h-4" />
              <span>Apply Address</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
