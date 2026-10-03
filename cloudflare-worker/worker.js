/**
 * Cloudflare Email Worker for Mendoneet Mail
 * 
 * Automatically receives emails sent to *@mendoneet.me via Cloudflare Email Routing
 * and forwards them to your Mendoneet Mail web application.
 */

// Configure your target website URL (e.g., https://your-site.vercel.app or your custom domain)
const WEBHOOK_URL = "https://YOUR_WEBSITE_DOMAIN.vercel.app/api/webhook/incoming";

// Keep this in sync with WEBHOOK_SECRET in your .env.local
const WEBHOOK_SECRET = "mendoneet_secret_key_change_me_123";

export default {
  async email(message, env, ctx) {
    try {
      const recipient = message.to;
      const sender = message.from;
      const subject = message.headers.get("subject") || "(No Subject)";
      
      // Read raw email content
      const rawText = await new Response(message.raw).text();

      // Extract basic body text / html from MIME message
      let bodyText = "";
      let bodyHtml = "";

      // Simple MIME multipart parser
      const contentType = message.headers.get("content-type") || "";
      const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);

      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = rawText.split(`--${boundary}`);
        
        for (const part of parts) {
          if (part.includes("text/html")) {
            const htmlContent = part.split(/\r?\n\r?\n/)[1] || "";
            bodyHtml = htmlContent.trim();
          } else if (part.includes("text/plain")) {
            const textContent = part.split(/\r?\n\r?\n/)[1] || "";
            bodyText = textContent.trim();
          }
        }
      }

      // Fallback if not multipart
      if (!bodyText && !bodyHtml) {
        const bodySplit = rawText.split(/\r?\n\r?\n/);
        bodyText = bodySplit.slice(1).join("\n\n").trim();
      }

      const payload = {
        to: recipient,
        from: sender,
        subject: subject,
        text: bodyText || rawText.substring(0, 5000),
        html: bodyHtml || "",
      };

      const webhookTarget = env?.WEBHOOK_URL || WEBHOOK_URL;
      const secret = env?.WEBHOOK_SECRET || WEBHOOK_SECRET;

      // Post to website webhook
      const response = await fetch(webhookTarget, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook error: ${response.status} ${await response.text()}`);
      }
    } catch (err) {
      console.error("Error processing email in Cloudflare Worker:", err);
    }
  },
};
