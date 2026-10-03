'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EmailControlBar } from '@/components/EmailControlBar';
import { EmailList } from '@/components/EmailList';
import { EmailViewer } from '@/components/EmailViewer';
import { CustomEmailModal } from '@/components/CustomEmailModal';
import { QrModal } from '@/components/QrModal';
import { RecoveryKeyModal } from '@/components/RecoveryKeyModal';
import { SetupGuideModal } from '@/components/SetupGuideModal';
import { EmailMessage } from '@/types/email';
import { generateRandomUsername } from '@/lib/utils';
import {
  ShieldCheck,
  Zap,
  Lock,
  Globe,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

const DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'mendoneet.me';

export default function Home() {
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [recoveryKey, setRecoveryKey] = useState<string>('');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  // Audio Chime
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }, [soundEnabled]);

  // Generate unique recovery key
  const generateRecoveryKey = () => {
    const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SNAP-${part1}-${part2}`;
  };

  // Ensure recovery key is active and synced
  const syncRecoveryKey = useCallback(async (email: string) => {
    const storageKey = `snapinbox_rec_${email.toLowerCase().trim()}`;
    let key = localStorage.getItem(storageKey);
    if (!key) {
      key = generateRecoveryKey();
      localStorage.setItem(storageKey, key);
    }
    setRecoveryKey(key);

    try {
      await fetch('/api/recovery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, recoveryKey: key }),
      });
    } catch (e) {}
  }, []);

  // Initialize or restore email address
  useEffect(() => {
    const saved = localStorage.getItem('mendoneet_temp_email');
    let activeEmail = '';
    if (saved && saved.endsWith(`@${DOMAIN}`)) {
      activeEmail = saved;
    } else {
      activeEmail = `${generateRandomUsername()}@${DOMAIN}`;
      localStorage.setItem('mendoneet_temp_email', activeEmail);
    }
    setEmailAddress(activeEmail);
    syncRecoveryKey(activeEmail);
  }, [syncRecoveryKey]);

  // Fetch emails for the active email address
  const fetchEmails = useCallback(
    async (isManual = false) => {
      if (!emailAddress) return;
      if (isManual) setIsRefreshing(true);

      try {
        const res = await fetch(`/api/emails?address=${encodeURIComponent(emailAddress)}`);
        if (res.ok) {
          const data = await res.json();
          const newEmails: EmailMessage[] = data.emails || [];

          setEmails((prev) => {
            if (newEmails.length > prev.length) {
              playChime();
              if (!selectedEmail && newEmails.length > 0) {
                setSelectedEmail(newEmails[0]);
              }
            }
            return newEmails;
          });

          if (selectedEmail) {
            const updated = newEmails.find((e) => e.id === selectedEmail.id);
            if (updated) setSelectedEmail(updated);
          }
        }
      } catch (err) {
        console.error('Failed to fetch emails:', err);
      } finally {
        if (isManual) {
          setTimeout(() => setIsRefreshing(false), 500);
        }
      }
    },
    [emailAddress, playChime, selectedEmail]
  );

  // Polling loop: fetch emails every 4 seconds
  useEffect(() => {
    if (!emailAddress) return;
    fetchEmails();
    const interval = setInterval(() => fetchEmails(), 4000);
    return () => clearInterval(interval);
  }, [emailAddress, fetchEmails]);

  // Handlers
  const handleRandomize = () => {
    const newAddress = `${generateRandomUsername()}@${DOMAIN}`;
    setEmailAddress(newAddress);
    localStorage.setItem('mendoneet_temp_email', newAddress);
    syncRecoveryKey(newAddress);
    setEmails([]);
    setSelectedEmail(null);
  };

  const handleSelectCustom = (newEmail: string) => {
    setEmailAddress(newEmail);
    localStorage.setItem('mendoneet_temp_email', newEmail);
    syncRecoveryKey(newEmail);
    setEmails([]);
    setSelectedEmail(null);
  };

  const handleRestoreRecoveryKey = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/recovery/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: key }),
      });
      const data = await res.json();
      if (data.success && data.address) {
        setEmailAddress(data.address);
        setRecoveryKey(key);
        localStorage.setItem('mendoneet_temp_email', data.address);
        localStorage.setItem(`snapinbox_rec_${data.address.toLowerCase().trim()}`, key);
        setEmails(data.emails || []);
        if (data.emails && data.emails.length > 0) {
          setSelectedEmail(data.emails[0]);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDeleteEmail = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/emails?address=${encodeURIComponent(emailAddress)}&id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEmails((prev) => prev.filter((item) => item.id !== id));
        if (selectedEmail?.id === id) setSelectedEmail(null);
      }
    } catch (err) {
      console.error('Delete email failed:', err);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all emails in this temporary inbox?')) return;
    try {
      const res = await fetch(`/api/emails?address=${encodeURIComponent(emailAddress)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEmails([]);
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error('Clear inbox failed:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-[#f5f5f5] selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-b from-indigo-600/12 via-indigo-900/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* Top Navigation */}
      <Header onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-16 space-y-8 sm:space-y-10">
        
        {/* Hero Headline & Subtitle */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-zinc-300 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Free Temp Mail with Password &amp; Recovery Key</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Free Temp Mail with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Recovery Key
            </span>
          </h1>
          <p className="text-xs sm:text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Create free temp mail with a password-style Recovery Key, additional custom options, and
            support for OTP and verification emails. Restore your temporary inbox for up to 30 days.
          </p>
        </div>

        {/* TempMailLab Pill Address Control Bar */}
        <EmailControlBar
          currentEmail={emailAddress || `loading@${DOMAIN}`}
          onRefresh={() => fetchEmails(true)}
          onRandomize={handleRandomize}
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
          onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)}
          onDeleteAll={handleDeleteAll}
          isRefreshing={isRefreshing}
          recoveryKeyPreview={recoveryKey ? recoveryKey.substring(0, 9) + '••••' : 'SNAP-••••'}
        />

        {/* Inbox / Full Message Viewer Container (Exact TempMailLab Full View) */}
        <div className="max-w-4xl w-full mx-auto">
          {selectedEmail ? (
            <EmailViewer
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onDelete={(id) => {
                handleDeleteEmail(id);
                setSelectedEmail(null);
              }}
            />
          ) : (
            <div className="rounded-2xl sm:rounded-[1.75rem] bg-[#0d0d0f] border border-sky-500/40 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] overflow-hidden transition-all duration-300">
              
              {/* Header: Inbox on left, Refresh on right */}
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Inbox</h2>
                  {emails.length > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {emails.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchEmails(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Body: No emails yet (Exact TempMailLab Circular Icon) OR Email list */}
              {emails.length === 0 ? (
                <div className="py-16 sm:py-28 px-4 flex flex-col items-center justify-center text-center">
                  {/* Rotating circular arrows with envelope in center */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-5 flex items-center justify-center">
                    <svg className="w-16 h-16 sm:w-20 sm:h-20 text-zinc-400 animate-[spin_10s_linear_infinite]" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M52 32a20 20 0 0 1-34.14 14.14L14 42" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 52v-10h10" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 32A20 20 0 0 1 46.14 17.86L50 22" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M50 12v10h-10" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div className="absolute w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-300">
                      <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.25 4.5A2.25 2.25 0 0 1 4.5 2.25h15A2.25 2.25 0 0 1 21.75 4.5v15A2.25 2.25 0 0 1 19.5 21.75h-15A2.25 2.25 0 0 1 2.25 19.5v-15zm3.15 1.5l6.6 4.4 6.6-4.4H5.4zm14.1 2.45l-7.05 4.7a.75.75 0 0 1-.9 0L4.5 8.45V18a.75.75 0 0 0 .75.75h13.5a.75.75 0 0 0 .75-.75V8.45z"/>
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-1.5">No emails yet</h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
                    Waiting for incoming emails
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.08] max-h-[650px] overflow-y-auto">
                  {emails.map((email) => {
                    const senderInitial = (email.from.name || email.from.address || '?').charAt(0).toUpperCase();
                    return (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className="p-3.5 sm:p-5 hover:bg-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer transition group"
                      >
                        <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-bold text-indigo-400 text-sm shrink-0 mt-0.5">
                            {senderInitial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition truncate">
                                {email.from.name || email.from.address}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-mono truncate hidden sm:inline">
                                &lt;{email.from.address}&gt;
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm text-zinc-200 font-medium truncate mt-0.5">
                              {email.subject || '(No Subject)'}
                            </div>
                            <div className="text-xs text-zinc-500 truncate mt-0.5">
                              {(email.text || '').substring(0, 95)}...
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          {email.extractedOtp && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (email.extractedOtp) {
                                  navigator.clipboard.writeText(email.extractedOtp);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold transition active:scale-95"
                              title="Click to copy OTP"
                            >
                              <span>🔑 {email.extractedOtp}</span>
                              <span className="text-[10px] underline ml-0.5">Copy</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                            <span>
                              {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-zinc-500 group-hover:text-white transition">→</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Below-The-Fold: Feature Showcase Section (Mirrored from TempMailLab) */}
        <section className="pt-12 border-t border-white/[0.08]">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Why Choose SnapInbox?
            </h2>
            <p className="text-sm text-zinc-400">
              Engineered for extreme privacy, lightning edge speeds, and zero headaches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-[#121214]/80 border border-white/10 hover:border-white/20 rounded-3xl p-6 sm:p-7 space-y-3 transition duration-200 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl">
                🔑
              </div>
              <h3 className="text-lg font-bold text-white">Password &amp; Recovery Key</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Never lose your temporary inbox. Each address comes with an encrypted Recovery Key that
                lets you restore your inbox and emails on any device for up to 30 days.
              </p>
            </div>

            <div className="bg-[#121214]/80 border border-white/10 hover:border-white/20 rounded-3xl p-6 sm:p-7 space-y-3 transition duration-200 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white">Instant OTP &amp; Link Extractor</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Stop digging through long email bodies. Our regex edge parser instantly detects 4-to-8
                digit verification codes and activation links, showing them right in your inbox list.
              </p>
            </div>

            <div className="bg-[#121214]/80 border border-white/10 hover:border-white/20 rounded-3xl p-6 sm:p-7 space-y-3 transition duration-200 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">
                🛡️
              </div>
              <h3 className="text-lg font-bold text-white">100% Anonymous &amp; Private</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No signup, no tracking cookies, and no personal logs. Your emails are stored safely in
                edge KV storage and can be wiped instantly with a single click.
              </p>
            </div>

            <div className="bg-[#121214]/80 border border-white/10 hover:border-white/20 rounded-3xl p-6 sm:p-7 space-y-3 transition duration-200 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl">
                🌐
              </div>
              <h3 className="text-lg font-bold text-white">Cloudflare Edge Architecture</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Built directly on Cloudflare Email Routing &amp; Workers across 300+ global locations for
                ultra-low latency sub-second email delivery and 99.99% availability.
              </p>
            </div>
          </div>
        </section>

        {/* Below-The-Fold: FAQ Accordion (Mirrored from TempMailLab) */}
        <section className="pt-6 pb-12 max-w-3xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-zinc-400">Everything you need to know about temporary disposable mail.</p>
          </div>

          <div className="space-y-3.5">
            <details className="bg-[#121214]/80 border border-white/10 rounded-2xl p-5 cursor-pointer group">
              <summary className="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
                <span>What is a temporary disposable email?</span>
                <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                A temporary disposable email is a short-lived inbox that allows you to receive emails
                without exposing your personal or business address. It protects you from spam, newsletters,
                and data breaches.
              </p>
            </details>

            <details className="bg-[#121214]/80 border border-white/10 rounded-2xl p-5 cursor-pointer group">
              <summary className="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
                <span>How does the Recovery Key feature work?</span>
                <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                Every temporary email generated on SnapInbox has a unique Recovery Key (e.g.{' '}
                <code>SNAP-XXXX-XXXX</code>). If you switch browsers, accidentally close the tab, or need to
                verify a service 15 days later, you can enter your Recovery Key to immediately restore your
                exact same inbox and previous emails!
              </p>
            </details>

            <details className="bg-[#121214]/80 border border-white/10 rounded-2xl p-5 cursor-pointer group">
              <summary className="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
                <span>Can I receive OTP codes from Netflix, Google, or Telegram?</span>
                <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                Yes! Our catch-all edge server receives standard RFC-compliant emails from all major services.
                Our built-in OTP parser highlights your 4-to-8 digit code right on the screen with a 1-click
                copy button.
              </p>
            </details>

            <details className="bg-[#121214]/80 border border-white/10 rounded-2xl p-5 cursor-pointer group">
              <summary className="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
                <span>Can I customize my username?</span>
                <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                Yes, simply click the <strong>Change</strong> button under the address bar to create any
                custom username you prefer (e.g. <code>myname@mendoneet.me</code>).
              </p>
            </details>

            <details className="bg-[#121214]/80 border border-white/10 rounded-2xl p-5 cursor-pointer group">
              <summary className="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
                <span>Is this service completely free?</span>
                <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                100% free with unlimited disposable addresses, zero ads, and no premium paywalls.
              </p>
            </details>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050505] py-8 text-center text-xs text-zinc-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">SnapInbox</span>
            <span>&bull;</span>
            <span>Free Disposable Email &amp; OTP Lab</span>
          </div>
          <div>
            <span>Powered by Cloudflare Workers &amp; Email Routing</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CustomEmailModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        domain={DOMAIN}
        onSelectCustom={handleSelectCustom}
      />

      <RecoveryKeyModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        activeRecoveryKey={recoveryKey}
        onRestore={handleRestoreRecoveryKey}
      />

      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        email={emailAddress}
      />

      <SetupGuideModal
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
        domain={DOMAIN}
      />
    </div>
  );
}
