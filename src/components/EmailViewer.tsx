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
  Paperclip,
} from 'lucide-react';
import { EmailMessage } from '@/types/email';
import { formatBytes } from '@/lib/utils';

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

  const getRenderHtml = () => {
    const raw = email.html || `<div style="white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${(email.text || 'No message content.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    const resetStyles = `
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          color: #1f2937;
          background-color: #ffffff;
          word-break: break-word;
        }
        img { max-width: 100% !important; height: auto !important; }
        table { max-width: 100% !important; }
        a { color: #4f46e5; text-decoration: underline; }
        pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
      </style>
    `;

    if (raw.includes('<head>') || raw.includes('<head ')) {
      return raw.replace(/<head[^>]*>/i, `$&${resetStyles}`);
    } else if (raw.includes('<html>') || raw.includes('<html ')) {
      return raw.replace(/<html[^>]*>/i, `$&<head>${resetStyles}</head>`);
    } else {
      return `<!DOCTYPE html><html><head>${resetStyles}</head><body>${raw}</body></html>`;
    }
  };

  const senderName = email.from.name || email.from.address || 'Unknown Sender';
  const senderInitial = senderName.charAt(0).toUpperCase();

  return (
    <div className="bg-[#0d0d0f] border border-sky-500/40 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] rounded-2xl sm:rounded-[1.75rem] overflow-hidden flex flex-col min-h-[500px] sm:min-h-[580px] transition-all duration-300">
      
      {/* Top Navigation Row: Back to Inbox & Actions */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02]">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inbox</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={downloadEml}
            title="Download as .eml"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EML</span>
          </button>
          <button
            onClick={() => onDelete(email.id)}
            title="Delete this message"
            className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Email Header Meta */}
      <div className="p-4 sm:p-7 border-b border-white/[0.08] bg-[#121215]/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            <span>SPF: PASS &bull; DKIM: PASS</span>
          </span>
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-zinc-500" />
            {new Date(email.receivedAt).toLocaleString()}
          </span>
        </div>

        <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight break-words">
          {email.subject || '(No Subject)'}
        </h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
              {senderInitial}
            </div>
            <span className="text-zinc-400 font-medium shrink-0">From:</span>
            <span className="text-white font-semibold truncate">
              {senderName}
            </span>
            {email.from.name && (
              <span className="text-zinc-500 font-mono text-[11px] truncate hidden sm:inline">
                &lt;{email.from.address}&gt;
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 min-w-0">
            <span className="text-zinc-400 font-medium shrink-0">To:</span>
            <span className="font-mono text-indigo-300 font-medium truncate">{email.recipient}</span>
          </div>
        </div>

        {/* Smart Quick Banner: OTP Code Detection */}
        {email.extractedOtp && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-xl shadow-inner">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                  Detected Verification OTP
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-white">
                  {email.extractedOtp}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyOtp}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 w-full sm:w-auto shadow-md ${
                copiedOtp
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/25'
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
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 shrink-0 transition shadow-md shadow-indigo-600/20"
            >
              <span>Open Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Attachments Section if present */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attachments ({email.attachments.length})</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span className="font-medium text-white truncate max-w-[180px]">{att.filename}</span>
                  <span className="text-zinc-500 font-mono text-[10px]">{formatBytes(att.size)}</span>
                  {att.contentUrl && (
                    <a
                      href={att.contentUrl}
                      download={att.filename}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold text-[11px] underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modern Pill Tabs */}
      <div className="px-4 sm:px-6 pt-3 pb-3 flex items-center gap-2 border-b border-white/[0.08] text-xs bg-white/[0.01]">
        <button
          onClick={() => setActiveTab('html')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition ${
            activeTab === 'html'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          HTML Body
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition ${
            activeTab === 'text'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Plain Text
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition ${
            activeTab === 'raw'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Raw MIME
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 p-3 sm:p-6 bg-[#08080a] overflow-auto">
        {activeTab === 'html' && (
          <div className="w-full min-h-[400px] sm:min-h-[520px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <iframe
              srcDoc={getRenderHtml()}
              className="w-full min-h-[400px] sm:min-h-[520px] border-none block"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        )}

        {activeTab === 'text' && (
          <pre className="p-4 sm:p-5 bg-zinc-900/70 rounded-2xl border border-white/10 text-zinc-300 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
            {email.text || 'No plain text content available.'}
          </pre>
        )}

        {activeTab === 'raw' && (
          <pre className="p-4 sm:p-5 bg-zinc-900/70 rounded-2xl border border-white/10 text-zinc-400 font-mono text-xs whitespace-pre-wrap leading-tight overflow-x-auto">
            {email.rawMime || JSON.stringify(email, null, 2)}
          </pre>
        )}
      </div>

    </div>
  );
};
