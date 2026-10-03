import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapInbox - Free Disposable Temporary Email',
  description:
    'Instant, anonymous temporary disposable email service powered by SnapInbox on mendoneet.me. Protect your personal inbox from spam, bot crawlers, and newsletters.',
  keywords: [
    'snapinbox',
    'temp mail',
    'disposable email',
    'mendoneet',
    'fake email',
    '10 minute mail',
    'anonymous email',
    'otp receiver',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
