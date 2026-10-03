/**
 * SnapInbox - Complete All-in-One Cloudflare Worker
 * 
 * Runs 100% on Cloudflare (No Vercel, No external hosting needed!).
 * Serves the modern SnapInbox frontend, handles APIs, and intercepts emails via Catch-All!
 */

// In-memory email store fallback (or bound KV: env.SNAPINBOX_KV)
const emailCache = new Map();

// Helper: Extract OTP from text
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

export default {
  // 1. Intercept incoming emails via Cloudflare Email Routing
  async email(message, env, ctx) {
    try {
      const recipient = message.to.toLowerCase().trim();
      const sender = message.from;
      const subject = message.headers.get("subject") || "(No Subject)";
      const rawText = await new Response(message.raw).text();

      // Extract basic body text
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
        bodyText = rawText.substring(0, 5000);
      }

      const emailObj = {
        id: "eml_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        recipient,
        from: { address: sender, name: sender.split("<")[0].replace(/["']/g, "").trim() },
        subject,
        text: bodyText || "No plain text content",
        html: bodyHtml || `<pre style="font-family: inherit; white-space: pre-wrap;">${bodyText}</pre>`,
        receivedAt: new Date().toISOString(),
        read: false,
        extractedOtp: extractOtp(subject, bodyText || bodyHtml),
        extractedLink: extractLink(bodyText, bodyHtml)
      };

      // Store in Cloudflare KV if bound, else in memory
      if (env.SNAPINBOX_KV) {
        const existing = await env.SNAPINBOX_KV.get(recipient, { type: "json" }) || [];
        existing.unshift(emailObj);
        // Keep max 25 emails per address, 2 hour TTL
        await env.SNAPINBOX_KV.put(recipient, JSON.stringify(existing.slice(0, 25)), { expirationTtl: 7200 });
      } else {
        const existing = emailCache.get(recipient) || [];
        existing.unshift(emailObj);
        emailCache.set(recipient, existing.slice(0, 25));
      }
    } catch (err) {
      console.error("Email handling error:", err);
    }
  },

  // 2. Serve Frontend & APIs via HTTP
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API: GET emails for an address
    if (url.pathname === "/api/emails" && request.method === "GET") {
      const address = (url.searchParams.get("address") || "").toLowerCase().trim();
      let emails = [];
      if (address) {
        if (env.SNAPINBOX_KV) {
          emails = await env.SNAPINBOX_KV.get(address, { type: "json" }) || [];
        } else {
          emails = emailCache.get(address) || [];
        }
      }
      return new Response(JSON.stringify({ success: true, address, count: emails.length, emails }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // API: DELETE email or clear inbox
    if (url.pathname === "/api/emails" && request.method === "DELETE") {
      const address = (url.searchParams.get("address") || "").toLowerCase().trim();
      const id = url.searchParams.get("id");

      if (env.SNAPINBOX_KV && address) {
        if (id) {
          let emails = await env.SNAPINBOX_KV.get(address, { type: "json" }) || [];
          emails = emails.filter(e => e.id !== id);
          await env.SNAPINBOX_KV.put(address, JSON.stringify(emails), { expirationTtl: 7200 });
        } else {
          await env.SNAPINBOX_KV.delete(address);
        }
      } else if (address) {
        if (id) {
          let emails = emailCache.get(address) || [];
          emails = emails.filter(e => e.id !== id);
          emailCache.set(address, emails);
        } else {
          emailCache.delete(address);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // API: Simulate Test Email
    if (url.pathname === "/api/emails/test-send" && request.method === "POST") {
      try {
        const body = await request.json();
        const recipient = (body.recipient || "").toLowerCase().trim();
        if (!recipient) return new Response(JSON.stringify({ error: "No recipient" }), { status: 400 });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const testEmail = {
          id: "test_" + Date.now().toString(36),
          recipient,
          from: { name: "Netflix Security", address: "security@netflix.com" },
          subject: "Your Netflix temporary access code",
          text: `Your temporary Netflix verification code is: ${otp}\nValid for 15 minutes.`,
          html: `<div style="font-family: -apple-system, sans-serif; background:#141414; color:#fff; padding:24px; border-radius:8px; max-width:550px; margin:0 auto;">
            <h1 style="color:#e50914; font-size:26px; margin:0 0 16px 0;">NETFLIX</h1>
            <p style="color:#ccc; font-size:15px;">Your temporary sign-in code:</p>
            <div style="background:#222; padding:18px; border-radius:6px; font-size:32px; font-weight:bold; letter-spacing:6px; text-align:center; margin:16px 0; border:1px solid #333;">${otp}</div>
            <p style="color:#888; font-size:12px;">If you did not request this, please ignore this email.</p>
          </div>`,
          receivedAt: new Date().toISOString(),
          read: false,
          extractedOtp: otp
        };

        if (env.SNAPINBOX_KV) {
          const existing = await env.SNAPINBOX_KV.get(recipient, { type: "json" }) || [];
          existing.unshift(testEmail);
          await env.SNAPINBOX_KV.put(recipient, JSON.stringify(existing.slice(0, 25)), { expirationTtl: 7200 });
        } else {
          const existing = emailCache.get(recipient) || [];
          existing.unshift(testEmail);
          emailCache.set(recipient, existing.slice(0, 25));
        }

        return new Response(JSON.stringify({ success: true, email: testEmail }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // Serve HTML Web App
    return new Response(getHtmlPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SnapInbox - Free Disposable Temporary Email</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: { brand: { 500: '#6366f1', 600: '#4f46e5' } }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .radar { animation: radar-pulse 2s infinite; }
    @keyframes radar-pulse {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); }
      70% { box-shadow: 0 0 0 16px rgba(99, 102, 241, 0); }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-slate-800 bg-[#0c1222]/90 backdrop-blur sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </div>
        <div>
          <span class="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">Snap<span class="text-indigo-400">Inbox</span></span>
          <span class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">@mendoneet.me</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="flex h-2 w-2 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="text-xs text-emerald-400 font-medium">Cloudflare Native ⚡</span>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
    <!-- Email Bar Box -->
    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <span class="uppercase font-bold tracking-wider text-slate-400">Your Temporary Email Address</span>
        <span id="expiryTimer" class="font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">Expires in 60:00</span>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div onclick="copyEmail()" class="flex-1 flex items-center justify-between bg-[#0a0f1d] border border-indigo-500/30 hover:border-indigo-400 rounded-xl px-4 py-3 cursor-pointer group transition">
          <span id="emailDisplay" class="font-mono text-lg sm:text-xl font-bold tracking-wide text-white truncate">loading@mendoneet.me</span>
          <span id="copyHint" class="text-xs text-indigo-400 group-hover:text-indigo-300 ml-2">Click to copy</span>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="copyEmail()" id="copyBtn" class="flex-1 sm:flex-none px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition">Copy</button>
          <button onclick="fetchEmails(true)" title="Refresh" class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            <svg id="refreshIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <button onclick="randomizeEmail()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">🎲 Randomize</button>
          <button onclick="customEmailPrompt()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">✏️ Custom Alias</button>
        </div>
        <button onclick="sendTestEmail()" class="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium transition">⚡ Simulate Test Email</button>
      </div>
    </div>

    <!-- Inbox Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- List Column -->
      <div class="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div class="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between text-xs font-semibold text-slate-400">
          <span id="inboxCount">INBOX (0)</span>
          <span>REAL-TIME</span>
        </div>
        <div id="emailList" class="divide-y divide-slate-800 max-h-[550px] overflow-y-auto">
          <!-- Dynamic emails or empty state -->
        </div>
      </div>

      <!-- Viewer Column -->
      <div class="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl min-h-[550px] flex flex-col" id="emailViewer">
        <div class="p-12 text-center flex-1 flex flex-col items-center justify-center text-slate-500">
          <svg class="w-12 h-12 mb-3 text-slate-600 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <h4 class="text-base font-medium text-slate-300">No email selected</h4>
          <p class="text-xs text-slate-500 mt-1">Incoming emails will appear in the inbox on the left.</p>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800 bg-[#070b13] py-5 text-center text-xs text-slate-500">
    &copy; 2026 SnapInbox. Powered by Cloudflare & mendoneet.me
  </footer>

  <script>
    const DOMAIN = 'mendoneet.me';
    let currentEmail = localStorage.getItem('snapinbox_email') || generateRandomEmail();
    let currentEmails = [];
    let selectedEmailId = null;

    function generateRandomEmail() {
      const words = ['swift', 'hyper', 'cyber', 'nova', 'echo', 'frost', 'pixel', 'sonic'];
      const nouns = ['fox', 'rider', 'falcon', 'ghost', 'tiger', 'ninja', 'comet', 'wolf'];
      const num = Math.floor(100 + Math.random() * 900);
      const email = words[Math.floor(Math.random() * words.length)] + '.' + nouns[Math.floor(Math.random() * nouns.length)] + num + '@' + DOMAIN;
      localStorage.setItem('snapinbox_email', email);
      return email;
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

    function customEmailPrompt() {
      const custom = prompt('Enter your custom alias (e.g. alex):');
      if (custom) {
        const clean = custom.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (clean.length >= 3) {
          currentEmail = clean + '@' + DOMAIN;
          localStorage.setItem('snapinbox_email', currentEmail);
          selectedEmailId = null;
          updateEmailUI();
        } else {
          alert('Alias must be at least 3 characters long.');
        }
      }
    }

    async function fetchEmails(isManual = false) {
      if (isManual) document.getElementById('refreshIcon').classList.add('animate-spin');
      try {
        const res = await fetch('/api/emails?address=' + encodeURIComponent(currentEmail));
        const data = await res.json();
        const emails = data.emails || [];
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
          <div class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 radar flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            </div>
            <h4 class="text-sm font-semibold text-slate-200">Listening for incoming emails...</h4>
            <p class="text-xs text-slate-400 mt-1">Send an email to <span class="font-mono text-indigo-300 font-bold">\${currentEmail}</span></p>
          </div>
        \`;
        return;
      }

      listEl.innerHTML = emails.map(e => \`
        <div onclick="selectEmail('\${e.id}')" class="p-4 cursor-pointer hover:bg-slate-800/50 transition border-l-4 \${e.id === selectedEmailId ? 'bg-indigo-950/40 border-indigo-500' : 'border-transparent'}">
          <div class="flex justify-between items-start mb-1">
            <span class="text-sm font-semibold text-white truncate">\${e.from.name || e.from.address}</span>
            <span class="text-[11px] text-slate-500 font-mono">\${new Date(e.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          <h5 class="text-xs font-medium text-indigo-200 truncate mb-1">\${e.subject || '(No Subject)'}</h5>
          \${e.extractedOtp ? \`<span class="inline-block mt-1 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">🔑 OTP: \${e.extractedOtp}</span>\` : ''}
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
        <div class="p-6 border-b border-slate-800 bg-slate-900/60">
          <div class="flex justify-between items-start gap-4 mb-3">
            <h2 class="text-lg font-bold text-white">\${email.subject}</h2>
            <button onclick="deleteEmail('\${email.id}')" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
          <div class="text-xs text-slate-400 space-y-1">
            <div><strong class="text-slate-300">From:</strong> \${email.from.name ? email.from.name + ' ' : ''}&lt;\${email.from.address}&gt;</div>
            <div><strong class="text-slate-300">To:</strong> \${email.recipient}</div>
            <div><strong class="text-slate-300">Date:</strong> \${new Date(email.receivedAt).toLocaleString()}</div>
          </div>
          \${email.extractedOtp ? \`
            <div class="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase font-bold text-emerald-400 block">Verification Code Detected</span>
                <span class="font-mono text-xl font-bold tracking-widest text-emerald-300">\${email.extractedOtp}</span>
              </div>
              <button onclick="navigator.clipboard.writeText('\${email.extractedOtp}'); alert('Code copied!');" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">Copy Code</button>
            </div>
          \` : ''}
        </div>
        <div class="flex-1 p-4 bg-white rounded-b-2xl overflow-hidden min-h-[350px]">
          <iframe srcdoc="\${email.html.replace(/"/g, '&quot;')}" class="w-full h-full min-h-[350px] border-0"></iframe>
        </div>
      \`;
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

    // Auto-polling every 4s
    updateEmailUI();
    setInterval(fetchEmails, 4000);
  </script>
</body>
</html>`;
}
