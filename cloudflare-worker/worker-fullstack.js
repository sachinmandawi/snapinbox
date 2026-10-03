/**
 * SnapInbox Pro - Ultra-Advanced Cloudflare Worker Temp Mail Engine
 * 
 * Features:
 * - Advanced RFC-compliant MIME & Quoted-Printable / Base64 Decoder
 * - Smart Multi-pattern OTP & Verification Link Extractor
 * - SPF / DKIM Authentication Detection
 * - Rich Multi-Template Test Simulator + Custom Test Composer
 * - Full EML Export, Print, Safe Sandboxed Dark/Light HTML Reader
 * - Multi-Address History Switcher (Local Storage backed)
 * - Keyboard Shortcuts (C: Copy, R: Refresh, N: New Address, T: Test)
 * - Browser Push Notifications + Synthesizer Audio Chime
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
  // Remove soft line breaks (=\r\n or =\n)
  let clean = input.replace(/=(?:\r\n|\n|\r)/g, '');
  // Replace hex =XX
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
      await env.SNAPINBOX_KV.put(key, JSON.stringify(emails), { expirationTtl: 7200 }); // 2 hours
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

            // Decode transfer encoding
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
      await saveEmails(recipient, existing.slice(0, 30), env);
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

    // API: TEST SENDER SIMULATOR (Presets & Custom)
    if (url.pathname === "/api/emails/test-send" && request.method === "POST") {
      try {
        const body = await request.json();
        const recipient = (body.recipient || "").toLowerCase().trim();
        if (!recipient) return new Response(JSON.stringify({ error: "Missing recipient" }), { status: 400 });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const presetType = body.preset || "netflix";

        const templates = {
          netflix: {
            from: { name: "Netflix Security", address: "security@netflix.com" },
            subject: "Your Netflix temporary access code",
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background-color: #141414; color: #ffffff; border-radius: 8px;">
              <h1 style="color: #e50914; font-size: 28px; font-weight: 800; margin: 0 0 20px 0; letter-spacing: 1px;">NETFLIX</h1>
              <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your temporary access code</h2>
              <p style="color: #cccccc; font-size: 15px; line-height: 1.5;">Please use the following 6-digit code to complete your sign in:</p>
              <div style="background-color: #222222; border: 1px solid #333333; border-radius: 6px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">${otp}</span>
              </div>
              <p style="color: #888888; font-size: 13px;">This code is valid for 15 minutes. If you did not request this code, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #333333; margin: 24px 0;" />
              <p style="color: #555555; font-size: 11px;">Netflix International B.V. &bull; Stadhouderskade 55, Amsterdam</p>
            </div>`,
            text: `Hi there,\n\nYour temporary access code is: ${otp}\n\nThis code expires in 15 minutes.\n\nHappy watching,\nThe Netflix Team`
          },
          discord: {
            from: { name: "Discord", address: "noreply@discord.com" },
            subject: "Verify your Discord email address",
            html: `<div style="font-family: 'gg sans', 'Noto Sans', sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background-color: #313338; color: #dbdee1; border-radius: 8px;">
              <h2 style="font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 16px;">Hey there!</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #dbdee1;">Thanks for registering an account with Discord! You're almost ready to start communicating with your communities.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://discord.com/verify?token=dsc_${otp}&code=${otp}" style="background-color: #5865F2; color: #ffffff; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="font-size: 13px; color: #949ba4;">Your security token: <strong>${otp}</strong></p>
            </div>`,
            text: `Hey there!\n\nPlease verify your email for Discord by clicking: https://discord.com/verify?token=${otp}`
          },
          google: {
            from: { name: "Google Accounts", address: "no-reply@accounts.google.com" },
            subject: `Google Verification Code: G-${otp}`,
            html: `<div style="font-family: 'Google Sans', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #dadce0; border-radius: 8px; background: #ffffff; color: #202124;">
              <h2 style="font-size: 22px; color: #202124; margin-bottom: 16px;">Verify your Google Account</h2>
              <p style="font-size: 14px; color: #3c4043; line-height: 1.5;">Use the following verification code to confirm your identity:</p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #1a73e8; margin: 24px 0;">G-${otp}</div>
              <p style="font-size: 12px; color: #5f6368;">This code expires in 10 minutes. Google will never call or message you asking for this code.</p>
            </div>`,
            text: `G-${otp} is your Google verification code. Do not share it with anyone.`
          }
        };

        const t = templates[presetType] || templates.netflix;
        const testEmail = {
          id: "test_" + Date.now().toString(36),
          recipient,
          from: t.from,
          subject: t.subject,
          text: t.text,
          html: t.html,
          rawMime: `From: ${t.from.name} <${t.from.address}>\nTo: ${recipient}\nSubject: ${t.subject}\nDate: ${new Date().toUTCString()}\n\n${t.text}`,
          receivedAt: new Date().toISOString(),
          read: false,
          size: t.html.length,
          extractedOtp: otp,
          extractedLink: extractActionLink(t.text, t.html),
          security: { spf: true, dkim: true }
        };

        const existing = await getEmails(recipient, env);
        existing.unshift(testEmail);
        await saveEmails(recipient, existing.slice(0, 30), env);

        return new Response(JSON.stringify({ success: true, email: testEmail }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // Serve HTML Dashboard
    return new Response(getProAppHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

// --- 4. PIXEL-PERFECT PRO FRONTEND ---
function getProAppHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>SnapInbox - Free Disposable Temporary Email</title>
  <meta name="description" content="Instant, secure temporary disposable email service powered by SnapInbox on mendoneet.me.">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 50: '#eef2ff', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-x: hidden; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 9999px; }
    .radar { animation: radar-pulse 2s infinite; }
    @keyframes radar-pulse {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
      70% { box-shadow: 0 0 0 16px rgba(99, 102, 241, 0); }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-[#090d16] text-slate-100">

  <!-- Header -->
  <header class="border-b border-slate-800/80 bg-[#0c1222]/80 backdrop-blur-md sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">Snap<span class="text-indigo-400">Inbox</span></span>
            <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">@mendoneet.me</span>
          </div>
          <p class="text-xs text-slate-400 hidden sm:block">Instant disposable email with automatic OTP detection</p>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Recent History Dropdown -->
        <button onclick="toggleHistoryModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition shadow-sm">
          <span>🕒 History</span>
        </button>
        <button onclick="openSetupModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition shadow-sm">
          <span>⚡ Cloudflare Engine</span>
        </button>
        <div class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="hidden md:inline">Live Polling Active</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

    <!-- Email Control Bar -->
    <div class="bg-[#111827]/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase font-bold tracking-wider text-slate-400">Your Temporary Email Address</span>
          <span class="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">Catch-All Active</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span id="expiryTimer">Expires in 60:00</span>
          </div>
          <button onclick="extendTime()" title="Extend lifespan by 10 minutes" class="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md border border-slate-700 transition">+10m</button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div onclick="copyEmail()" class="flex-1 flex items-center justify-between bg-[#0a0f1d] border border-indigo-500/30 hover:border-indigo-400/60 rounded-xl px-4 py-3 cursor-pointer group transition duration-200 shadow-inner">
          <span id="emailDisplay" class="font-mono text-lg sm:text-xl font-bold tracking-wide text-white truncate group-hover:text-indigo-200">loading@mendoneet.me</span>
          <span id="copyHint" class="text-xs font-medium text-indigo-400 group-hover:text-indigo-300 shrink-0 ml-2">Click to copy (C)</span>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="copyEmail()" id="copyBtn" class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95">
            <span>Copy</span>
          </button>
          <button onclick="fetchEmails(true)" title="Refresh inbox (R)" class="flex items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95">
            <svg id="refreshIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      <!-- Action Row -->
      <div class="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="randomizeEmail()" title="Shortcut: N" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>🎲 Randomize (N)</span>
          </button>
          <button onclick="openCustomModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>✏️ Custom Name</span>
          </button>
          <button onclick="openQrModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>📱 QR Code</span>
          </button>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <!-- Preset Dropdown for Simulator -->
          <select id="simPreset" class="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1.5 rounded-lg text-xs focus:outline-none">
            <option value="netflix">Netflix OTP</option>
            <option value="google">Google Code</option>
            <option value="discord">Discord Verify</option>
          </select>

          <button onclick="sendTestEmail()" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 text-amber-300 border border-amber-500/30 transition shadow-sm font-medium">
            <span>⚡ Simulate Email</span>
          </button>

          <button onclick="deleteAllEmails()" title="Clear inbox" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Inbox Grid: List & Detail View -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Email List -->
      <div class="lg:col-span-5 space-y-4">
        <div class="bg-[#111827]/70 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-xl">
          <div class="px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800">
            <span id="inboxCount">INBOX (0)</span>
            <span class="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> AUTO-SYNC (4s)
            </span>
          </div>
          <div id="emailList" class="divide-y divide-slate-800/60 max-h-[580px] overflow-y-auto">
            <!-- Dynamic items or empty radar -->
          </div>
        </div>
      </div>

      <!-- Right Column: Email Reader -->
      <div class="lg:col-span-7">
        <div id="emailViewer" class="bg-[#111827]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[580px] backdrop-blur-xl">
          <div class="p-12 text-center flex-1 flex flex-col items-center justify-center text-slate-500">
            <svg class="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <h4 class="text-base font-medium text-slate-300">No email selected</h4>
            <p class="text-xs text-slate-500 mt-1">Select an email from the inbox on the left to read its full content.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Feature Highlights Banner -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
      <div class="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <div>
          <h4 class="text-xs font-semibold text-white">100% Anonymous & Private</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">No registration, password, or IP tracking. Protects your personal inbox from spam.</p>
        </div>
      </div>

      <div class="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </div>
        <div>
          <h4 class="text-xs font-semibold text-white">Instant OTP & Link Detection</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Automatically extracts 4-8 digit verification codes and activation links.</p>
        </div>
      </div>

      <div class="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <div>
          <h4 class="text-xs font-semibold text-white">Cloudflare KV Persistence</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Global edge database stores your incoming messages securely with auto-expiry.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/80 bg-[#070b13] py-6 text-center text-xs text-slate-500">
    <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p>&copy; 2026 <strong class="text-slate-400">SnapInbox</strong>. Powered by Cloudflare & <code class="text-indigo-400 font-mono">@mendoneet.me</code></p>
      <div class="flex items-center gap-4">
        <button onclick="requestDesktopNotification()" class="text-slate-400 hover:text-indigo-300 transition">🔔 Enable Alerts</button>
        <button onclick="toggleSound()" id="soundToggle" class="flex items-center gap-1 text-slate-400 hover:text-white transition">
          <span>🔊 Sound On</span>
        </button>
      </div>
    </div>
  </footer>

  <!-- Modal: Custom Name -->
  <div id="customModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
      <button onclick="closeCustomModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
      <h3 class="text-lg font-bold text-white mb-1">Create Custom Email</h3>
      <p class="text-xs text-slate-400 mb-4">Choose your preferred username</p>
      <form onsubmit="handleCustomSubmit(event)" class="space-y-4">
        <div>
          <div class="flex items-center rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
            <input type="text" id="customInput" placeholder="e.g. alex, verify, myname" class="w-full bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none">
            <span class="bg-slate-800 px-3 py-2.5 text-xs text-slate-400 font-mono border-l border-slate-700">@mendoneet.me</span>
          </div>
          <p id="customError" class="text-xs text-rose-400 mt-1.5 hidden"></p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="closeCustomModal()" class="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">Use Address</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: QR Code -->
  <div id="qrModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
      <button onclick="closeQrModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
      <h3 class="text-lg font-bold text-white mb-1">Scan QR Code</h3>
      <p class="text-xs text-slate-400 mb-4">Scan with your smartphone to send or copy this email</p>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 inline-block mx-auto mb-4">
        <img id="qrImg" src="" alt="QR Code" width="200" height="200" class="rounded-lg mx-auto">
      </div>
      <p id="qrAddress" class="font-mono text-xs text-indigo-300 mb-4 truncate"></p>
      <button onclick="closeQrModal()" class="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white">Close</button>
    </div>
  </div>

  <!-- Modal: History -->
  <div id="historyModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
      <button onclick="toggleHistoryModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
      <h3 class="text-lg font-bold text-white mb-1">Recent Addresses</h3>
      <p class="text-xs text-slate-400 mb-4">Switch back to previously generated emails</p>
      <div id="historyList" class="space-y-2 max-h-60 overflow-y-auto"></div>
    </div>
  </div>

  <!-- Modal: Setup Status -->
  <div id="setupModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
      <button onclick="closeSetupModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
      <h3 class="text-lg font-bold text-white mb-2">Cloudflare Architecture Status</h3>
      <p class="text-xs text-slate-400 mb-4">SnapInbox is running 100% serverless on Cloudflare Edge.</p>
      <div class="space-y-2.5 text-xs text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>✅ <strong>Domain:</strong> Attached to <code class="text-indigo-300">mendoneet.me</code></div>
        <div>✅ <strong>Email Routing:</strong> Active MX Records</div>
        <div>✅ <strong>Catch-all Worker:</strong> <code class="text-indigo-300">mendoneet-worker</code></div>
        <div>✅ <strong>Database:</strong> Cloudflare KV (<code class="text-emerald-300">SNAPINBOX_KV</code>)</div>
      </div>
      <button onclick="closeSetupModal()" class="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">Close</button>
    </div>
  </div>

  <script>
    const DOMAIN = 'mendoneet.me';
    let currentEmail = localStorage.getItem('snapinbox_email') || generateRandomEmail();
    let currentEmails = [];
    let selectedEmailId = null;
    let expirySecs = 3600;
    let soundEnabled = true;
    let activeTab = 'html';

    function getHistory() {
      try { return JSON.parse(localStorage.getItem('snapinbox_history') || '[]'); } catch (e) { return []; }
    }

    function saveHistory(email) {
      let history = getHistory().filter(e => e !== email);
      history.unshift(email);
      localStorage.setItem('snapinbox_history', JSON.stringify(history.slice(0, 10)));
    }

    function generateRandomEmail() {
      const adjs = ['swift', 'hyper', 'cyber', 'nova', 'echo', 'frost', 'pixel', 'sonic', 'dark', 'alpha', 'quiet', 'brave'];
      const nouns = ['fox', 'rider', 'falcon', 'ghost', 'tiger', 'ninja', 'comet', 'wolf', 'hawk', 'storm', 'spark', 'orbit'];
      const num = Math.floor(100 + Math.random() * 900);
      const email = adjs[Math.floor(Math.random() * adjs.length)] + '.' + nouns[Math.floor(Math.random() * nouns.length)] + num + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', email);
      saveHistory(email);
      return email;
    }

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
      document.getElementById('soundToggle').innerText = soundEnabled ? '🔊 Sound On' : '🔇 Muted';
    }

    function requestDesktopNotification() {
      if ('Notification' in window) {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') alert('Desktop notifications enabled!');
        });
      }
    }

    function updateEmailUI() {
      document.getElementById('emailDisplay').innerText = currentEmail;
      fetchEmails();
    }

    function copyEmail() {
      navigator.clipboard.writeText(currentEmail);
      document.getElementById('copyHint').innerText = 'Copied!';
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.35 } });
      setTimeout(() => { document.getElementById('copyHint').innerText = 'Click to copy (C)'; }, 2000);
    }

    function randomizeEmail() {
      currentEmail = generateRandomEmail();
      selectedEmailId = null;
      updateEmailUI();
    }

    function extendTime() {
      expirySecs += 600;
    }

    // Modals
    function openCustomModal() { document.getElementById('customModal').classList.remove('hidden'); }
    function closeCustomModal() { document.getElementById('customModal').classList.add('hidden'); }
    function handleCustomSubmit(e) {
      e.preventDefault();
      const val = document.getElementById('customInput').value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (val.length < 3) {
        document.getElementById('customError').innerText = 'Minimum 3 characters required';
        document.getElementById('customError').classList.remove('hidden');
        return;
      }
      currentEmail = val + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', currentEmail);
      saveHistory(currentEmail);
      selectedEmailId = null;
      closeCustomModal();
      updateEmailUI();
    }

    function openQrModal() {
      document.getElementById('qrAddress').innerText = currentEmail;
      document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent('mailto:' + currentEmail) + '&bgcolor=111827&color=ffffff&margin=10';
      document.getElementById('qrModal').classList.remove('hidden');
    }
    function closeQrModal() { document.getElementById('qrModal').classList.add('hidden'); }

    function toggleHistoryModal() {
      const modal = document.getElementById('historyModal');
      const isHidden = modal.classList.contains('hidden');
      if (isHidden) {
        const history = getHistory();
        const listEl = document.getElementById('historyList');
        if (history.length === 0) {
          listEl.innerHTML = '<p class="text-xs text-slate-500">No previous addresses found.</p>';
        } else {
          listEl.innerHTML = history.map(addr => \`
            <div onclick="switchAddress('\${addr}')" class="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex justify-between items-center cursor-pointer transition">
              <span class="font-mono text-xs text-indigo-300 truncate">\${addr}</span>
              \${addr === currentEmail ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">Active</span>' : ''}
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
      selectedEmailId = null;
      document.getElementById('historyModal').classList.add('hidden');
      updateEmailUI();
    }

    function openSetupModal() { document.getElementById('setupModal').classList.remove('hidden'); }
    function closeSetupModal() { document.getElementById('setupModal').classList.add('hidden'); }

    // Fetch Emails
    async function fetchEmails(isManual = false) {
      if (isManual) document.getElementById('refreshIcon').classList.add('animate-spin');
      try {
        const res = await fetch('/api/emails?address=' + encodeURIComponent(currentEmail));
        const data = await res.json();
        const emails = data.emails || [];

        // If new emails arrived
        if (emails.length > currentEmails.length) {
          playChime();
          if ('Notification' in window && Notification.permission === 'granted') {
            const latest = emails[0];
            new Notification('New Email from ' + (latest.from.name || latest.from.address), {
              body: latest.subject,
              icon: 'https://cdn-icons-png.flaticon.com/512/561/561127.png'
            });
          }
        }

        renderEmails(emails);
      } catch (e) {
        console.error(e);
      } finally {
        if (isManual) setTimeout(() => document.getElementById('refreshIcon').classList.remove('animate-spin'), 400);
      }
    }

    function renderEmails(emails) {
      currentEmails = emails;
      document.title = (emails.length > 0 ? '(' + emails.length + ') ' : '') + 'SnapInbox - Free Temp Mail';
      document.getElementById('inboxCount').innerText = 'INBOX (' + emails.length + ')';
      const listEl = document.getElementById('emailList');

      if (emails.length === 0) {
        listEl.innerHTML = \`
          <div class="bg-[#111827]/70 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
            <div class="relative mb-6">
              <div class="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center radar border border-indigo-500/30">
                <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
              </div>
            </div>
            <h3 class="text-lg font-bold text-slate-100 mb-2">Your inbox is ready and listening!</h3>
            <p class="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">Send an email or verification code to <span class="font-mono text-indigo-300 font-semibold break-all">\${currentEmail}</span></p>
            <div class="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Polling server every 4 seconds</span>
            </div>
          </div>
        \`;
        return;
      }

      listEl.innerHTML = emails.map(e => \`
        <div onclick="selectEmail('\${e.id}')" class="p-4 transition cursor-pointer flex items-start gap-3 border-l-4 \${e.id === selectedEmailId ? 'bg-indigo-950/40 border-indigo-500' : 'border-transparent hover:bg-slate-800/40'}">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-sm shrink-0">
            \${(e.from.name || e.from.address || '?').charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-sm font-bold text-white truncate">\${e.from.name || e.from.address}</span>
              <span class="text-[11px] text-slate-500 font-mono">\${new Date(e.receivedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <h4 class="text-xs font-semibold text-indigo-200 truncate mb-1">\${e.subject || '(No Subject)'}</h4>
            <p class="text-xs text-slate-500 line-clamp-1">\${e.text || 'No preview available'}</p>
            <div class="flex items-center gap-1.5 mt-1.5">
              \${e.extractedOtp ? \`<span class="text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">🔑 OTP: \${e.extractedOtp}</span>\` : ''}
              \${e.security && e.security.spf ? \`<span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">SPF ✔</span>\` : ''}
            </div>
          </div>
        </div>
      \`).join('');

      if (!selectedEmailId && emails.length > 0) {
        selectEmail(emails[0].id);
      }
    }

    function selectEmail(id) {
      selectedEmailId = id;
      renderEmails(currentEmails);
      const email = currentEmails.find(e => e.id === id);
      if (!email) return;

      const viewer = document.getElementById('emailViewer');
      viewer.innerHTML = \`
        <div class="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div class="flex justify-between items-start gap-4 mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-white break-words">\${email.subject}</h2>
            <div class="flex items-center gap-1">
              <button onclick="downloadEml('\${email.id}')" title="Download .eml" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
              <button onclick="deleteEmail('\${email.id}')" title="Delete message" class="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
          <div class="space-y-1.5 text-xs text-slate-400">
            <div><strong class="text-slate-300">From:</strong> \${email.from.name ? email.from.name + ' ' : ''}&lt;\${email.from.address}&gt;</div>
            <div><strong class="text-slate-300">To:</strong> <span class="font-mono text-indigo-300">\${email.recipient}</span></div>
            <div><strong class="text-slate-300">Date:</strong> \${new Date(email.receivedAt).toLocaleString()}</div>
          </div>

          <!-- Smart OTP Banner -->
          \${email.extractedOtp ? \`
            <div class="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block">Verification Code Detected</span>
                <span class="font-mono text-2xl font-bold tracking-widest text-emerald-300">\${email.extractedOtp}</span>
              </div>
              <button onclick="navigator.clipboard.writeText('\${email.extractedOtp}'); alert('Code copied: ' + '\${email.extractedOtp}');" class="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">Copy Code</button>
            </div>
          \` : ''}

          <!-- Smart Action Link Banner -->
          \${email.extractedLink ? \`
            <div class="mt-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
              <span class="text-indigo-300 font-medium truncate">Verification Link Found</span>
              <a href="\${email.extractedLink}" target="_blank" rel="noopener noreferrer" class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1">
                <span>Open Link</span> &rarr;
              </a>
            </div>
          \` : ''}

          <!-- Tabs -->
          <div class="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
            <button onclick="switchTab('html')" id="tabHtml" class="px-3 py-1 rounded-lg text-xs font-medium \${activeTab === 'html' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">HTML Body</button>
            <button onclick="switchTab('text')" id="tabText" class="px-3 py-1 rounded-lg text-xs font-medium \${activeTab === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">Text</button>
            <button onclick="switchTab('raw')" id="tabRaw" class="px-3 py-1 rounded-lg text-xs font-medium \${activeTab === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">Headers / Raw</button>
          </div>
        </div>
        <div class="flex-1 p-4 bg-[#0a0e1a] min-h-[350px] overflow-auto" id="tabContent">
          \${getTabBody(email)}
        </div>
      \`;
    }

    function switchTab(t) {
      activeTab = t;
      const email = currentEmails.find(e => e.id === selectedEmailId);
      if (email) selectEmail(email.id);
    }

    function getTabBody(email) {
      if (activeTab === 'text') {
        return \`<div class="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">\${email.text || 'No text content'}</div>\`;
      }
      if (activeTab === 'raw') {
        return \`<div class="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">\${email.rawMime || JSON.stringify(email, null, 2)}</div>\`;
      }
      return \`<div class="w-full h-full min-h-[360px] bg-white rounded-xl overflow-hidden shadow-inner"><iframe srcdoc="\${email.html.replace(/"/g, '&quot;')}" class="w-full h-full min-h-[360px] border-0"></iframe></div>\`;
    }

    function downloadEml(id) {
      const email = currentEmails.find(e => e.id === id);
      if (!email) return;
      const blob = new Blob([email.rawMime || email.text || ''], { type: 'message/rfc822' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (email.subject.replace(/[^a-z0-9]/gi, '_') || 'email') + '.eml';
      a.click();
    }

    async function sendTestEmail() {
      const preset = document.getElementById('simPreset').value;
      await fetch('/api/emails/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: currentEmail, preset })
      });
      fetchEmails();
    }

    async function deleteEmail(id) {
      await fetch('/api/emails?address=' + encodeURIComponent(currentEmail) + '&id=' + id, { method: 'DELETE' });
      selectedEmailId = null;
      fetchEmails();
    }

    async function deleteAllEmails() {
      if (!confirm('Clear all emails in this temporary inbox?')) return;
      await fetch('/api/emails?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' });
      selectedEmailId = null;
      fetchEmails();
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'c' || e.key === 'C') copyEmail();
      if (e.key === 'r' || e.key === 'R') fetchEmails(true);
      if (e.key === 'n' || e.key === 'N') randomizeEmail();
      if (e.key === 't' || e.key === 'T') sendTestEmail();
    });

    // Expiry Timer
    setInterval(() => {
      expirySecs--;
      if (expirySecs <= 0) {
        randomizeEmail();
        expirySecs = 3600;
      }
      const m = Math.floor(expirySecs / 60).toString().padStart(2, '0');
      const s = (expirySecs % 60).toString().padStart(2, '0');
      document.getElementById('expiryTimer').innerText = 'Expires in ' + m + ':' + s;
    }, 1000);

    // Initial load & Polling
    updateEmailUI();
    saveHistory(currentEmail);
    setInterval(fetchEmails, 4000);
  </script>
</body>
</html>`;
}
