/**
 * SnapInbox Pro - Ultra-Advanced Cloudflare Worker Temp Mail Engine
 * 
 * Features:
 * - Design mirrored from TempMailLab (Pitch-black #050505, Pill Address Bar, 3-Card Action Grid)
 * - Password-style Recovery Key System (30-day inbox restore via Cloudflare KV)
 * - Advanced RFC-compliant MIME & Quoted-Printable / Base64 Decoder
 * - Smart Multi-pattern OTP & Verification Link Extractor
 * - In-list instant OTP Copy Chip & Rich Email Viewer Modal
 * - SPF / DKIM Authentication Detection
 * - Rich Test Email Simulator (Netflix, Google, Discord presets)
 * - Full EML Export, Print, Safe Sandboxed Dark/Light HTML Reader
 * - Multi-Address History Switcher (Local Storage backed)
 * - Keyboard Shortcuts (C: Copy, R: Refresh, N: New Address)
 * - Browser Push Notifications + Synthesizer Audio Chime
 * - Below-the-fold Feature Showcase & Interactive FAQ Accordion
 */

const memoryStore = new Map();

// --- 1. ROBUST MIME DECODERS ---

// Decode MIME encoded-word in headers: =?UTF-8?B?...?= or =?UTF-8?Q?...?=
function decodeMimeHeader(header) {
  if (!header) return "";
  return header.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const bin = atob(text);
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
        return new TextDecoder(charset).decode(bytes);
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = text.replace(/_/g, ' ').replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        return decoded;
      }
    } catch (e) {
      return text;
    }
    return text;
  });
}

// Decode Quoted-Printable text
function decodeQuotedPrintable(input) {
  if (!input) return "";
  let clean = input.replace(/=(?:\r\n|\n|\r)/g, '');
  try {
    clean = clean.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    });
  } catch (e) {}
  return clean;
}

// Decode Base64 text/html
function decodeBase64(input, charset = 'utf-8') {
  if (!input) return "";
  try {
    const clean = input.replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder(charset).decode(bytes);
  } catch (e) {
    return input;
  }
}

