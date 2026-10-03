import { NextRequest, NextResponse } from 'next/server';
import { saveEmail } from '@/lib/store';
import { extractOtp, extractVerificationLink } from '@/lib/utils';
import { EmailMessage } from '@/types/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Secret Header (if WEBHOOK_SECRET is set in environment)
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret) {
      const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
      const customHeader = request.headers.get('x-webhook-secret');
      const urlSecret = new URL(request.url).searchParams.get('secret');

      const providedSecret = authHeader || customHeader || urlSecret;

      if (!providedSecret || providedSecret !== expectedSecret) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing webhook secret' },
          { status: 401 }
        );
      }
    }

    // 2. Parse Incoming Payload
    const body = await request.json();

    const recipient = (body.to || body.recipient || '').toLowerCase().trim();
    if (!recipient) {
      return NextResponse.json(
        { error: 'Missing recipient "to" address' },
        { status: 400 }
      );
    }

    // Parse sender
    let fromAddress = 'unknown@sender.com';
    let fromName = '';

    if (typeof body.from === 'string') {
      // Could be "Name <email@domain.com>" or just "email@domain.com"
      const match = body.from.match(/(.*)<(.+)>/);
      if (match) {
        fromName = match[1].trim().replace(/^["']|["']$/g, '');
        fromAddress = match[2].trim();
      } else {
        fromAddress = body.from.trim();
      }
    } else if (body.from && typeof body.from === 'object') {
      fromAddress = body.from.address || fromAddress;
      fromName = body.from.name || '';
    }

    const subject = body.subject || '(No Subject)';
    const text = body.text || '';
    const html = body.html || (text ? `<pre style="font-family: inherit; white-space: pre-wrap;">${text}</pre>` : '');

    // Extract OTP & Verification links (searches subject, text, and html)
    const extractedOtp = extractOtp(subject, text, html);
    const extractedLink = extractVerificationLink(html, text);

    const email: EmailMessage = {
      id: 'eml_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      recipient,
      from: {
        name: fromName || undefined,
        address: fromAddress,
      },
      subject,
      text,
      html,
      receivedAt: new Date().toISOString(),
      read: false,
      size: (html.length || 0) + (text.length || 0),
      extractedOtp,
      extractedLink,
      attachments: body.attachments || [],
    };

    const saved = await saveEmail(email);

    return NextResponse.json({
      success: true,
      message: 'Email ingested successfully',
      id: saved.id,
      recipient: saved.recipient,
    });
  } catch (err: any) {
    console.error('Webhook error processing incoming email:', err);
    return NextResponse.json(
      { error: 'Failed to process email', details: err?.message },
      { status: 500 }
    );
  }
}
