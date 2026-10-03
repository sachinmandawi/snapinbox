# 🚀 Mendoneet Mail - Disposable Temp Mail Service

Temporary disposable email service built for **`mendoneet.me`**.

---

## ✨ Features

- ⚡ **Auto-generated Disposable Email**: Instant anonymous email address on `@mendoneet.me`.
- 🎯 **Custom Aliases**: Choose your own custom address prefix (e.g. `alex@mendoneet.me`).
- 🔑 **Automatic OTP & Link Detection**: Extracts 4-8 digit verification codes and activation links directly into quick-action banners.
- 📬 **Live Inbox Polling**: Real-time auto-refresh every 4s with subtle audio chime notifications.
- 🛡️ **Sandboxed HTML Viewer**: Safely renders rich HTML emails inside a sandboxed frame without tracking or XSS risk.
- 📱 **QR Code**: Scan on mobile to quickly copy or send to the disposable address.
- 🧪 **Instant Test Email Simulator**: Built-in button to simulate incoming Netflix, GitHub, or Google verification emails locally.
- ☁️ **100% Free Cloudflare Email Routing Integration**: No VPS or paid SMTP service needed.

---

## 🛠️ Quick Start (Local Development)

```bash
# 1. Install dependencies (already installed)
npm install

# 2. Run local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Click **"Simulate Test Email"** in the UI to instantly verify that emails, OTP codes, and HTML formatting work seamlessly!

---

## 🌐 Namecheap & Cloudflare Setup (Step-by-Step)

### Step 1: Connect Namecheap to Cloudflare (Free DNS)
1. Go to [Cloudflare.com](https://dash.cloudflare.com) and log in.
2. Click **"Add a Site"** &rarr; enter `mendoneet.me` &rarr; choose the **Free** tier.
3. Cloudflare will give you **2 Nameservers** (e.g. `alex.ns.cloudflare.com` and `beth.ns.cloudflare.com`).
4. Now open [Namecheap Dashboard](https://ap.www.namecheap.com):
   - Go to **Domain List** &rarr; Click **Manage** next to `mendoneet.me`.
   - In the **Nameservers** section, change the dropdown from **Namecheap BasicDNS** to **Custom DNS**.
   - Paste Cloudflare's two nameservers into the boxes and click the green checkmark (✔) to save.

---

### Step 2: Enable Free Email Routing on Cloudflare
1. In the Cloudflare dashboard, select `mendoneet.me`.
2. On the left sidebar, navigate to **Email** &rarr; **Email Routing**.
3. Click **"Get Started"** / **"Enable Email Routing"**.
4. Cloudflare will automatically display the required **MX records** and **TXT (SPF) record**. Click **"Add records automatically"** to let Cloudflare configure them instantly.

---

### Step 3: Deploy Website & Create Cloudflare Worker
1. Deploy this website to **Vercel** (or Render / Railway / your VPS):
   - Push this repo to GitHub.
   - Import to Vercel (Free plan).
   - Set environment variable:
     - `NEXT_PUBLIC_APP_DOMAIN`: `mendoneet.me`
     - `WEBHOOK_SECRET`: `your_custom_secret_key`
2. In Cloudflare, go to **Workers & Pages** &rarr; **Create application** &rarr; **Create Worker**.
3. Name it `mendoneet-email-worker` and click **Deploy**.
4. Click **Quick Edit** and paste the code from [`cloudflare-worker/worker.js`](./cloudflare-worker/worker.js).
5. Update `WEBHOOK_URL` in the worker to:
   ```
   https://your-site.vercel.app/api/webhook/incoming
   ```
6. Save and deploy.
7. Return to `mendoneet.me` &rarr; **Email** &rarr; **Email Routing** &rarr; **Routing Rules**.
8. In the **Catch-all rule** section:
   - Action: **Send to Worker**
   - Destination: Select `mendoneet-email-worker`.
   - Save.

🎉 **All emails sent to `*@mendoneet.me` will now automatically appear in real-time on your Temp Mail website!**
