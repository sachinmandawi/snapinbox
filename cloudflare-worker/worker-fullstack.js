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
            subject: `Your Netflix temporary access code is ${otp}`,
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background-color: #141414; color: #ffffff; border-radius: 12px; border: 1px solid #2a2a2a;">
              <h1 style="color: #e50914; font-size: 28px; font-weight: 800; margin: 0 0 20px 0; letter-spacing: 1px;">NETFLIX</h1>
              <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your temporary sign-in code</h2>
              <p style="color: #cccccc; font-size: 15px; line-height: 1.5;">Please use the following 6-digit code to complete your login to Netflix:</p>
              <div style="background-color: #222222; border: 1px solid #383838; border-radius: 8px; padding: 22px; text-align: center; margin: 24px 0;">
                <span style="font-size: 38px; font-weight: bold; letter-spacing: 10px; color: #ffffff;">${otp}</span>
              </div>
              <p style="color: #888888; font-size: 13px;">This code is valid for 15 minutes. If you did not make this request, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #2d2d2d; margin: 24px 0;" />
              <p style="color: #555555; font-size: 11px;">Netflix International B.V. &bull; Stadhouderskade 55, Amsterdam</p>
            </div>`,
            text: `Hi there,\n\nYour Netflix temporary access code is: ${otp}\n\nThis code expires in 15 minutes.\n\nHappy watching,\nThe Netflix Team`
          },
          google: {
            from: { name: "Google Accounts", address: "no-reply@accounts.google.com" },
            subject: `Google Verification Code: G-${otp}`,
            html: `<div style="font-family: 'Google Sans', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #2a2a2a; border-radius: 12px; background: #16181c; color: #e8eaed;">
              <h2 style="font-size: 22px; color: #ffffff; margin-bottom: 16px;">Verify your Google Account</h2>
              <p style="font-size: 14px; color: #bdc1c6; line-height: 1.5;">Use the following verification code to confirm your identity:</p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #8ab4f8; margin: 24px 0; background: #20242a; padding: 18px; border-radius: 8px; text-align: center;">G-${otp}</div>
              <p style="font-size: 12px; color: #9aa0a6;">This code expires in 10 minutes. Google will never call or message you asking for this code.</p>
            </div>`,
            text: `G-${otp} is your Google verification code. Do not share it with anyone.`
          },
          discord: {
            from: { name: "Discord", address: "noreply@discord.com" },
            subject: "Verify your Discord email address",
            html: `<div style="font-family: 'gg sans', sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background-color: #2b2d31; color: #dbdee1; border-radius: 12px; border: 1px solid #383a40;">
              <h2 style="font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 16px;">Hey there!</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #dbdee1;">Thanks for registering an account with Discord! You're almost ready to start communicating with your friends and communities.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://discord.com/verify?token=dsc_${otp}&code=${otp}" style="background-color: #5865F2; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="font-size: 13px; color: #949ba4;">Your security OTP token: <strong>${otp}</strong></p>
            </div>`,
            text: `Hey there!\n\nPlease verify your email for Discord: https://discord.com/verify?token=dsc_${otp}&code=${otp}\n\nSecurity token: ${otp}`
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
        await saveEmails(recipient, existing.slice(0, 50), env);

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
<body class="min-h-screen flex flex-col bg-[#050505] text-[#f5f5f5] selection:bg-indigo-500/30 selection:text-indigo-200">

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
      <div class="flex items-center gap-2 sm:gap-3">
        <button onclick="openRecoveryModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition shadow-sm">
          <span>🔑 Restore</span>
        </button>

        <button onclick="toggleHistoryModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition">
          <span>🕒 History</span>
        </button>

        <button onclick="toggleSound()" id="soundToggle" class="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition" title="Toggle Sound">
          🔊
        </button>
      </div>
    </div>
  </header>

  <!-- Main Hero & Temp Mail Section -->
  <main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 space-y-10">

    <!-- Hero Title & Subtitle -->
    <div class="text-center max-w-2xl mx-auto space-y-3">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-zinc-300 mb-1">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
        <span>Free Temp Mail with Password &amp; Recovery Key</span>
      </div>
      <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
        Free Temp Mail with <span class="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">Recovery Key</span>
      </h1>
      <p class="text-sm sm:text-base text-zinc-400 leading-relaxed">
        Create free temp mail with a password-style Recovery Key, additional custom options, and instant OTP verification support. Restore your temporary inbox for up to 30 days.
      </p>
    </div>

    <!-- Centerpiece: Pill Address Bar -->
    <div class="max-w-2xl mx-auto">
      <div class="glass-pill rounded-full p-2 sm:p-2.5 pl-4 sm:pl-6 flex items-center justify-between shadow-2xl relative group">
        <!-- Left: Envelope Icon + Address -->
        <div class="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
          <div class="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
            </svg>
          </div>
          <span id="emailDisplay" onclick="copyEmail()" class="font-mono text-base sm:text-lg font-bold tracking-wide text-white select-all truncate cursor-pointer hover:text-indigo-300 transition" title="Click to copy address">
            loading@mendoneet.me
          </span>
        </div>

        <!-- Right: Rounded Pill Copy Button -->
        <button onclick="copyEmail()" id="copyBtn" class="flex items-center gap-2 px-6 sm:px-7 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 shrink-0">
          <svg id="copyIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <span id="copyBtnText">Copy</span>
        </button>
      </div>

      <!-- The 3 Signature Action Cards (Exact TempMailLab Layout) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5 mt-4">
        
        <!-- 1. Refresh Button Card -->
        <button onclick="fetchEmails(true)" class="action-card rounded-2xl p-3.5 flex items-center justify-between text-left group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition">
              <svg id="refreshIcon" class="w-4 h-4 transition duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
            <div>
              <div class="font-semibold text-sm text-zinc-100">Refresh</div>
              <div class="text-[11px] text-zinc-400">Sync inbox</div>
            </div>
          </div>
          <span id="refreshTimerBadge" class="text-[11px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">10s</span>
        </button>

        <!-- 2. Change / Custom Email Card -->
        <button onclick="openCustomModal()" class="action-card rounded-2xl p-3.5 flex items-center justify-between text-left group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </div>
            <div>
              <div class="font-semibold text-sm text-zinc-100">Change</div>
              <div class="text-[11px] text-zinc-400">Custom username</div>
            </div>
          </div>
          <span class="text-xs text-zinc-500 group-hover:text-zinc-300 transition">✏️</span>
        </button>

        <!-- 3. Recovery Key Card (Signature Feature) -->
        <button onclick="openRecoveryModal()" class="action-card rounded-2xl p-3.5 flex items-center justify-between text-left group border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:border-amber-400/40 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
              </svg>
            </div>
            <div>
              <div class="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
                <span>Recovery Key</span>
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </div>
              <div class="text-[11px] text-amber-400/90 font-mono tracking-wider" id="heroKeyPreview">SNAP-••••</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">30d</span>
        </button>

      </div>
    </div>

    <!-- Live Inbox Container -->
    <div class="max-w-4xl mx-auto rounded-[1.75rem] glass-card p-5 sm:p-7 shadow-2xl relative">
      
      <!-- Inbox Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Inbox</h2>
            <span id="inboxCountBadge" class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">0</span>
          </div>
          <div class="flex items-center gap-2 mt-1 text-xs text-zinc-400">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Real-time listener active on Cloudflare Edge</span>
          </div>
        </div>

        <!-- Quick Inbox Tools -->
        <div class="flex items-center gap-2">
          <!-- Simulate Test Email Preset Dropdown -->
          <div class="relative group">
            <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 hover:text-white border border-white/10 transition shadow-sm">
              <span>⚡ Send Test OTP</span>
              <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="hidden group-hover:block absolute right-0 mt-1 w-44 bg-[#141416] border border-white/10 rounded-xl shadow-2xl py-1 z-30 text-xs">
              <button onclick="sendTestSimulator('netflix')" class="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <span>🔴 Netflix (OTP)</span>
              </button>
              <button onclick="sendTestSimulator('google')" class="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <span>🔵 Google (G-Code)</span>
              </button>
              <button onclick="sendTestSimulator('discord')" class="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <span>🟣 Discord (Link)</span>
              </button>
            </div>
          </div>

          <button onclick="clearAllEmails()" title="Clear all emails in this inbox" class="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>

      <!-- Inbox Body (Empty Radar vs Populated List) -->
      <div id="inboxContent" class="pt-6">
        <!-- Rendered by JavaScript -->
      </div>

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

  <!-- 3. EMAIL VIEWER MODAL / DRAWER -->
  <div id="emailViewerModal" class="hidden fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
    <div class="glass-card bg-[#111113] max-w-3xl w-full max-h-[90vh] rounded-3xl border border-white/15 shadow-2xl flex flex-col overflow-hidden">
      
      <!-- Modal Top Bar -->
      <div class="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0 bg-[#161618]">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span id="viewerSecurityBadge" class="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">SPF: PASS &bull; DKIM: PASS</span>
            <span id="viewerTime" class="text-xs text-zinc-400">Just now</span>
          </div>
          <h3 id="viewerSubject" class="text-lg sm:text-xl font-bold text-white truncate">Email Subject</h3>
          <p id="viewerFrom" class="text-xs text-zinc-400 mt-0.5 truncate">From: sender@example.com</p>
        </div>
        <button onclick="closeEmailViewer()" class="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-base transition">✕</button>
      </div>

      <!-- Highlight Banner: OTP Code (If available) -->
      <div id="viewerOtpBanner" class="hidden mx-5 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🔑</span>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-bold text-amber-400">Detected Verification OTP</div>
            <div id="viewerOtpValue" class="text-2xl font-mono font-extrabold text-white tracking-widest">849201</div>
          </div>
        </div>
        <button onclick="copyViewerOtp()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition active:scale-95">
          Copy Code
        </button>
      </div>

      <!-- Highlight Banner: Action Link (If available) -->
      <div id="viewerLinkBanner" class="hidden mx-5 mt-3 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5 truncate">
          <span class="text-lg">🔗</span>
          <span class="text-xs text-indigo-300 font-medium truncate">Primary verification link detected</span>
        </div>
        <a id="viewerActionLink" href="#" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shrink-0">
          Open Link &rarr;
        </a>
      </div>

      <!-- View Tabs -->
      <div class="px-5 pt-4 flex items-center justify-between border-b border-white/[0.08] text-xs">
        <div class="flex items-center gap-4">
          <button onclick="switchViewerTab('html')" id="tabHtml" class="pb-2 font-bold text-indigo-400 border-b-2 border-indigo-500">HTML Preview</button>
          <button onclick="switchViewerTab('text')" id="tabText" class="pb-2 font-medium text-zinc-400 hover:text-zinc-200">Plain Text</button>
          <button onclick="switchViewerTab('raw')" id="tabRaw" class="pb-2 font-medium text-zinc-400 hover:text-zinc-200">Raw MIME</button>
        </div>
        <div class="flex items-center gap-2 pb-2">
          <button onclick="downloadCurrentEml()" title="Download .eml" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition">
            ⬇️ EML
          </button>
          <button onclick="deleteCurrentEmail()" title="Delete Email" class="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 transition">
            🗑️
          </button>
        </div>
      </div>

      <!-- Email Content Body -->
      <div class="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#0c0c0e]">
        <div id="viewerHtmlContainer" class="w-full bg-white rounded-xl overflow-hidden min-h-[300px]">
          <iframe id="viewerIframe" class="w-full min-h-[350px] border-none" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
        </div>
        <pre id="viewerTextContainer" class="hidden font-mono text-xs sm:text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed p-4 bg-zinc-900 rounded-xl border border-white/5"></pre>
        <pre id="viewerRawContainer" class="hidden font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-tight p-4 bg-zinc-900 rounded-xl border border-white/5 overflow-x-auto"></pre>
      </div>

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
          renderInbox();
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
      refreshCountdown = 10;
    }

    // --- RENDER INBOX (EMPTY VS LIST) ---
    function renderInbox() {
      const container = document.getElementById('inboxContent');
      const badge = document.getElementById('inboxCountBadge');
      if (badge) badge.innerText = currentEmails.length;

      if (!currentEmails || currentEmails.length === 0) {
        container.innerHTML = \`
          <div class="py-12 sm:py-16 flex flex-col items-center justify-center text-center">
            <!-- Pulsing Concentric Radar Graphic -->
            <div class="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full bg-indigo-500/20 radar-pulse"></div>
              <div class="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>

            <h3 class="text-lg font-bold text-white mb-1.5">Waiting for incoming messages...</h3>
            <p class="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
              Send an email to <span class="font-mono text-indigo-300 font-semibold">\${currentEmail}</span>. Verification OTP codes and magic links will appear automatically.
            </p>

            <button onclick="sendTestSimulator('netflix')" class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition flex items-center gap-2 shadow-sm active:scale-95">
              <span>⚡ Send Sample Verification OTP</span>
            </button>
          </div>
        \`;
      } else {
        container.innerHTML = \`
          <div class="space-y-3">
            \${currentEmails.map(eml => {
              const sender = eml.from?.name || eml.from?.address || 'Unknown Sender';
              const initial = sender.charAt(0).toUpperCase();
              const dateStr = new Date(eml.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return \`
                <div onclick="openEmailViewer('\${eml.id}')" class="p-4 sm:p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-200 group">
                  
                  <div class="flex items-start gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-indigo-400/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-sm shrink-0">
                      \${initial}
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-white group-hover:text-indigo-300 transition truncate">\${sender}</span>
                        <span class="text-[11px] text-zinc-500 font-mono truncate">&lt;\${eml.from?.address || ''}&gt;</span>
                      </div>
                      <div class="text-xs sm:text-sm text-zinc-300 font-medium truncate mt-0.5">\${eml.subject || '(No Subject)'}</div>
                      <div class="text-xs text-zinc-500 truncate mt-0.5 max-w-xl">\${(eml.text || '').substring(0, 95)}...</div>
                    </div>
                  </div>

                  <div class="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    \${eml.extractedOtp ? \`
                      <div onclick="event.stopPropagation(); copyText('\${eml.extractedOtp}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold transition" title="Click to copy OTP">
                        <span>🔑 \${eml.extractedOtp}</span>
                        <span class="text-[10px] underline ml-1">Copy</span>
                      </div>
                    \` : ''}
                    <span class="text-xs text-zinc-500 font-mono">\${dateStr}</span>
                    <span class="text-zinc-500 group-hover:text-white transition">&rarr;</span>
                  </div>

                </div>
              \`;
            }).join('')}
          </div>
        \`;
      }
    }

    // --- RECOVERY MODAL HANDLERS ---
    function openRecoveryModal() {
      document.getElementById('recoveryModal').classList.remove('hidden');
    }
    function closeRecoveryModal() {
      document.getElementById('recoveryModal').classList.add('hidden');
      document.getElementById('restoreError').classList.add('hidden');
    }

    async function handleRestoreSubmit() {
      const input = document.getElementById('restoreKeyInput');
      const errEl = document.getElementById('restoreError');
      const btn = document.getElementById('restoreSubmitBtn');
      const keyVal = input.value.trim().toUpperCase();

      if (!keyVal) {
        errEl.innerText = 'Please enter a Recovery Key.';
        errEl.classList.remove('hidden');
        return;
      }

      btn.innerText = 'Restoring...';
      btn.disabled = true;
      errEl.classList.add('hidden');

      try {
        const res = await fetch('/api/recovery/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recoveryKey: keyVal })
        });
        const data = await res.json();

        if (data.success && data.address) {
          currentEmail = data.address;
          currentRecoveryKey = keyVal;
          localStorage.setItem('snapinbox_email', currentEmail);
          localStorage.setItem('snapinbox_rec_' + currentEmail, currentRecoveryKey);
          saveToHistory(currentEmail);
          
          updateEmailUI();
          closeRecoveryModal();
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.3 } });
          showToast('Inbox restored: ' + currentEmail, '🎉');
        } else {
          errEl.innerText = data.error || 'Recovery Key not found or expired.';
          errEl.classList.remove('hidden');
        }
      } catch (err) {
        errEl.innerText = 'Connection error: ' + err.message;
        errEl.classList.remove('hidden');
      } finally {
        btn.innerText = 'Restore Inbox';
        btn.disabled = false;
      }
    }

    // --- CUSTOM EMAIL MODAL HANDLERS ---
    function openCustomModal() { document.getElementById('customModal').classList.remove('hidden'); }
    function closeCustomModal() { document.getElementById('customModal').classList.add('hidden'); }

    function handleCustomSubmit(e) {
      e.preventDefault();
      const val = document.getElementById('customInput').value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const errEl = document.getElementById('customError');

      if (val.length < 3) {
        errEl.innerText = 'Minimum 3 characters required (letters, numbers, dot, dash)';
        errEl.classList.remove('hidden');
        return;
      }

      currentEmail = val + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', currentEmail);
      saveToHistory(currentEmail);
      closeCustomModal();
      updateEmailUI();
    }

    function randomizeEmail() {
      currentEmail = generateRandomEmail();
      updateEmailUI();
    }

    function updateEmailUI() {
      document.getElementById('emailDisplay').innerText = currentEmail;
      ensureRecoveryKeyForEmail(currentEmail);
      fetchEmails();
    }

    // --- EMAIL VIEWER MODAL HANDLERS ---
    function openEmailViewer(id) {
      const eml = currentEmails.find(e => e.id === id);
      if (!eml) return;
      selectedEmail = eml;

      document.getElementById('viewerSubject').innerText = eml.subject || '(No Subject)';
      document.getElementById('viewerFrom').innerText = 'From: ' + (eml.from?.name ? eml.from.name + ' <' + eml.from.address + '>' : eml.from?.address || 'Unknown');
      document.getElementById('viewerTime').innerText = new Date(eml.receivedAt).toLocaleString();

      // OTP Banner
      const otpBanner = document.getElementById('viewerOtpBanner');
      if (eml.extractedOtp) {
        document.getElementById('viewerOtpValue').innerText = eml.extractedOtp;
        otpBanner.classList.remove('hidden');
      } else {
        otpBanner.classList.add('hidden');
      }

      // Link Banner
      const linkBanner = document.getElementById('viewerLinkBanner');
      if (eml.extractedLink) {
        document.getElementById('viewerActionLink').href = eml.extractedLink;
        linkBanner.classList.remove('hidden');
      } else {
        linkBanner.classList.add('hidden');
      }

      // Populate Contents
      const iframe = document.getElementById('viewerIframe');
      iframe.srcdoc = eml.html || '<p style="padding:20px;font-family:sans-serif;">' + (eml.text || 'No content') + '</p>';
      document.getElementById('viewerTextContainer').innerText = eml.text || 'No plain text available.';
      document.getElementById('viewerRawContainer').innerText = eml.rawMime || 'No raw MIME available.';

      switchViewerTab('html');
      document.getElementById('emailViewerModal').classList.remove('hidden');
    }

    function closeEmailViewer() {
      document.getElementById('emailViewerModal').classList.add('hidden');
      selectedEmail = null;
    }

    function copyViewerOtp() {
      if (selectedEmail && selectedEmail.extractedOtp) {
        copyText(selectedEmail.extractedOtp);
      }
    }

    function switchViewerTab(tab) {
      const tabH = document.getElementById('tabHtml');
      const tabT = document.getElementById('tabText');
      const tabR = document.getElementById('tabRaw');
      const boxH = document.getElementById('viewerHtmlContainer');
      const boxT = document.getElementById('viewerTextContainer');
      const boxR = document.getElementById('viewerRawContainer');

      [tabH, tabT, tabR].forEach(t => {
        t.className = 'pb-2 font-medium text-zinc-400 hover:text-zinc-200';
      });
      [boxH, boxT, boxR].forEach(b => b.classList.add('hidden'));

      if (tab === 'html') {
        tabH.className = 'pb-2 font-bold text-indigo-400 border-b-2 border-indigo-500';
        boxH.classList.remove('hidden');
      } else if (tab === 'text') {
        tabT.className = 'pb-2 font-bold text-indigo-400 border-b-2 border-indigo-500';
        boxT.classList.remove('hidden');
      } else if (tab === 'raw') {
        tabR.className = 'pb-2 font-bold text-indigo-400 border-b-2 border-indigo-500';
        boxR.classList.remove('hidden');
      }
    }

    function downloadCurrentEml() {
      if (!selectedEmail) return;
      const blob = new Blob([selectedEmail.rawMime || selectedEmail.text || ''], { type: 'message/rfc822' });
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
        closeEmailViewer();
        fetchEmails();
      } catch (e) {}
    }

    async function clearAllEmails() {
      if (currentEmails.length === 0) return;
      if (!confirm('Delete all messages in this inbox?')) return;
      try {
        await fetch('/api/emails?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' });
        fetchEmails();
      } catch (e) {}
    }

    // --- TEST SIMULATOR SENDER ---
    async function sendTestSimulator(preset = 'netflix') {
      try {
        const res = await fetch('/api/emails/test-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: currentEmail, preset })
        });
        if (res.ok) {
          fetchEmails();
        }
      } catch (e) {
        console.error(e);
      }
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
        closeEmailViewer();
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
