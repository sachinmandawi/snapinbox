'use client';

import React, { useState } from 'react';
import { Mail, Clock, Trash2, Key, Check, Inbox } from 'lucide-react';
import { EmailMessage } from '@/types/email';
import { formatTimeAgo } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface EmailListProps {
  emails: EmailMessage[];
  selectedEmailId: string | null;
  onSelectEmail: (email: EmailMessage) => void;
  onDeleteEmail: (id: string, e: React.MouseEvent) => void;
  currentEmail: string;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  currentEmail,
}) => {
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);

  const handleCopyOtp = (otp: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(otp);
    setCopiedOtpId(id);
    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.5 } });
    } catch (err) {}
    setTimeout(() => setCopiedOtpId(null), 2000);
  };

  if (emails.length === 0) {
    return (
      <div className="bg-[#121214]/80 border border-white/10 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[360px] shadow-2xl">
        {/* Radar pulsing effect */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-600/30 to-sky-400/20 flex items-center justify-center border border-sky-500/30 shadow-lg shadow-sky-600/20">
            <Inbox className="w-8 h-8 text-sky-400" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-2">
          Waiting for incoming messages...
        </h3>
        <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
          Send an email or verification code to{' '}
          <span className="font-mono text-sky-300 font-semibold break-all">
            {currentEmail}
          </span>
          . Incoming messages will appear here in real-time.
        </p>

        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time listener active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#121214]/80 border border-white/10 rounded-3xl divide-y divide-white/[0.08] overflow-hidden shadow-2xl">
      <div className="px-5 py-3.5 bg-white/[0.02] flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-white/[0.08]">
        <span>INBOX ({emails.length})</span>
        <span>LATEST FIRST</span>
      </div>

      <div className="divide-y divide-white/[0.06] max-h-[600px] overflow-y-auto">
        {emails.map((email) => {
          const isSelected = email.id === selectedEmailId;
          const senderInitial = (email.from.name || email.from.address || '?')
            .charAt(0)
            .toUpperCase();

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className={`p-4 transition-all cursor-pointer relative group flex items-start gap-3 ${
                isSelected
                  ? 'bg-sky-950/40 border-l-4 border-sky-500'
                  : 'hover:bg-slate-800/40 border-l-4 border-transparent'
              } ${!email.read ? 'bg-slate-900/40' : ''}`}
            >
              {/* Sender Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                {senderInitial}
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`text-sm truncate ${
                      !email.read ? 'font-bold text-white' : 'font-medium text-slate-300'
                    }`}
                  >
                    {email.from.name || email.from.address}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(email.receivedAt)}
                  </span>
                </div>

                <h4
                  className={`text-sm truncate mb-1 ${
                    !email.read ? 'text-sky-200 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {email.subject || '(No Subject)'}
                </h4>

                <p className="text-xs text-slate-500 line-clamp-1">
                  {email.text || 'No preview available'}
                </p>

                {/* Badges: OTP with 1-click copy */}
                {email.extractedOtp && (
                  <button
                    onClick={(e) => handleCopyOtp(email.extractedOtp!, email.id, e)}
                    className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition active:scale-95 border ${
                      copiedOtpId === email.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 text-amber-300'
                    }`}
                    title="Click to copy OTP code"
                  >
                    <Key className="w-3 h-3" />
                    <span>OTP: {email.extractedOtp}</span>
                    <span className="text-[10px] pl-1 font-sans font-medium text-zinc-400">
                      {copiedOtpId === email.id ? 'Copied!' : 'Copy'}
                    </span>
                  </button>
                )}
              </div>

              {/* Delete action button (visible on mobile touch, hover on desktop) */}
              <button
                onClick={(e) => onDeleteEmail(email.id, e)}
                title="Delete message"
                className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0 active:scale-90"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
