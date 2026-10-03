'use client';

import React, { useState } from 'react';
import {
  X,
  Trash2,
  Download,
  Key,
  ExternalLink,
  Code,
  FileText,
  Eye,
  Check,
  Calendar,
  User,
  Mail,
  ShieldAlert,
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

  if (!email) {
    return (
      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[460px] text-slate-500">
        <Mail className="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" />
        <h4 className="text-base font-medium text-slate-300">No email selected</h4>
        <p className="text-xs text-slate-500 mt-1">
          Select an email from the inbox list to read its content.
        </p>
      </div>
    );
  }

  const handleCopyOtp = () => {
    if (email.extractedOtp) {
      navigator.clipboard.writeText(email.extractedOtp);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const downloadEml = () => {
    const emlContent = `From: ${email.from.name ? `"${email.from.name}" <${email.from.address}>` : email.from.address}
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
    <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[580px] backdrop-blur-xl">
      {/* Top Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-white break-words">
            {email.subject || '(No Subject)'}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={downloadEml}
              title="Download as .eml"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(email.id)}
              title="Delete this message"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close reader"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sender & Recipient meta */}
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 w-12">From:</span>
            <span className="text-white font-medium">
              {email.from.name ? `${email.from.name} ` : ''}
              <span className="text-slate-400 font-mono">
                &lt;{email.from.address}&gt;
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 w-12">To:</span>
            <span className="font-mono text-indigo-300">{email.recipient}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 w-12">Date:</span>
            <span>{new Date(email.receivedAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Smart Quick Banner: OTP Code Detection */}
        {email.extractedOtp && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block">
                  Verification Code Detected
                </span>
                <span className="font-mono text-xl font-bold tracking-widest text-emerald-300">
                  {email.extractedOtp}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyOtp}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                copiedOtp
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {copiedOtp ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{copiedOtp ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
        )}

        {/* Smart Quick Banner: Action Link */}
        {email.extractedLink && (
          <div className="mt-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 text-xs">
            <span className="text-indigo-300 font-medium truncate">
              Verification Link Found
            </span>
            <a
              href={email.extractedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 shrink-0"
            >
              <span>Open Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('html')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === 'html'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>HTML Body</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Headers / Raw</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-4 bg-[#0a0e1a] min-h-[350px] overflow-auto">
        {activeTab === 'html' && (
          <div className="w-full h-full min-h-[360px] bg-white rounded-xl overflow-hidden shadow-inner">
            <iframe
              title="Email HTML Preview"
              srcDoc={
                email.html ||
                `<div style="font-family: sans-serif; padding: 20px; color: #333;">${email.text || 'No content'}</div>`
              }
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-full min-h-[360px] border-0"
            />
          </div>
        )}

        {activeTab === 'text' && (
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {email.text || 'No plain text content available.'}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(email, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
};
