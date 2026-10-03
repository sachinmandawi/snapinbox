'use client';

import React, { useState } from 'react';
import {
  X,
  Globe,
  Mail,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  domain,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const steps = [
    {
      id: 1,
      title: '1. Connect Namecheap to Cloudflare (Free)',
      icon: Globe,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p>
            Namecheap provides the domain, but Cloudflare provides free automated Email Routing and Workers to intercept incoming emails without a VPS!
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <li>Log in to <strong className="text-white">Cloudflare</strong> and click <strong className="text-white">&ldquo;Add a Site&rdquo;</strong>.</li>
            <li>Enter your domain: <code className="text-indigo-300 font-mono">mendoneet.me</code> and choose the <strong className="text-emerald-400">Free Plan</strong>.</li>
            <li>Cloudflare will provide you 2 Nameservers (e.g. <code className="text-indigo-300 font-mono">alex.ns.cloudflare.com</code>).</li>
            <li>Go to <strong className="text-white">Namecheap Dashboard</strong> &rarr; <strong className="text-white">Domain List</strong> &rarr; Click <strong className="text-white">Manage</strong> next to <code className="text-indigo-300 font-mono">mendoneet.me</code>.</li>
            <li>Under <strong className="text-white">Nameservers</strong>, change from &ldquo;Namecheap BasicDNS&rdquo; to <strong className="text-white">&ldquo;Custom DNS&rdquo;</strong> and paste Cloudflare&apos;s 2 nameservers. Click the green Checkmark &radic;.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 2,
      title: '2. Enable Cloudflare Email Routing',
      icon: Mail,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p>
            Cloudflare has a built-in free email receiving engine with Catch-All support!
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <li>In your Cloudflare dashboard, select <strong className="text-white">mendoneet.me</strong>.</li>
            <li>In the left sidebar, click <strong className="text-white">Email</strong> &rarr; <strong className="text-white">Email Routing</strong>.</li>
            <li>Click <strong className="text-white">&ldquo;Get started / Enable Email Routing&rdquo;</strong>.</li>
            <li>Cloudflare will prompt to add recommended DNS records (MX &amp; TXT/SPF). Click <strong className="text-emerald-400">&ldquo;Add records automatically&rdquo;</strong>.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 3,
      title: '3. Create Catch-All Worker & Webhook',
      icon: Zap,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p>
            When an email arrives at <code className="text-indigo-300 font-mono">*@mendoneet.me</code>, Cloudflare Email Routing will trigger our Worker, which forwards the email to your website!
          </p>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">Cloudflare Worker Script:</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    
    // Parse subject and sender
    const subject = message.headers.get("subject") || "(No Subject)";
    const from = message.from;
    const to = message.to;

    // Send payload to your temp mail webhook
    await fetch("https://YOUR_WEBSITE_DOMAIN/api/webhook/incoming", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": "mendoneet_secret_key_change_me_123"
      },
      body: JSON.stringify({
        to,
        from,
        subject,
        text: rawEmail,
        html: rawEmail
      })
    });
  }
};`,
                    'worker-code'
                  )
                }
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-white"
              >
                {copiedCode === 'worker-code' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy Code</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              The full ready-to-deploy script is also saved in the project at{' '}
              <code className="text-indigo-300 font-mono">cloudflare-worker/worker.js</code>!
            </p>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
            <li>Go to <strong className="text-white">Workers &amp; Pages</strong> &rarr; Click <strong className="text-white">Create Application</strong> &rarr; <strong className="text-white">Worker</strong>.</li>
            <li>Paste the worker code and click <strong className="text-white">Deploy</strong>.</li>
            <li>Go back to <strong className="text-white">Email Routing</strong> &rarr; <strong className="text-white">Routing Rules</strong> &rarr; <strong className="text-white">Catch-all rule</strong>.</li>
            <li>Set Action to: <strong className="text-emerald-400">&ldquo;Send to Worker&rdquo;</strong> &rarr; select your newly created Worker!</li>
          </ol>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                How to Connect {domain} (Namecheap + Cloudflare)
              </h3>
              <p className="text-xs text-slate-400">
                100% Free setup with Zero Server Cost
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/30 overflow-x-auto">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{step.title.split('.')[1] || step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {steps.find((s) => s.id === activeStep)?.content}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Step {activeStep} of {steps.length}
          </div>
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Back
              </button>
            )}
            {activeStep < steps.length ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md"
              >
                <span>Next Step</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md"
              >
                Got It!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
