'use client';

import React from 'react';
import { Mail, Clock, Trash2, Key, ExternalLink, Inbox } from 'lucide-react';
import { EmailMessage } from '@/types/email';
import { formatTimeAgo } from '@/lib/utils';

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
  if (emails.length === 0) {
    return (
      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
        {/* Radar pulsing effect */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center radar-active border border-indigo-500/30">
            <Inbox className="w-8 h-8 text-indigo-400" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-100 mb-2">
          Your inbox is ready and listening!
        </h3>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          Send an email or verification code to{' '}
          <span className="font-mono text-indigo-300 font-semibold break-all">
            {currentEmail}
          </span>
          . Incoming messages will appear here in real-time.
        </p>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Polling server every 4 seconds</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-xl">
      <div className="px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800">
        <span>INBOX ({emails.length})</span>
        <span>LATEST FIRST</span>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
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
                  ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                  : 'hover:bg-slate-800/40 border-l-4 border-transparent'
              } ${!email.read ? 'bg-slate-900/40' : ''}`}
            >
              {/* Sender Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
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
                    !email.read ? 'text-indigo-200 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {email.subject || '(No Subject)'}
                </h4>

                <p className="text-xs text-slate-500 line-clamp-1">
                  {email.text || 'No preview available'}
                </p>

                {/* Badges: OTP or links */}
                {email.extractedOtp && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Key className="w-3 h-3" />
                    <span>OTP: {email.extractedOtp}</span>
                  </div>
                )}
              </div>

              {/* Delete action button on hover */}
              <button
                onClick={(e) => onDeleteEmail(email.id, e)}
                title="Delete message"
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
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
