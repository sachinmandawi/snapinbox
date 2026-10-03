# 🚀 SnapInbox - Free Disposable Temporary Email Service

Modern, privacy-focused temporary disposable email service powered by **`mendoneet.me`**.

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
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Live Deployment

### Deploy to Vercel (Recommended - 1 Click)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import repository **`sachinmandawi/snapinbox`**.
3. In Environment Variables, set:
   - `NEXT_PUBLIC_APP_DOMAIN` = `mendoneet.me`
   - `WEBHOOK_SECRET` = `mendoneet_secret_key_change_me_123`
4. Click **Deploy**.
5. In Project Settings &rarr; Domains &rarr; Add **`mendoneet.me`**.
6. In Cloudflare DNS, add an `A` record pointing `@` to `76.76.21.21` (DNS only).

🎉 Your disposable email website is now fully live on **`https://mendoneet.me`**!
