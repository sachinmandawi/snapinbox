/**
 * SnapInbox - Complete 100% Pixel-Perfect Cloudflare Worker
 * 
 * Contains the EXACT identical UI, features, modals, animations, tabs,
 * and email engine as the local Next.js application!
 */

// Global in-memory cache
const memoryStore = new Map();

// Helper: Extract OTP from subject/body
function extractOtp(subject, body) {
  const fullText = `${subject || ''} ${body || ''}`;
  const patterns = [
    /(?:code|otp|pin|token|verification|password|login)\s*(?:is|:|-|=)?\s*([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/,
    /\b([0-9]{4})\b/
  ];
  for (const regex of patterns) {
    const match = fullText.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Helper: Extract action link
function extractLink(text, html) {
  const content = `${html || ''} ${text || ''}`;
  const match = content.match(/https?:\/\/[^\s<>"']+(?:verify|confirm|activate|token)[^\s<>"']*/i);
  return match ? match[0] : null;
}

// Storage helpers: Works with Cloudflare KV (if bound) or Cache API fallback
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
  // 1. INBOUND EMAIL HANDLER (Cloudflare Email Routing)
  async email(message, env, ctx) {
    try {
      const recipient = message.to.toLowerCase().trim();
      const sender = message.from;
      const subject = message.headers.get("subject") || "(No Subject)";
      const rawText = await new Response(message.raw).text();

      // MIME Multipart parsing
      let bodyText = "";
      let bodyHtml = "";

      const contentType = message.headers.get("content-type") || "";
      const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);

      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = rawText.split(`--${boundary}`);
        for (const part of parts) {
          if (part.includes("text/html")) {
            const split = part.split(/\r?\n\r?\n/);
            bodyHtml = split.slice(1).join("\n\n").trim();
          } else if (part.includes("text/plain")) {
            const split = part.split(/\r?\n\r?\n/);
            bodyText = split.slice(1).join("\n\n").trim();
          }
        }
      }

      if (!bodyText && !bodyHtml) {
        bodyText = rawText.substring(0, 8000);
      }

      // Clean sender name
      let senderName = "";
      let senderAddress = sender;
      const nameMatch = sender.match(/(.*)<(.+)>/);
      if (nameMatch) {
        senderName = nameMatch[1].trim().replace(/^["']|["']$/g, "");
        senderAddress = nameMatch[2].trim();
      }

      const emailObj = {
        id: "eml_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        recipient,
        from: { address: senderAddress, name: senderName || undefined },
        subject,
        text: bodyText || "No plain text content available.",
        html: bodyHtml || `<pre style="font-family: inherit; white-space: pre-wrap; padding: 16px;">${bodyText}</pre>`,
        receivedAt: new Date().toISOString(),
        read: false,
        size: (bodyHtml.length || 0) + (bodyText.length || 0),
        extractedOtp: extractOtp(subject, bodyText || bodyHtml),
        extractedLink: extractLink(bodyText, bodyHtml)
      };

      const existing = await getEmails(recipient, env);
      existing.unshift(emailObj);
      await saveEmails(recipient, existing.slice(0, 30), env);
    } catch (err) {
      console.error("Worker inbound email error:", err);
    }
  },

  // 2. HTTP FETCHER (Website & API Handler)
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

    // API: TEST SEND (Simulate incoming email)
    if (url.pathname === "/api/emails/test-send" && request.method === "POST") {
      try {
        const body = await request.json();
        const recipient = (body.recipient || "").toLowerCase().trim();
        if (!recipient) return new Response(JSON.stringify({ error: "Missing recipient" }), { status: 400 });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const testTemplates = [
          {
            from: { name: "Netflix Security", address: "security@netflix.com" },
            subject: "Your Netflix temporary access code",
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #141414; color: #ffffff; border-radius: 8px;">
              <h1 style="color: #e50914; font-size: 28px; margin: 0 0 20px 0;">NETFLIX</h1>
              <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your temporary access code</h2>
              <p style="color: #cccccc; font-size: 15px; line-height: 1.5;">Please use the following 6-digit code to complete your login:</p>
              <div style="background-color: #222222; border: 1px solid #333333; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffffff;">${otp}</span>
              </div>
              <p style="color: #888888; font-size: 13px;">This code is valid for 15 minutes. If you didn't request this code, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #333333; margin: 24px 0;" />
              <p style="color: #555555; font-size: 11px;">Netflix International B.V.</p>
            </div>`,
            text: `Hi there,\n\nYour temporary access code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nHappy watching,\nThe Netflix Team`
          },
          {
            from: { name: "GitHub", address: "noreply@github.com" },
            subject: "[GitHub] Please verify your email address",
            html: `<div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background-color: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 8px;">
              <h2 style="font-size: 22px; font-weight: 600; color: #f0f6fc; margin-bottom: 12px;">Verify your email address</h2>
              <p style="font-size: 15px; color: #8b949e; line-height: 1.6;">Here is your GitHub one-time verification code:</p>
              <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 5px; color: #58a6ff;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #8b949e;">If you didn't request this code, someone may have entered your email by mistake.</p>
            </div>`,
            text: `Hey!\n\nYour one-time verification code is ${otp}.\n\nThanks,\nThe GitHub Team`
          }
        ];

        const t = testTemplates[Math.floor(Math.random() * testTemplates.length)];
        const testEmail = {
          id: "test_" + Date.now().toString(36),
          recipient,
          from: t.from,
          subject: t.subject,
          text: t.text,
          html: t.html,
          receivedAt: new Date().toISOString(),
          read: false,
          size: t.html.length,
          extractedOtp: otp,
          extractedLink: extractLink(t.text, t.html)
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

    // SERVE FULL FRONTEND HTML
    return new Response(getFullAppHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

function getFullAppHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>SnapInbox - Free Disposable Temporary Email</title>
  <meta name="description" content="Instant, anonymous temporary disposable email service powered by SnapInbox on mendoneet.me. Protect your personal inbox from spam.">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 50: '#eef2ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
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
          <p class="text-xs text-slate-400 hidden sm:block">Free disposable temporary email generator</p>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <button onclick="openSetupModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition shadow-sm">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          <span>DNS Setup</span>
        </button>
        <div class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="hidden md:inline">Auto-Sync Active</span>
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
          <span class="text-xs uppercase font-bold tracking-wider text-slate-400">Your Disposable Email Address</span>
          <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">Catch-All Enabled</span>
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
          <span id="copyHint" class="text-xs font-medium text-indigo-400 group-hover:text-indigo-300 shrink-0 ml-2">Click to copy</span>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="copyEmail()" id="copyBtn" class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition">
            <span>Copy</span>
          </button>
          <button onclick="fetchEmails(true)" title="Refresh inbox" class="flex items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            <svg id="refreshIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      <!-- Action Row -->
      <div class="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="randomizeEmail()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>🎲 Randomize</span>
          </button>
          <button onclick="openCustomModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>✏️ Custom Name</span>
          </button>
          <button onclick="openQrModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition">
            <span>📱 QR Code</span>
          </button>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <button onclick="sendTestEmail()" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 text-amber-300 border border-amber-500/30 transition shadow-sm font-medium">
            <span>⚡ Simulate Test Email</span>
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
            <span>REAL-TIME LIVE</span>
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
            <p class="text-xs text-slate-500 mt-1">Select an email from the inbox list to read its content.</p>
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
          <p class="text-[11px] text-slate-400 mt-0.5">No registration, password, or IP tracking. Protects your real email from spam.</p>
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
          <h4 class="text-xs font-semibold text-white">Auto-Expiring Clean Storage</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Temporary inboxes auto-expire safely so no sensitive messages remain.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/80 bg-[#070b13] py-6 text-center text-xs text-slate-500">
    <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p>&copy; 2026 <strong class="text-slate-400">SnapInbox</strong>. Powered by <code class="text-indigo-400 font-mono">@mendoneet.me</code></p>
      <div class="flex items-center gap-4">
        <button onclick="openSetupModal()" class="text-slate-400 hover:text-indigo-300 transition">Domain Setup Guide</button>
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

  <!-- Modal: Setup Guide -->
  <div id="setupModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
      <button onclick="closeSetupModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
      <h3 class="text-lg font-bold text-white mb-2">Cloudflare Email Routing Status</h3>
      <p class="text-xs text-slate-400 mb-4">Incoming emails sent to <code class="text-indigo-300 font-mono">*@mendoneet.me</code> are routed directly to this Worker.</p>
      <div class="space-y-3 text-xs text-slate-300 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>✅ <strong>MX Records:</strong> Pointed to Cloudflare Email Routing</div>
        <div>✅ <strong>Catch-all Rule:</strong> Active &rarr; Send to mendoneet-worker</div>
        <div>✅ <strong>Worker Domain:</strong> Attached to mendoneet.me</div>
      </div>
      <button onclick="closeSetupModal()" class="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">Got It</button>
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

    function generateRandomEmail() {
      const adjs = ['swift', 'hyper', 'cyber', 'nova', 'echo', 'frost', 'pixel', 'sonic', 'dark', 'alpha', 'quiet', 'brave'];
      const nouns = ['fox', 'rider', 'falcon', 'ghost', 'tiger', 'ninja', 'comet', 'wolf', 'hawk', 'storm', 'spark', 'orbit'];
      const num = Math.floor(100 + Math.random() * 900);
      const email = adjs[Math.floor(Math.random() * adjs.length)] + '.' + nouns[Math.floor(Math.random() * nouns.length)] + num + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', email);
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

    function updateEmailUI() {
      document.getElementById('emailDisplay').innerText = currentEmail;
      fetchEmails();
    }

    function copyEmail() {
      navigator.clipboard.writeText(currentEmail);
      document.getElementById('copyHint').innerText = 'Copied!';
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.35 } });
      setTimeout(() => { document.getElementById('copyHint').innerText = 'Click to copy'; }, 2000);
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

    function openSetupModal() { document.getElementById('setupModal').classList.remove('hidden'); }
    function closeSetupModal() { document.getElementById('setupModal').classList.add('hidden'); }

    // Fetch Emails
    async function fetchEmails(isManual = false) {
      if (isManual) document.getElementById('refreshIcon').classList.add('animate-spin');
      try {
        const res = await fetch('/api/emails?address=' + encodeURIComponent(currentEmail));
        const data = await res.json();
        const emails = data.emails || [];
        if (emails.length > currentEmails.length) playChime();
        renderEmails(emails);
      } catch (e) {
        console.error(e);
      } finally {
        if (isManual) setTimeout(() => document.getElementById('refreshIcon').classList.remove('animate-spin'), 400);
      }
    }

    function renderEmails(emails) {
      currentEmails = emails;
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
            \${e.extractedOtp ? \`<span class="inline-block mt-1 text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">🔑 OTP: \${e.extractedOtp}</span>\` : ''}
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
          \${email.extractedOtp ? \`
            <div class="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span class="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block">Verification Code Detected</span>
                <span class="font-mono text-xl font-bold tracking-widest text-emerald-300">\${email.extractedOtp}</span>
              </div>
              <button onclick="navigator.clipboard.writeText('\${email.extractedOtp}'); alert('Code copied: ' + '\${email.extractedOtp}');" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">Copy Code</button>
            </div>
          \` : ''}
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
        return \`<div class="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">\${JSON.stringify(email, null, 2)}</div>\`;
      }
      return \`<div class="w-full h-full min-h-[360px] bg-white rounded-xl overflow-hidden shadow-inner"><iframe srcdoc="\${email.html.replace(/"/g, '&quot;')}" class="w-full h-full min-h-[360px] border-0"></iframe></div>\`;
    }

    async function sendTestEmail() {
      await fetch('/api/emails/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: currentEmail })
      });
      fetchEmails();
    }

    async function deleteEmail(id) {
      await fetch('/api/emails?address=' + encodeURIComponent(currentEmail) + '&id=' + id, { method: 'DELETE' });
      selectedEmailId = null;
      fetchEmails();
    }

    async function deleteAllEmails() {
      if (!confirm('Delete all emails in this temporary inbox?')) return;
      await fetch('/api/emails?address=' + encodeURIComponent(currentEmail), { method: 'DELETE' });
      selectedEmailId = null;
      fetchEmails();
    }

    // Timer
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
    setInterval(fetchEmails, 4000);
  </script>
</body>
</html>`;
}
