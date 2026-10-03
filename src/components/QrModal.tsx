'use client';

import React from 'react';
import { X, Copy, Check, QrCode } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, email }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    `mailto:${email}`
  )}&bgcolor=111827&color=ffffff&margin=10`;

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-3">
          <QrCode className="w-5 h-5" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">Scan QR Code</h3>
        <p className="text-xs text-slate-400 mb-4">
          Scan with your phone to send or copy this email
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 inline-block mx-auto mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR code for ${email}`}
            width={200}
            height={200}
            className="rounded-lg mx-auto"
          />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2 mb-4">
          <span className="font-mono text-xs text-indigo-300 truncate">
            {email}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-white shrink-0 p-1"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
