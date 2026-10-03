'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Trash2,
  Download,
  Key,
  ExternalLink,
  Code,
  FileText,
  Check,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';
import { EmailMessage } from '@/types/email';

interface EmailViewerProps {
  email: EmailMessage | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const EmailViewer: React.FC<EmailViewerProps> = ({
  email,
  onClose,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'raw'>('html');
  const [copiedOtp, setCopiedOtp] = useState(false);

  if (!email) return null;

  const handleCopyOtp = () => {
    if (email.extractedOtp) {
      navigator.clipboard.writeText(email.extractedOtp);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const downloadEml = () => {
    const emlContent = `From: ${email.from.name ? `${email.from.name} ` : ''}<${email.from.address}>
To: ${email.recipient}
Subject: ${email.subject}
Date: ${new Date(email.receivedAt).toUTCString()}
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

${email.html || email.text || ''}`;

    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${email.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'email'}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0d0d0f] border border-sky-500/40 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] rounded-2xl sm:rounded-[1.75rem] overflow-hidden flex flex-col min-h-[500px] sm:min-h-[580px] transition-all duration-300">
      
      {/* Top Navigation Row: Back to Inbox & Actions */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02]">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-white/10 transition active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inbox</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={downloadEml}
            title="Download as .eml"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EML</span>
          </button>
          <button
            onClick={() => onDelete(email.id)}
            title="Delete this message"
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Email Header Meta */}
      <div className="p-4 sm:p-7 border-b border-white/[0.08] bg-[#121215]/50 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>SPF: PASS &bull; DKIM: PASS</span>
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            {new Date(email.receivedAt).toLocaleString()}
          </span>
        </div>

        <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight break-words">
          {email.subject || '(No Subject)'}
        </h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-zinc-300 font-medium shrink-0">From:</span>
            <span className="text-white font-medium truncate">
              {email.from.name ? `${email.from.name} ` : ''}
              <span className="text-zinc-500 font-mono">&lt;{email.from.address}&gt;</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-zinc-300 font-medium shrink-0">To:</span>
            <span className="font-mono text-indigo-300 truncate">{email.recipient}</span>
          </div>
        </div>

        {/* Smart Quick Banner: OTP Code Detection */}
        {email.extractedOtp && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Key className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                  Detected Verification OTP
                </span>
                <span className="font-mono text-xl sm:text-2xl font-extrabold tracking-widest text-white">
                  {email.extractedOtp}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyOtp}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 w-full sm:w-auto ${
                copiedOtp
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
              }`}
            >
              {copiedOtp ? <Check className="w-4 h-4" /> : null}
              <span>{copiedOtp ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        )}

        {/* Smart Action Link Banner */}
        {email.extractedLink && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-xs">
            <span className="text-indigo-300 font-medium truncate">
              Primary verification link detected
            </span>
            <a
              href={email.extractedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 shrink-0 transition"
            >
              <span>Open Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 pt-3.5 flex items-center gap-3 border-b border-white/[0.08] text-xs">
        <button
          onClick={() => setActiveTab('html')}
          className={`pb-2.5 font-bold transition ${
            activeTab === 'html'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          HTML Body
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`pb-2.5 font-bold transition ${
            activeTab === 'text'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Plain Text
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`pb-2.5 font-bold transition ${
            activeTab === 'raw'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Raw MIME
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 p-3 sm:p-6 bg-[#08080a] overflow-auto">
        {activeTab === 'html' && (
          <div className="w-full min-h-[360px] sm:min-h-[500px] bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-inner">
            <iframe
              srcDoc={email.html || `<p style="padding:20px;font-family:sans-serif;">${email.text}</p>`}
              className="w-full min-h-[360px] sm:min-h-[500px] border-none"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        )}

        {activeTab === 'text' && (
          <pre className="p-3.5 sm:p-4 bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-white/5 text-zinc-300 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
            {email.text || 'No plain text content available.'}
          </pre>
        )}

        {activeTab === 'raw' && (
          <pre className="p-3.5 sm:p-4 bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-white/5 text-zinc-400 font-mono text-xs whitespace-pre-wrap leading-tight overflow-x-auto">
            {email.rawMime || JSON.stringify(email, null, 2)}
          </pre>
        )}
      </div>

    </div>
  );
};
