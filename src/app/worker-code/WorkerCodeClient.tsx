'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, ExternalLink, ArrowLeft, Terminal, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WorkerCodeClientProps {
  code: string;
}

export function WorkerCodeClient({ code }: WorkerCodeClientProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.3 },
        colors: ['#6366f1', '#38bdf8', '#10b981'],
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5] selection:bg-indigo-500/30 selection:text-indigo-200 p-4 sm:p-8">
      {/* Ambient Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-b from-indigo-600/12 via-indigo-900/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>

          <span className="text-xs text-zinc-400 font-mono">
            {code.length.toLocaleString()} bytes &bull; 1,293 lines
          </span>
        </div>

        {/* Hero Section */}
        <div className="bg-[#0e0e11] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Cloudflare All-in-One Worker Script</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Cloudflare Worker Deployment Code
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
                This single script handles email routing, KV storage, password recovery keys, and the exact TempMailLab mirror frontend for <strong>mendoneet.me</strong>.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-xl transition-all active:scale-95 ${
                  copied
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02]'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                <span>{copied ? 'Copied to Clipboard! ✨' : 'Copy Entire Code'}</span>
              </button>

              <a
                href="/worker-code.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-semibold text-xs sm:text-sm transition"
                title="View as raw text in new tab"
              >
                <span>Raw Text</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Instructions Box */}
          <div className="bg-[#141418] border border-white/[0.08] rounded-2xl p-4 text-xs text-zinc-300 space-y-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
              How to Deploy in 30 Seconds:
            </span>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>Click the big <strong className="text-indigo-400">Copy Entire Code</strong> button above.</li>
              <li>Go to <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Cloudflare Dashboard</a> &rarr; <strong>Workers &amp; Pages</strong> &rarr; <strong>mendoneet-worker</strong>.</li>
              <li>Click <strong>Quick Edit</strong> / <strong>Edit code</strong>, select all (<kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/20">Ctrl+A</kbd>), and paste (<kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/20">Ctrl+V</kbd>).</li>
              <li>Click <strong className="text-emerald-400">Save and Deploy</strong> &mdash; done!</li>
            </ol>
          </div>
        </div>

        {/* Code Box */}
        <div className="bg-[#0a0a0c] border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-5 py-3.5 border-b border-white/10 bg-[#121215] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-zinc-300 font-semibold">cloudflare-worker/worker-fullstack.js</span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Click to Copy'}</span>
            </button>
          </div>
          <pre className="p-4 sm:p-6 text-xs text-zinc-300 font-mono overflow-auto max-h-[600px] leading-relaxed selection:bg-indigo-500/40">
            <code>{code}</code>
          </pre>
        </div>

      </div>
    </div>
  );
}
