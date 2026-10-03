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
export function extractOtp(subject: string, content?: string): string | null {
  const fullText = `${subject} ${content || ''}`;

  // Patterns like "code: 123456", "verification code is 849201", "OTP: 4920"
  const keywordMatches = [
    /(?:code|otp|pin|token|verification|password|login|secret)\s*(?:is|:|-|=)?\s*([0-9]{4,8})\b/i,
    /(?:enter|use)\s*([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/, // any standalone 6-digit code
    /\b([0-9]{4})\b/, // any standalone 4-digit code
  ];

  for (let i = 0; i < keywordMatches.length; i++) {
    const match = fullText.match(keywordMatches[i]);
    if (match && match[1]) {
      // Avoid false positive years (1950-2050) on standalone 4-digit pattern
      if (i === 3) {
        const num = parseInt(match[1], 10);
        if (num >= 1950 && num <= 2050) continue;
      }
      return match[1];
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