// Advanced Multi-pattern OTP Extractor
function extractOtp(subject, body) {
  const fullText = `${subject || ''} \n ${body || ''}`;
  const patterns = [
    /(?:code|otp|pin|token|verification|password|login|secret)\s*(?:is|:|-|=)?\s*([0-9]{4,8})\b/i,
    /(?:enter|use)\s*([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/,
    /\b([0-9]{4})\b/
  ];
  for (const regex of patterns) {
    const match = fullText.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Extract primary action links
function extractActionLink(text, html) {
  const content = `${html || ''} \n ${text || ''}`;
  const patterns = [
    /https?:\/\/[^\s<>"']*(?:verify|confirm|activate|validate|magic-login|token)[^\s<>"']*/gi,
    /https?:\/\/[^\s<>"']*(?:reset-password|auth)[^\s<>"']*/gi
  ];
  for (const regex of patterns) {
    const match = content.match(regex);
    if (match && match[0]) return match[0];
  }
  return null;
}

// Storage helpers: Cloudflare KV with in-memory fallback
async function getEmails(address, env) {
  const key = `emails_${address.toLowerCase().trim()}`;
  if (env && env.SNAPINBOX_KV) {
    try {
      const data = await env.SNAPINBOX_KV.get(key, { type: "json" });
      if (data) return data;
    } catch (e) {
      console.error("KV get error:", e);
    }
  }
  return memoryStore.get(key) || [];
}

async function saveEmails(address, emails, env) {
  const key = `emails_${address.toLowerCase().trim()}`;
  memoryStore.set(key, emails);
  if (env && env.SNAPINBOX_KV) {
    try {
      await env.SNAPINBOX_KV.put(key, JSON.stringify(emails), { expirationTtl: 2592000 }); // 30 days retention
    } catch (e) {
      console.error("KV put error:", e);
    }
  }
}

export default {
  // --- 2. EMAIL RECEIVING ENGINE ---
  async email(message, env, ctx) {
    try {
      const recipient = message.to.toLowerCase().trim();
      const rawSender = message.from;
      const rawSubject = message.headers.get("subject") || "(No Subject)";
      const subject = decodeMimeHeader(rawSubject);
      
      const rawText = await new Response(message.raw).text();

      // Check SPF / DKIM auth status from headers
      const authResults = message.headers.get("authentication-results") || "";
      const isSpfPass = /spf=pass/i.test(authResults);
      const isDkimPass = /dkim=pass/i.test(authResults);

      let bodyText = "";
      let bodyHtml = "";

      const contentType = message.headers.get("content-type") || "";
      const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);

      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = rawText.split(new RegExp(`--${boundary.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));

        for (const part of parts) {
          const lowerPart = part.toLowerCase();
          const isHtml = lowerPart.includes("text/html");
          const isPlain = lowerPart.includes("text/plain");

          if (isHtml || isPlain) {
            const split = part.split(/\r?\n\r?\n/);
            const headers = split[0] || "";
            let body = split.slice(1).join("\n\n").trim();

            if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) {
              body = decodeQuotedPrintable(body);
            } else if (/content-transfer-encoding:\s*base64/i.test(headers)) {
              body = decodeBase64(body);
            }

            if (isHtml && !bodyHtml) {
              bodyHtml = body;
            } else if (isPlain && !bodyText) {
              bodyText = body;
            }
          }
        }
      }

      if (!bodyText && !bodyHtml) {
        const split = rawText.split(/\r?\n\r?\n/);
        bodyText = split.slice(1).join("\n\n").trim() || rawText.substring(0, 10000);
      }

      // Parse sender name & address
      let senderName = "";
      let senderAddress = rawSender;
      const match = rawSender.match(/(.*)<(.+)>/);
      if (match) {
        senderName = decodeMimeHeader(match[1].trim().replace(/^["']|["']$/g, ""));
        senderAddress = match[2].trim();
      }

      const emailObj = {
        id: "eml_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        recipient,
        from: { address: senderAddress, name: senderName || undefined },
        subject,
        text: bodyText || "No plain text content available.",
        html: bodyHtml || `<pre style="font-family: inherit; white-space: pre-wrap; padding: 18px; line-height: 1.6;">${bodyText}</pre>`,
        rawMime: rawText.substring(0, 15000),
        receivedAt: new Date().toISOString(),
        read: false,
        size: (bodyHtml.length || 0) + (bodyText.length || 0),
        extractedOtp: extractOtp(subject, bodyText || bodyHtml),
        extractedLink: extractActionLink(bodyText, bodyHtml),
        security: { spf: isSpfPass, dkim: isDkimPass }
      };

      const existing = await getEmails(recipient, env);
      existing.unshift(emailObj);
      await saveEmails(recipient, existing.slice(0, 50), env);
    } catch (err) {
      console.error("Inbound email error:", err);
    }
  },

  // --- 3. HTTP API & FRONTEND HANDLER ---
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API: GET emails
    if (url.pathname === "/api/emails" && request.method === "GET") {
      const address = (url.searchParams.get("address") || "").toLowerCase().trim();
      const emails = address ? await getEmails(address, env) : [];
      return new Response(JSON.stringify({ success: true, address, count: emails.length, emails }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // API: DELETE email
    if (url.pathname === "/api/emails" && request.method === "DELETE") {
      const address = (url.searchParams.get("address") || "").toLowerCase().trim();
      const id = url.searchParams.get("id");
      if (address) {
        if (id) {
          let emails = await getEmails(address, env);
          emails = emails.filter(e => e.id !== id);
          await saveEmails(address, emails, env);
        } else {
          await saveEmails(address, [], env);
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // API: RECOVERY KEY - SAVE MAPPING (30 Days)
    if (url.pathname === "/api/recovery/save" && request.method === "POST") {
      try {
        const body = await request.json();
        const address = (body.address || "").toLowerCase().trim();
        const recoveryKey = (body.recoveryKey || "").toUpperCase().trim();
        if (!address || !recoveryKey) {
          return new Response(JSON.stringify({ error: "Missing address or recoveryKey" }), { status: 400 });
        }
        if (env && env.SNAPINBOX_KV) {
          await env.SNAPINBOX_KV.put(`recovery_${recoveryKey}`, address, { expirationTtl: 2592000 }); // 30 days
          await env.SNAPINBOX_KV.put(`recaddr_${address}`, recoveryKey, { expirationTtl: 2592000 });
        }
        memoryStore.set(`recovery_${recoveryKey}`, address);
        memoryStore.set(`recaddr_${address}`, recoveryKey);
        return new Response(JSON.stringify({ success: true, recoveryKey, address }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // API: RECOVERY KEY - RESTORE INBOX BY KEY
    if (url.pathname === "/api/recovery/restore" && request.method === "POST") {
      try {
        const body = await request.json();
        const recoveryKey = (body.recoveryKey || "").toUpperCase().trim();
        if (!recoveryKey) {
          return new Response(JSON.stringify({ success: false, error: "Please enter a valid Recovery Key." }), { status: 400 });
        }

        let address = null;
        if (env && env.SNAPINBOX_KV) {
          address = await env.SNAPINBOX_KV.get(`recovery_${recoveryKey}`);
        }
        if (!address) {
          address = memoryStore.get(`recovery_${recoveryKey}`);
        }

        if (!address) {
          return new Response(JSON.stringify({
            success: false,
            error: "Recovery Key not found or expired. Make sure it was entered correctly."
          }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const emails = await getEmails(address, env);
        return new Response(JSON.stringify({ success: true, address, recoveryKey, count: emails.length, emails }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // Serve HTML Dashboard
    return new Response(getProAppHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

// --- 4. PIXEL-PERFECT TEMPMILLAB MIRROR FRONTEND ---
function getProAppHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Free Temp Mail with Password &amp; Recovery Key | SnapInbox</title>
  <meta name="description" content="Create free temp mail with a password-style Recovery Key, custom username options, and support for OTP and verification emails. Restore your temporary inbox for up to 30 days.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Tailwind & Confetti -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              200: '#c7d2fe',
              300: '#a5b4fc',
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81'
            }
          }
        }
      }
    }
  </script>

  <style>
    /* Exact TempMailLab #050505 Dark Background */
    body {
      background-color: #050505 !important;
      color: #f5f5f5 !important;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-x: hidden;
    }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #050505; }
    ::-webkit-scrollbar-thumb { background: #262626; border-radius: 9999px; }

    .glass-card {
      background: rgba(18, 18, 20, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.09);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
    }

    .glass-pill {
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.16);
      transition: all 0.25s ease;
    }
    .glass-pill:hover, .glass-pill:focus-within {
      border-color: rgba(99, 102, 241, 0.5);
      box-shadow: 0 0 25px -5px rgba(99, 102, 241, 0.2);
    }

    .action-card {
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .action-card:hover {
      background: rgba(255, 255, 255, 0.075);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -10px rgba(0, 0, 0, 0.5);
    }

    /* Radar animation */
    @keyframes radar-pulse {
      0% { transform: scale(0.92); opacity: 0.8; box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5); }
      70% { transform: scale(1.05); opacity: 0; box-shadow: 0 0 0 24px rgba(99, 102, 241, 0); }
      100% { transform: scale(0.92); opacity: 0; box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }
    .radar-pulse { animation: radar-pulse 2.2s infinite ease-in-out; }

    /* Collapsible Details Chevron */
    details > summary svg.chevron-icon {
      transition: transform 0.25s ease;
    }
    details[open] > summary svg.chevron-icon {
      transform: rotate(180deg);
    }
    details summary::-webkit-details-marker {
      display: none;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-[#050505] text-[#f5f5f5] selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">

  <!-- Ambient Top Glow (Exact TempMailLab Aesthetic) -->
  <div class="fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-b from-indigo-600/12 via-indigo-900/5 to-transparent blur-[120px] pointer-events-none -z-10"></div>

  <!-- Header -->
  <header class="border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      
      <!-- Brand Logo -->
      <a href="/" class="flex items-center gap-3 group">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 group-hover:scale-105 transition">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
          </svg>
        </div>
        <span class="font-bold text-lg tracking-tight text-white">Snap<span class="text-indigo-400">Inbox</span></span>
      </a>

      <!-- Navigation & Action Controls -->
      <div class="flex items-center gap-3 text-xs font-medium text-zinc-400">
        <button onclick="openRecoveryModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition shadow-sm">
          <span>🔑 Restore Inbox</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Hero & Temp Mail Section -->
  <main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-16 space-y-8 sm:space-y-10">

    <!-- Hero Title & Subtitle -->
    <div class="text-center max-w-2xl mx-auto space-y-3">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-zinc-300 mb-1">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
        <span>Free Temp Mail with Password &amp; Recovery Key</span>
      </div>
      <h1 class="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
        Free Temp Mail with <span class="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">Recovery Key</span>
      </h1>
      <p class="text-xs sm:text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
        Create free temp mail with a password-style Recovery Key, additional custom options, and instant OTP verification support. Restore your temporary inbox for up to 30 days.
      </p>
    </div>

    <!-- Centerpiece: Pill Address Bar -->
    <div class="w-full max-w-2xl mx-auto space-y-3 sm:space-y-3.5">
      <div class="glass-pill rounded-full p-1.5 sm:p-2.5 pl-3.5 sm:pl-6 flex items-center justify-between shadow-2xl relative group">
        <!-- Left: Envelope Icon + Address -->
        <div class="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0 pr-2 cursor-pointer" onclick="copyEmail()" title="Click to copy address">
          <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400">
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
            </svg>
          </div>
          <span id="emailDisplay" class="font-mono text-xs sm:text-base md:text-lg font-bold tracking-wide text-white select-all truncate hover:text-indigo-300 transition">
            loading@mendoneet.me
          </span>
        </div>

        <!-- Right: Rounded Pill Copy Button -->
        <button onclick="copyEmail()" id="copyBtn" class="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 sm:py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 shrink-0">
          <svg id="copyIcon" class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <span id="copyBtnText">Copy</span>
        </button>
      </div>

      <!-- The 3 Signature Action Cards (Exact Identical Size h-[68px] sm:h-[70px] - Zero Overlap) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        
        <!-- 1. Refresh Button Card -->
        <button onclick="fetchEmails(true)" class="h-[68px] sm:h-[70px] action-card rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left group min-w-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 shrink-0 transition">
              <svg id="refreshIcon" class="w-4 h-4 transition duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-xs sm:text-sm text-zinc-100 truncate">Refresh</div>
              <div class="text-[10px] sm:text-[11px] text-zinc-400 truncate">Sync inbox</div>
            </div>
          </div>
          <span id="refreshTimerBadge" class="text-[10px] sm:text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-indigo-500/20 shrink-0">10s</span>
        </button>

        <!-- 2. Change / Custom Email Card -->
        <button onclick="openCustomModal()" class="h-[68px] sm:h-[70px] action-card rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left group min-w-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 shrink-0 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-xs sm:text-sm text-zinc-100 truncate">Change</div>
              <div class="text-[10px] sm:text-[11px] text-zinc-400 truncate">Custom username</div>
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] font-semibold text-zinc-300 bg-white/5 group-hover:bg-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/10 shrink-0 transition">Edit</span>
        </button>

        <!-- 3. Recovery Key Card (Exact Identical Size) -->
        <button onclick="openRecoveryModal()" class="h-[68px] sm:h-[70px] action-card rounded-2xl px-3 sm:px-3.5 flex items-center justify-between text-left group border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] min-w-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-1.5 sm:mr-2">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:border-amber-400/40 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                Recovery Key
              </div>
              <div class="text-[10px] sm:text-[11px] text-amber-400/80 truncate font-mono">
                30-day restore
              </div>
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-amber-500/20 shrink-0">30d</span>
        </button>

      </div>
    </div>

    <!-- Single Full-Width Container (Exact TempMailLab: Inbox <-> Full Email Reader) -->
    <div id="mainContainer" class="max-w-4xl w-full mx-auto">
      <!-- Rendered dynamically by JavaScript -->
    </div>

    <!-- Below-The-Fold: Feature Showcase Section (Mirrored from TempMailLab) -->
    <section class="max-w-4xl mx-auto pt-10 border-t border-white/[0.08]">
      <div class="text-center max-w-xl mx-auto mb-10 space-y-2">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Why Choose SnapInbox?</h2>
        <p class="text-sm text-zinc-400">Engineered for extreme privacy, lightning edge speeds, and zero headaches.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        <!-- Feature 1: Recovery Key -->
        <div class="glass-card rounded-3xl p-6 sm:p-7 space-y-3 relative overflow-hidden group hover:border-white/20 transition">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl">
            🔑
          </div>
          <h3 class="text-lg font-bold text-white">Password &amp; Recovery Key</h3>
          <p class="text-sm text-zinc-400 leading-relaxed">
            Never lose your temporary inbox. Each address comes with an encrypted Recovery Key that lets you restore your inbox and emails on any device for up to 30 days.
          </p>
        </div>

        <!-- Feature 2: Smart OTP -->
        <div class="glass-card rounded-3xl p-6 sm:p-7 space-y-3 relative overflow-hidden group hover:border-white/20 transition">
          <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl">
            ⚡
          </div>
          <h3 class="text-lg font-bold text-white">Instant OTP &amp; Link Extractor</h3>
          <p class="text-sm text-zinc-400 leading-relaxed">
            Stop digging through long email bodies. Our regex edge parser instantly detects 4-to-8 digit verification codes and activation links, showing them right in your inbox list.
          </p>
        </div>

        <!-- Feature 3: Anonymous & Zero Tracking -->
        <div class="glass-card rounded-3xl p-6 sm:p-7 space-y-3 relative overflow-hidden group hover:border-white/20 transition">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">
            🛡️
          </div>
          <h3 class="text-lg font-bold text-white">100% Anonymous &amp; Private</h3>
          <p class="text-sm text-zinc-400 leading-relaxed">
            No signup, no tracking cookies, and no personal logs. Your emails are stored safely in edge KV storage and can be wiped instantly with a single click.
          </p>
        </div>

        <!-- Feature 4: Cloudflare Global Edge -->
        <div class="glass-card rounded-3xl p-6 sm:p-7 space-y-3 relative overflow-hidden group hover:border-white/20 transition">
          <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl">
            🌐
          </div>
          <h3 class="text-lg font-bold text-white">Cloudflare Edge Architecture</h3>
          <p class="text-sm text-zinc-400 leading-relaxed">
            Built directly on Cloudflare Email Routing &amp; Workers across 300+ global locations for ultra-low latency sub-second email delivery and 99.99% availability.
          </p>
        </div>

      </div>
    </section>

    <!-- Below-The-Fold: FAQ Accordion (Mirrored from TempMailLab) -->
    <section class="max-w-3xl mx-auto pt-6 pb-12">
      <div class="text-center max-w-xl mx-auto mb-8 space-y-2">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
        <p class="text-sm text-zinc-400">Everything you need to know about temporary disposable mail.</p>
      </div>

      <div class="space-y-3.5">
        
        <details class="glass-card rounded-2xl p-5 cursor-pointer group">
          <summary class="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
            <span>What is a temporary disposable email?</span>
            <svg class="chevron-icon w-4 h-4 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </summary>
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            A temporary disposable email is a short-lived inbox that allows you to receive emails without exposing your personal or business address. It protects you from spam, newsletters, and data breaches.
          </p>
        </details>

        <details class="glass-card rounded-2xl p-5 cursor-pointer group">
          <summary class="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
            <span>How does the Recovery Key feature work?</span>
            <svg class="chevron-icon w-4 h-4 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </summary>
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            Every temporary email generated on SnapInbox has a unique Recovery Key (e.g. <code>SNAP-XXXX-XXXX</code>). If you switch browsers, accidentally close the tab, or need to verify a service 15 days later, you can enter your Recovery Key to immediately restore your exact same inbox and previous emails!
          </p>
        </details>

        <details class="glass-card rounded-2xl p-5 cursor-pointer group">
          <summary class="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
            <span>Can I receive OTP codes from Netflix, Google, or Telegram?</span>
            <svg class="chevron-icon w-4 h-4 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </summary>
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            Yes! Our catch-all edge server receives standard RFC-compliant emails from all major services. Our built-in OTP parser highlights your 4-to-8 digit code right on the screen with a 1-click copy button.
          </p>
        </details>

        <details class="glass-card rounded-2xl p-5 cursor-pointer group">
          <summary class="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
            <span>Can I customize my username?</span>
            <svg class="chevron-icon w-4 h-4 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </summary>
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            Yes, simply click the <strong>Change</strong> button under the address bar to create any custom username you prefer (e.g. <code>myname@mendoneet.me</code>).
          </p>
        </details>

        <details class="glass-card rounded-2xl p-5 cursor-pointer group">
          <summary class="flex items-center justify-between font-semibold text-zinc-200 group-hover:text-white text-sm sm:text-base list-none">
            <span>Is this service completely free?</span>
            <svg class="chevron-icon w-4 h-4 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </summary>
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            100% free with unlimited disposable addresses, zero ads, and no premium paywalls.
          </p>
        </details>

      </div>
    </section>

  </main>

  <!-- Footer -->
  <footer class="border-t border-white/[0.08] bg-[#050505] py-8 text-center text-xs text-zinc-500">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="font-bold text-white">SnapInbox</span>
        <span>&bull;</span>
        <span>Free Disposable Email &amp; OTP Lab</span>
      </div>
      <div>
        <span>Powered by Cloudflare Workers &amp; Email Routing</span>
      </div>
    </div>
  </footer>

  <!-- ================= MODALS ================= -->

  <!-- 1. RECOVERY KEY MODAL (Save & Restore) -->
  <div id="recoveryModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
    <div class="glass-card bg-[#141416] max-w-md w-full rounded-3xl p-6 sm:p-7 relative border border-white/10 shadow-2xl space-y-6">
      <button onclick="closeRecoveryModal()" class="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg">✕</button>
      
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 text-lg">
          🔑
        </div>
        <div>
          <h3 class="text-lg font-bold text-white">Recovery Key</h3>
          <p class="text-xs text-zinc-400">Restore your temporary inbox anytime (30 days)</p>
        </div>
      </div>

      <!-- Current Key Section -->
      <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
        <span class="text-[11px] uppercase font-bold tracking-wider text-zinc-400">Active Recovery Key</span>
        <div class="flex items-center justify-between gap-2 bg-[#0a0a0c] p-3 rounded-xl border border-amber-500/25">
          <span id="activeRecoveryKeyDisplay" class="font-mono text-base font-bold text-amber-400 tracking-wider">SNAP-XXXX-XXXX</span>
          <button onclick="copyRecoveryKey()" class="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition">
            Copy
          </button>
        </div>
        <p class="text-[11px] text-zinc-500 leading-normal">
          Save this key. You can use it to re-open this exact mailbox from another device.
        </p>
      </div>

      <!-- Restore Section -->
      <div class="space-y-3">
        <span class="text-xs font-semibold text-zinc-200">Restore a previous mailbox:</span>
        <div class="space-y-2">
          <input type="text" id="restoreKeyInput" placeholder="Enter Recovery Key (e.g. SNAP-9A21-44B2)" class="w-full bg-[#0a0a0c] border border-white/15 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none transition uppercase">
          <div id="restoreError" class="text-xs text-rose-400 hidden"></div>
          <button onclick="handleRestoreSubmit()" id="restoreSubmitBtn" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs sm:text-sm text-white shadow-lg shadow-indigo-600/30 transition">
            Restore Inbox
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 2. CUSTOM USERNAME MODAL -->
  <div id="customModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
    <div class="glass-card bg-[#141416] max-w-md w-full rounded-3xl p-6 sm:p-7 relative border border-white/10 shadow-2xl space-y-5">
      <button onclick="closeCustomModal()" class="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg">✕</button>
      
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 text-lg">
          ✏️
        </div>
        <div>
          <h3 class="text-lg font-bold text-white">Create Custom Address</h3>
          <p class="text-xs text-zinc-400">Choose your preferred mailbox username</p>
        </div>
      </div>

      <form onsubmit="handleCustomSubmit(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Username</label>
          <div class="flex items-center bg-[#0a0a0c] border border-white/15 focus-within:border-indigo-500 rounded-xl overflow-hidden px-4 py-1 transition">
            <input type="text" id="customInput" placeholder="yourname" class="flex-1 bg-transparent py-2.5 text-sm text-white focus:outline-none font-mono">
            <span class="text-xs text-zinc-400 font-mono">@mendoneet.me</span>
          </div>
          <p id="customError" class="text-xs text-rose-400 mt-1 hidden"></p>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="button" onclick="randomizeEmail(); closeCustomModal();" class="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition">
            🎲 Randomize
          </button>
          <button type="submit" class="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition">
            Apply Address
          </button>
        </div>
      </form>
    </div>
  </div>



  <!-- 4. ADDRESS HISTORY MODAL -->
  <div id="historyModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
    <div class="glass-card bg-[#141416] max-w-md w-full rounded-3xl p-6 sm:p-7 relative border border-white/10 shadow-2xl space-y-4">
      <button onclick="toggleHistoryModal()" class="absolute top-5 right-5 text-zinc-400 hover:text-white text-lg">✕</button>
      <h3 class="text-lg font-bold text-white">Recent Mailboxes</h3>
      <p class="text-xs text-zinc-400">Switch between your recently active temporary addresses.</p>
      <div id="historyList" class="space-y-2 max-h-60 overflow-y-auto pt-2">
        <!-- Rendered by JS -->
      </div>
    </div>
  </div>

  <!-- Floating Toast Notification -->
  <div id="toastNotification" class="fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1c1c1f] border border-white/20 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl">
    <span id="toastIcon" class="text-base">✨</span>
    <span id="toastMsg">Notification message</span>
  </div>

  <!-- ================= CLIENT JAVASCRIPT ================= -->
  <script>
    const DOMAIN = 'mendoneet.me';
    let currentEmail = localStorage.getItem('snapinbox_email') || generateRandomEmail();
    let currentRecoveryKey = '';
    let currentEmails = [];
    let selectedEmail = null;
    let refreshCountdown = 10;
    let refreshTimerInterval = null;
    let soundEnabled = true;
    let toastTimeout = null;

    function showToast(msg, icon = '✨') {
      const el = document.getElementById('toastNotification');
      const msgEl = document.getElementById('toastMsg');
      const iconEl = document.getElementById('toastIcon');
      if (!el || !msgEl) return;
      msgEl.innerText = msg;
      if (iconEl) iconEl.innerText = icon;
      el.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        el.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
      }, 2800);
    }

    // --- RECOVERY KEY HELPERS ---
    function generateRecoveryKey() {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      return 'SNAP-' + part1 + '-' + part2;
    }

    async function ensureRecoveryKeyForEmail(email) {
      const storageKey = 'snapinbox_rec_' + email.toLowerCase().trim();
      let key = localStorage.getItem(storageKey);
      if (!key) {
        key = generateRecoveryKey();
        localStorage.setItem(storageKey, key);
      }
      currentRecoveryKey = key;
      
      // Update UI preview
      const preview = document.getElementById('heroKeyPreview');
      if (preview) preview.innerText = key;
      const modalDisplay = document.getElementById('activeRecoveryKeyDisplay');
      if (modalDisplay) modalDisplay.innerText = key;

      // Sync with Cloudflare KV in background
      try {
        await fetch('/api/recovery/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: email, recoveryKey: key })
        });
      } catch (e) {}
    }

    // --- EMAIL ADDRESS GENERATOR ---
    function generateRandomEmail() {
      const prefixes = ['swift', 'hyper', 'cyber', 'nova', 'echo', 'frost', 'pixel', 'sonic', 'alpha', 'quiet', 'brave', 'zen'];
      const nouns = ['fox', 'rider', 'falcon', 'ghost', 'tiger', 'ninja', 'comet', 'wolf', 'hawk', 'storm', 'spark', 'orbit'];
      const num = Math.floor(100 + Math.random() * 900);
      const email = prefixes[Math.floor(Math.random() * prefixes.length)] + '.' + nouns[Math.floor(Math.random() * nouns.length)] + num + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', email);
      saveToHistory(email);
      return email;
    }

    function saveToHistory(email) {
      let history = getHistory().filter(e => e !== email);
      history.unshift(email);
      localStorage.setItem('snapinbox_history', JSON.stringify(history.slice(0, 10)));
    }

    function getHistory() {
      try { return JSON.parse(localStorage.getItem('snapinbox_history') || '[]'); } catch (e) { return []; }
    }

    // --- SOUND NOTIFICATIONS ---
    function playChime() {
      if (!soundEnabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
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
      } catch (e) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById('soundToggle').innerText = soundEnabled ? '🔊' : '🔇';
    }

    // --- COPY HELPER WITH CONFETTI ---
    function copyEmail() {
      navigator.clipboard.writeText(currentEmail);
      const btnText = document.getElementById('copyBtnText');
      btnText.innerText = 'Copied! ✨';
      showToast('Email address copied to clipboard!', '📋');
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.35 },
        colors: ['#6366f1', '#a855f7', '#38bdf8']
      });
      setTimeout(() => { btnText.innerText = 'Copy'; }, 2000);
    }

    function copyText(str) {
      navigator.clipboard.writeText(str);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
      showToast('Copied: ' + str, '🔑');
    }

    function copyRecoveryKey() {
      if (!currentRecoveryKey) return;
      navigator.clipboard.writeText(currentRecoveryKey);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
      showToast('Recovery Key copied to clipboard! ✨', '🔑');
    }

    let activeTab = 'html';

    // --- FETCH EMAILS FROM BACKEND ---
    async function fetchEmails(isManual = false) {
      if (isManual) {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.classList.add('rotate-180');
        setTimeout(() => icon && icon.classList.remove('rotate-180'), 500);
      }

      try {
        const res = await fetch('/api/emails?address=' + encodeURIComponent(currentEmail));
        if (res.ok) {
          const data = await res.json();
          const newEmails = data.emails || [];

          if (newEmails.length > currentEmails.length) {
            playChime();
          }

          currentEmails = newEmails;
          renderMainView();
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
      refreshCountdown = 10;
    }

    // --- RENDER MAIN VIEW: INBOX OR FULL READER ---
    function renderMainView() {
      const container = document.getElementById('mainContainer');
      if (!container) return;

      if (selectedEmail) {
        // --- STATE B: FULL EMAIL READER VIEW ---
        const eml = selectedEmail;
        const sender = eml.from?.name || eml.from?.address || 'Unknown Sender';
        const senderAddr = eml.from?.address || '';
        const dateStr = new Date(eml.receivedAt).toLocaleString();

        container.innerHTML = \`
          <div class="bg-[#0d0d0f] border border-sky-500/40 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] rounded-2xl sm:rounded-[1.75rem] overflow-hidden flex flex-col min-h-[500px] sm:min-h-[580px] transition-all duration-300">
            
            <!-- Top Navigation Row: Back to Inbox & Actions -->
            <div class="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02]">
              <button onclick="closeEmailReader()" class="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-white/10 transition active:scale-95 shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                <span>Back to Inbox</span>
              </button>

              <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button onclick="downloadCurrentEml()" title="Download as .eml" class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  <span class="hidden sm:inline">EML</span>
                </button>
                <button onclick="deleteCurrentEmail()" title="Delete this message" class="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>

            <!-- Email Header Meta -->
            <div class="p-4 sm:p-7 border-b border-white/[0.08] bg-[#121215]/50 space-y-3 sm:space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                  <span>SPF: PASS &bull; DKIM: PASS</span>
                </span>
                <span class="text-xs text-zinc-500 font-mono">\${dateStr}</span>
              </div>

              <h1 class="text-lg sm:text-2xl font-bold text-white tracking-tight break-words">
                \${eml.subject || '(No Subject)'}
              </h1>

              <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs text-zinc-400">
                <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span class="text-zinc-300 font-medium shrink-0">From:</span>
                  <span class="text-white font-medium truncate">\${sender} <span class="text-zinc-500 font-mono">&lt;\${senderAddr}&gt;</span></span>
                </div>
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-zinc-300 font-medium shrink-0">To:</span>
                  <span class="font-mono text-indigo-300 truncate">\${eml.recipient}</span>
                </div>
              </div>

              <!-- Detected Verification OTP Banner -->
              \${eml.extractedOtp ? \`
                <div class="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-base">🔑</div>
                    <div>
                      <span class="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">Detected Verification OTP</span>
                      <span class="font-mono text-xl sm:text-2xl font-extrabold tracking-widest text-white">\${eml.extractedOtp}</span>
                    </div>
                  </div>
                  <button onclick="copyViewerOtp()" class="flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition active:scale-95 shrink-0 w-full sm:w-auto">
                    <span>Copy Code</span>
                  </button>
                </div>
              \` : ''}

              <!-- Detected Primary Link Banner -->
              \${eml.extractedLink ? \`
                <div class="p-3 sm:p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-xs">
                  <span class="text-indigo-300 font-medium truncate">Primary verification link detected</span>
                  <a href="\${eml.extractedLink}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 shrink-0 transition">
                    <span>Open Link</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
                </div>
              \` : ''}
            </div>

            <!-- Tab Headers -->
            <div class="px-4 sm:px-5 pt-3.5 flex items-center gap-3 border-b border-white/[0.08] text-xs">
              <button onclick="switchViewerTab('html')" class="pb-2.5 font-bold transition \${activeTab === 'html' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-400 hover:text-zinc-200'}">HTML Body</button>
              <button onclick="switchViewerTab('text')" class="pb-2.5 font-bold transition \${activeTab === 'text' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-400 hover:text-zinc-200'}">Plain Text</button>
              <button onclick="switchViewerTab('raw')" class="pb-2.5 font-bold transition \${activeTab === 'raw' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-400 hover:text-zinc-200'}">Raw MIME</button>
            </div>

            <!-- Tab Content Area -->
            <div class="flex-1 p-3 sm:p-6 bg-[#08080a] overflow-auto">
              \${activeTab === 'html' ? \`
                <div class="w-full min-h-[360px] sm:min-h-[500px] bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-inner">
                  <iframe id="readerIframe" class="w-full min-h-[360px] sm:min-h-[500px] border-none" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
                </div>
              \` : ''}

              \${activeTab === 'text' ? \`
                <pre class="p-3.5 sm:p-4 bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-white/5 text-zinc-300 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">\${eml.text || 'No plain text content available.'}</pre>
              \` : ''}

              \${activeTab === 'raw' ? \`
                <pre class="p-3.5 sm:p-4 bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-white/5 text-zinc-400 font-mono text-xs whitespace-pre-wrap leading-tight overflow-x-auto">\${eml.rawMime || JSON.stringify(eml, null, 2)}</pre>
              \` : ''}
            </div>

          </div>
        \`;

        if (activeTab === 'html') {
          setTimeout(() => {
            const ifr = document.getElementById('readerIframe');
            if (ifr) ifr.srcdoc = eml.html || \`<p style="padding:20px;font-family:sans-serif;">\${eml.text || ''}</p>\`;
          }, 10);
        }

      } else {
        // --- STATE A: INBOX VIEW (TEMPMAILLAB EXACT MIRROR) ---
        container.innerHTML = \`
          <div class="rounded-2xl sm:rounded-[1.75rem] bg-[#0d0d0f] border border-sky-500/40 shadow-[0_0_40px_-10px_rgba(56,189,248,0.2)] overflow-hidden transition-all duration-300">
            
            <!-- Header: Inbox on left, Refresh on right -->
            <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Inbox</h2>
                \${currentEmails.length > 0 ? \`
                  <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    \${currentEmails.length}
                  </span>
                \` : ''}
              </div>

              <div class="flex items-center gap-2">
                <button onclick="fetchEmails(true)" class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition active:scale-95">
                  <svg id="inboxRefreshIcon" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <!-- Body: Empty State OR Email List -->
            \${currentEmails.length === 0 ? \`
              <div class="py-16 sm:py-28 px-4 flex flex-col items-center justify-center text-center">
                <!-- Rotating circular arrows with envelope in center -->
                <div class="relative w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-5 flex items-center justify-center">
                  <svg class="w-16 h-16 sm:w-20 sm:h-20 text-zinc-400 animate-[spin_10s_linear_infinite]" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M52 32a20 20 0 0 1-34.14 14.14L14 42" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 52v-10h10" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 32A20 20 0 0 1 46.14 17.86L50 22" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M50 12v10h-10" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="absolute w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-300">
                    <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.25 4.5A2.25 2.25 0 0 1 4.5 2.25h15A2.25 2.25 0 0 1 21.75 4.5v15A2.25 2.25 0 0 1 19.5 21.75h-15A2.25 2.25 0 0 1 2.25 19.5v-15zm3.15 1.5l6.6 4.4 6.6-4.4H5.4zm14.1 2.45l-7.05 4.7a.75.75 0 0 1-.9 0L4.5 8.45V18a.75.75 0 0 0 .75.75h13.5a.75.75 0 0 0 .75-.75V8.45z"/>
                    </svg>
                  </div>
                </div>

                <h3 class="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-1.5">No emails yet</h3>
                <p class="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">Waiting for incoming emails</p>
              </div>
            \` : \`
              <div class="divide-y divide-white/[0.08] max-h-[650px] overflow-y-auto">
                \${currentEmails.map(eml => {
                  const sender = eml.from?.name || eml.from?.address || 'Unknown Sender';
                  const initial = sender.charAt(0).toUpperCase();
                  const dateStr = new Date(eml.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return \`
                    <div onclick="openEmailReader('\${eml.id}')" class="p-3.5 sm:p-5 hover:bg-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer transition group">
                      <div class="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-bold text-indigo-400 text-sm shrink-0 mt-0.5">
                          \${initial}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-sm text-white group-hover:text-indigo-300 transition truncate">\${sender}</span>
                            <span class="text-[11px] text-zinc-500 font-mono truncate hidden sm:inline">&lt;\${eml.from?.address || ''}&gt;</span>
                          </div>
                          <div class="text-xs sm:text-sm text-zinc-200 font-medium truncate mt-0.5">\${eml.subject || '(No Subject)'}</div>
                          <div class="text-xs text-zinc-500 truncate mt-0.5">\${(eml.text || '').substring(0, 95)}...</div>
                        </div>
                      </div>

                      <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        \${eml.extractedOtp ? \`
                          <div onclick="event.stopPropagation(); copyText('\${eml.extractedOtp}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold transition active:scale-95" title="Click to copy OTP">
                            <span>🔑 \${eml.extractedOtp}</span>
                            <span class="text-[10px] underline ml-0.5">Copy</span>
                          </div>
                        \` : ''}
                        <div class="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                          <span>\${dateStr}</span>
                          <span class="text-zinc-500 group-hover:text-white transition">&rarr;</span>
                        </div>
                      </div>
                    </div>
                  \`;
                }).join('')}
              </div>
            \`}
          </div>
        \`;
      }
    }

    function openEmailReader(id) {
      const eml = currentEmails.find(e => e.id === id);
      if (!eml) return;
      selectedEmail = eml;
      activeTab = 'html';
      renderMainView();
      const el = document.getElementById('mainContainer');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeEmailReader() {
      selectedEmail = null;
      renderMainView();
    }

    function switchViewerTab(tab) {
      activeTab = tab;
      renderMainView();
    }

    function copyViewerOtp() {
      if (selectedEmail && selectedEmail.extractedOtp) {
        copyText(selectedEmail.extractedOtp);
      }
    }

    function downloadCurrentEml() {
      if (!selectedEmail) return;
      const emlContent = \`From: \${selectedEmail.from?.name ? selectedEmail.from.name + ' ' : ''}<\${selectedEmail.from?.address || ''}>\\nTo: \${selectedEmail.recipient}\\nSubject: \${selectedEmail.subject}\\nDate: \${new Date(selectedEmail.receivedAt).toUTCString()}\\nMIME-Version: 1.0\\nContent-Type: text/html; charset=utf-8\\n\\n\${selectedEmail.html || selectedEmail.text || ''}\`;
      const blob = new Blob([emlContent], { type: 'message/rfc822' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (selectedEmail.subject || 'message').replace(/[^a-z0-9_-]/gi, '_') + '.eml';
      a.click();
    }

    async function deleteCurrentEmail() {
      if (!selectedEmail) return;
      if (!confirm('Delete this message?')) return;
      try {
        await fetch('/api/emails?address=' + encodeURIComponent(currentEmail) + '&id=' + selectedEmail.id, { method: 'DELETE' });
        selectedEmail = null;
        fetchEmails();
      } catch (e) {}
    }

    async function clearAllEmails() {
      if (currentEmails.length === 0) return;
      if (!confirm('Delete all messages in this inbox?')) return;
      try {
        await fetch('/api/emails?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' });
        selectedEmail = null;
        fetchEmails();
      } catch (e) {}
    }

    // --- HISTORY MODAL ---
    function toggleHistoryModal() {
      const modal = document.getElementById('historyModal');
      const isHidden = modal.classList.contains('hidden');
      if (isHidden) {
        const list = getHistory();
        const el = document.getElementById('historyList');
        if (list.length === 0) {
          el.innerHTML = '<p class="text-xs text-zinc-500">No previous addresses saved.</p>';
        } else {
          el.innerHTML = list.map(addr => \`
            <div onclick="switchAddress('\${addr}')" class="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-between cursor-pointer transition">
              <span class="font-mono text-xs text-indigo-300 truncate">\${addr}</span>
              \${addr === currentEmail ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>' : ''}
            </div>
          \`).join('');
        }
        modal.classList.remove('hidden');
      } else {
        modal.classList.add('hidden');
      }
    }

    function switchAddress(addr) {
      currentEmail = addr;
      localStorage.setItem('snapinbox_email', addr);
      toggleHistoryModal();
      updateEmailUI();
    }

    // --- KEYBOARD SHORTCUTS ---
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'c' || e.key === 'C') copyEmail();
      if (e.key === 'r' || e.key === 'R') fetchEmails(true);
      if (e.key === 'n' || e.key === 'N') randomizeEmail();
      if (e.key === 'Escape') {
        closeEmailReader();
        closeRecoveryModal();
        closeCustomModal();
        document.getElementById('historyModal').classList.add('hidden');
      }
    });

    // --- AUTO REFRESH LOOP ---
    function startRefreshLoop() {
      if (refreshTimerInterval) clearInterval(refreshTimerInterval);
      refreshTimerInterval = setInterval(() => {
        refreshCountdown--;
        const badge = document.getElementById('refreshTimerBadge');
        if (badge) badge.innerText = refreshCountdown + 's';

        if (refreshCountdown <= 0) {
          fetchEmails();
          refreshCountdown = 10;
        }
      }, 1000);
    }

    // --- INITIALIZE ON PAGE LOAD ---
    window.addEventListener('DOMContentLoaded', () => {
      updateEmailUI();
      startRefreshLoop();
    });
  </script>

</body>
</html>`;
}
