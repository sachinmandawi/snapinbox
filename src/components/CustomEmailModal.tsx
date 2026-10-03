'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const generateRandomName = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  useEffect(() => {
    if (currentEmail) {
      const parts = currentEmail.split('@');
      if (parts[0]) setPrefix(parts[0]);
      if (parts[1] && domains.includes(parts[1])) setSelectedDomain(parts[1]);
    } else {
      setPrefix(generateRandomName());
    }
  }, [currentEmail, domains, isOpen]);

  // Click outside to close custom domain dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  if (!isOpen) return null;

  const handleRandom = () => {
    setPrefix(generateRandomName());
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = prefix
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^\.+|\.+$/g, '')
      .replace(/\.{2,}/g, '.');

    if (!cleanPrefix) {
      setError('Please enter a valid mailbox name');
      return;
    }

    if (cleanPrefix.length < 3) {
      setError('Mailbox name must be at least 3 characters long');
      return;
    }

    if (cleanPrefix.length > 40) {
      setError('Mailbox name cannot exceed 40 characters');
      return;
    }

    onSelectCustom(`${cleanPrefix}@${selectedDomain}`);
    setError('');
    setIsDropdownOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      {/* Modal Card - Exact TempMailLab Style */}
      <div className="bg-[#0e0f12] border border-white/10 rounded-[28px] w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl relative space-y-5 sm:space-y-6 transition-all">
        
        {/* Top Header: Title & Pill Close Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Change Email</h2>
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
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed -mt-2 sm:-mt-3">
          Choose a custom name and domain. You can also generate a random name.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* EMAIL NAME SECTION */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              EMAIL NAME
            </label>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <input
                type="text"
                value={prefix}
                onChange={(e) => {
                  setPrefix(e.target.value);
                  setError('');
                }}
                placeholder="username"
                autoFocus
                className="flex-1 min-w-0 bg-[#070709] border border-white/15 focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={handleRandom}
                className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/30 text-xs font-bold text-white transition active:scale-95 shrink-0"
              >
                Random
              </button>
            </div>
            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          </div>

          {/* DOMAIN SECTION */}
          <div className="space-y-2" ref={dropdownRef}>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              DOMAIN
            </label>
            
            <div>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between bg-[#070709] border rounded-xl px-4 py-3 text-sm font-mono text-white transition cursor-pointer ${
                  isDropdownOpen
                    ? 'border-[#0284c7] ring-1 ring-[#0284c7]'
                    : 'border-white/15 hover:border-white/30'
                }`}
              >
                <span className="font-semibold text-zinc-100">{selectedDomain}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-[#0284c7]' : ''
                  }`}
                />
              </button>

              {/* Flexible Scrollable Dropdown Options (Inside Card Flow) */}
              {isDropdownOpen && (
                <div className="mt-2 bg-[#121318] border border-white/15 rounded-xl p-1.5 max-h-[160px] overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  {domains.map((dom) => {
                    const isSelected = selectedDomain === dom;
                    const isPrimary = dom === 'snapinbox.tech';
                    return (
                      <div
                        key={dom}
                        onClick={() => {
                          setSelectedDomain(dom);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer text-xs font-mono transition ${
                          isSelected
                            ? 'bg-[#0284c7]/20 text-[#38bdf8] font-bold border border-[#0284c7]/30'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span>{dom}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-sans font-bold tracking-wider ${
                              isPrimary
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-500/15 text-zinc-400 border border-white/10'
                            }`}
                          >
                            {isPrimary ? 'Primary' : 'Alias'}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#38bdf8]" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Confirm Change Button - Exact TempMailLab Solid Cyan/Blue */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] active:bg-[#075985] text-white font-bold text-sm tracking-wide transition-all duration-200 shadow-lg shadow-sky-600/25 active:scale-98 mt-2"
          >
            Confirm Change
          </button>
        </form>
      </div>
    </div>
  );
};
