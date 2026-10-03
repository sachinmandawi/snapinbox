'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { EmailControlBar } from '@/components/EmailControlBar';
import { EmailList } from '@/components/EmailList';
import { EmailViewer } from '@/components/EmailViewer';
import { CustomEmailModal } from '@/components/CustomEmailModal';
import { QrModal } from '@/components/QrModal';
import { SetupGuideModal } from '@/components/SetupGuideModal';
import { EmailMessage } from '@/types/email';
import { generateRandomUsername } from '@/lib/utils';
import { ShieldCheck, Zap, Lock, Sparkles, RefreshCw, Volume2, VolumeX } from 'lucide-react';

const DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'mendoneet.me';
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 60 minutes

export default function Home() {
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(DEFAULT_EXPIRY_SECONDS);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  // Notification audio using Web Audio API (no external file dependencies)
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

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

  // Initialize or restore email address
  useEffect(() => {
    const saved = localStorage.getItem('mendoneet_temp_email');
    if (saved && saved.endsWith(`@${DOMAIN}`)) {
      setEmailAddress(saved);
    } else {
      const newAddress = `${generateRandomUsername()}@${DOMAIN}`;
      setEmailAddress(newAddress);
      localStorage.setItem('mendoneet_temp_email', newAddress);
    }
  }, []);

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
            // Check if there are newly arrived emails
            if (newEmails.length > prev.length) {
              playChime();
              // If no email is currently selected, select the newest
              if (!selectedEmail && newEmails.length > 0) {
                setSelectedEmail(newEmails[0]);
              }
            }
            return newEmails;
          });

          // Update selected email if it was modified
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

    const interval = setInterval(() => {
      fetchEmails();
    }, 4000);

    return () => clearInterval(interval);
  }, [emailAddress, fetchEmails]);

  // Expiry countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setExpirySeconds((prev) => {
        if (prev <= 1) {
          // Time expired, generate new random address
          const fresh = `${generateRandomUsername()}@${DOMAIN}`;
          setEmailAddress(fresh);
          localStorage.setItem('mendoneet_temp_email', fresh);
          setEmails([]);
          setSelectedEmail(null);
          return DEFAULT_EXPIRY_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handlers
  const handleRandomize = () => {
    const newAddress = `${generateRandomUsername()}@${DOMAIN}`;
    setEmailAddress(newAddress);
    localStorage.setItem('mendoneet_temp_email', newAddress);
    setEmails([]);
    setSelectedEmail(null);
    setExpirySeconds(DEFAULT_EXPIRY_SECONDS);
  };

  const handleSelectCustom = (newEmail: string) => {
    setEmailAddress(newEmail);
    localStorage.setItem('mendoneet_temp_email', newEmail);
    setEmails([]);
    setSelectedEmail(null);
    setExpirySeconds(DEFAULT_EXPIRY_SECONDS);
  };

  const handleExtendExpiry = () => {
    setExpirySeconds((prev) => prev + 10 * 60); // add 10 minutes
  };

  const handleTriggerTestSend = async () => {
    if (!emailAddress) return;
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/emails/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: emailAddress }),
      });
      if (res.ok) {
        await fetchEmails(false);
      }
    } catch (e) {
      console.error('Test send error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteEmail = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/emails/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEmails((prev) => prev.filter((item) => item.id !== id));
        if (selectedEmail?.id === id) {
          setSelectedEmail(null);
        }
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

  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email);
    // Mark read locally
    setEmails((prev) =>
      prev.map((item) => (item.id === email.id ? { ...item, read: true } : item))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Top Navigation */}
      <Header domain={DOMAIN} onOpenSetupGuide={() => setIsSetupGuideOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Email Address Control Bar */}
        <EmailControlBar
          currentEmail={emailAddress || `loading@${DOMAIN}`}
          onRefresh={() => fetchEmails(true)}
          onRandomize={handleRandomize}
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onTriggerTestSend={handleTriggerTestSend}
          onDeleteAll={handleDeleteAll}
          isRefreshing={isRefreshing}
          expirySeconds={expirySeconds}
          onExtendExpiry={handleExtendExpiry}
        />

        {/* Inbox Grid: List & Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Email List (5 cols on large screens) */}
          <div className="lg:col-span-5 space-y-4">
            <EmailList
              emails={emails}
              selectedEmailId={selectedEmail?.id || null}
              onSelectEmail={handleSelectEmail}
              onDeleteEmail={handleDeleteEmail}
              currentEmail={emailAddress}
            />
          </div>

          {/* Right Column: Email Viewer (7 cols on large screens) */}
          <div className="lg:col-span-7">
            <EmailViewer
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onDelete={(id) => handleDeleteEmail(id)}
            />
          </div>
        </div>

        {/* Feature Highlights Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">100% Anonymous & Private</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                No registration, password, or IP tracking. Keeps your personal inbox clean from spam.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Instant OTP & Link Detection</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically detects and extracts verification codes, 2FA tokens, and activation links.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Auto-Expiring Clean Storage</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Emails auto-destruct after expiration so no sensitive data remains stored indefinitely.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070b13] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            &copy; {new Date().getFullYear()} <strong className="text-slate-400">MendoneetMail</strong>. Powered by <code className="text-indigo-400 font-mono">@{DOMAIN}</code>
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSetupGuideOpen(true)}
              className="text-slate-400 hover:text-indigo-300 transition"
            >
              Domain Setup Guide
            </button>
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition"
              title={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
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
