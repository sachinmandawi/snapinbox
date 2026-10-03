import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate human-friendly random username
export function generateRandomUsername(): string {
  const adjectives = [
    'swift', 'dark', 'cyber', 'hyper', 'quiet', 'brave', 'silver', 'frost',
    'echo', 'neon', 'shadow', 'solar', 'alpha', 'nova', 'zenith', 'pulse',
    'pixel', 'nexus', 'sonic', 'turbo'
  ];
  const nouns = [
    'fox', 'falcon', 'ghost', 'tiger', 'wolf', 'hawk', 'storm', 'spark',
    'rider', 'ninja', 'vortex', 'orbit', 'comet', 'pilot', 'blaze', 'scout'
  ];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(100 + Math.random() * 900); // 3 digit number

  return `${randomAdj}.${randomNoun}${randomNum}`;
}

// Extract OTP / verification pin from text/html
// Extract OTP / verification pin from text/html
export function extractOtp(subject: string, content?: string, html?: string): string | null {
  // Strip HTML tags and entities so tags like <strong>123456</strong> or &nbsp; don't break regex boundaries
  const cleanHtml = (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

  const cleanContent = (content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');

  const fullText = `${subject} ${cleanContent} ${cleanHtml}`;

  // Patterns covering all major services (Google G-XXXXXX, hyphenated 123-456, number before keyword, etc.)
  const keywordMatches = [
    // 1. Google official format (e.g. "G-847291 is your verification code")
    /\bG-([0-9]{4,8})\b/i,

    // 2. Number BEFORE keyword (e.g. "849201 is your verification code", "74910 is your security code")
    /\b([0-9]{4,8})\s*(?:is|as)?\s*(?:your|the)?\s*(?:one-time|verification|confirmation|login|security|access)?\s*(?:code|otp|pin|password)\b/i,

    // 3. Keyword followed by hyphenated/spaced code (e.g. "code: 123-456" or "code is: 849 201")
    /(?:code|otp|pin|token|verification|password|login|secret)[\s:=_-]*(?:is|as)?[\s:=_-]*([0-9]{3}[-\s][0-9]{3})\b/i,

    // 4. Keyword followed by 4-8 digit standard code (e.g. "code: 123456", "code is: 849201")
    /(?:code|otp|pin|token|verification|password|login|secret)[\s:=_-]*(?:is|as)?[\s:=_-]*([0-9]{4,8})\b/i,

    // 5. Action verb followed by code (e.g. "enter 123456", "use code 849201")
    /(?:enter|use)\s*(?:code)?\s*([0-9]{4,8})\b/i,

    // 6. Standalone 6-digit code
    /\b([0-9]{6})\b/,

    // 7. Standalone 5-digit code
    /\b([0-9]{5})\b/,

    // 8. Standalone 4-digit code (excluding years 1950-2050)
    /\b([0-9]{4})\b/,
  ];

  for (let i = 0; i < keywordMatches.length; i++) {
    const match = fullText.match(keywordMatches[i]);
    if (match && match[1]) {
      const code = match[1].replace(/[-\s]/g, '');
      // Avoid false positive years (1950-2050) on 4-digit codes without explicit keywords
      if (code.length === 4) {
        const num = parseInt(code, 10);
        if (num >= 1950 && num <= 2050 && i >= 5) continue;
      }
      return code;
    }
  }

  return null;
}

// Extract action / verification links
export function extractVerificationLink(html?: string, text?: string): string | null {
  if (html) {
    // Look for links with verify / confirm / activate / reset keywords in href or anchor text
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[2];
      const anchorText = match[3];
      if (/verify|confirm|activate|validate|token|magic/i.test(url) || /verify|confirm|activate/i.test(anchorText)) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
        }
      }
    }
  }

  if (text) {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[1];
      if (/verify|confirm|activate|validate|token/i.test(url)) {
        return url;
      }
    }
  }

  return null;
}

// Relative time formatting
export function formatTimeAgo(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 10) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

// Format byte sizes
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
