import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Free Temp Mail with Password & Recovery Key | SnapInbox',
  description:
    'Create free temp mail with a password-style Recovery Key, custom domain options, and support for OTP and verification emails. Restore your temporary inbox for up to 30 days.',
  keywords: [
    'free temp mail',
    'temp mail with password',
    'temp mail with recovery key',
    'temporary email with multiple domains',
    'temporary inbox for verification',
    '30-day restore temp mail',
    'snapinbox',
    'mendoneet.me',
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
      <body className="min-h-screen bg-[#050505] text-[#f5f5f5] antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
