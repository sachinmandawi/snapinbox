import { NextRequest, NextResponse } from 'next/server';
import { saveEmail } from '@/lib/store';
import { extractOtp, extractVerificationLink } from '@/lib/utils';
import { EmailMessage } from '@/types/email';

export const dynamic = 'force-dynamic';

const TEST_TEMPLATES = [
  {
    from: { name: 'Netflix Security', address: 'security@netflix.com' },
    subject: 'Your Netflix temporary access code',
    generateContent: (otp: string) => ({
      text: `Hi there,\n\nYour temporary access code is: ${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please disregard this email.\n\nHappy watching,\nThe Netflix Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #141414; color: #ffffff; border-radius: 8px;">
          <h1 style="color: #e50914; font-size: 28px; margin-bottom: 20px;">NETFLIX</h1>
          <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your temporary access code</h2>
          <p style="color: #cccccc; font-size: 15px; line-height: 1.5;">Please use the following 6-digit code to complete your login:</p>
          <div style="background-color: #222222; border: 1px solid #333333; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffffff;">${otp}</span>
          </div>
          <p style="color: #888888; font-size: 13px; line-height: 1.4;">This code is valid for 15 minutes. If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #333333; margin: 24px 0;" />
          <p style="color: #555555; font-size: 11px;">Netflix International B.V.</p>
        </div>
      `,
    }),
  },
  {
    from: { name: 'GitHub', address: 'noreply@github.com' },
    subject: '[GitHub] Please verify your email address',
    generateContent: (otp: string) => {
      const link = `https://github.com/verify?token=gho_${Math.random().toString(36).substring(2, 15)}&code=${otp}`;
      return {
        text: `Hey!\n\nWe received a request to verify your email for GitHub. Your one-time verification code is ${otp}.\n\nOr click here to verify:\n${link}\n\nThanks,\nThe GitHub Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background-color: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 8px;">
            <div style="margin-bottom: 20px;">
              <svg height="32" viewBox="0 0 16 16" width="32" style="fill: #ffffff;"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9 1.01 1.24.41.5 1.54.43 2.05.35 0 .68.01 1.25.01 1.44 0 .21-.15.46-.55.38A8.013 8.013 0 0 1 0 8c0-4.42 3.58-8 8-8z"></path></svg>
            </div>
            <h2 style="font-size: 22px; font-weight: 600; color: #f0f6fc; margin-bottom: 12px;">Verify your email address</h2>
            <p style="font-size: 15px; color: #8b949e; line-height: 1.6;">Here is your GitHub verification code:</p>
            <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 5px; color: #58a6ff;">${otp}</span>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="display: inline-block; background-color: #238636; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Verify Email Address</a>
            </div>
            <p style="font-size: 13px; color: #8b949e;">If you didn't request this code, someone may have entered your email by mistake.</p>
          </div>
        `,
      };
    },
  },
  {
    from: { name: 'Google Accounts', address: 'no-reply@accounts.google.com' },
    subject: 'Google Verification Code',
    generateContent: (otp: string) => ({
      text: `G-${otp} is your Google verification code. Never share this code with anyone.`,
      html: `
        <div style="font-family: 'Google Sans', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #dadce0; border-radius: 8px;">
          <h2 style="color: #202124; font-size: 20px; margin-bottom: 16px;">Verify your identity</h2>
          <p style="color: #3c4043; font-size: 14px; line-height: 1.5;">Use this code to verify your Google Account:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 4px; color: #1a73e8; margin: 20px 0;">
            G-${otp}
          </div>
          <p style="color: #5f6368; font-size: 13px;">This code expires in 10 minutes. Google will never call or email you asking for this code.</p>
        </div>
      `,
    }),
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recipient = body.recipient;

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient email address is required' },
        { status: 400 }
      );
    }

    const templateIndex = Math.floor(Math.random() * TEST_TEMPLATES.length);
    const template = TEST_TEMPLATES[templateIndex];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const content = template.generateContent(otp);

    const email: EmailMessage = {
      id: 'test_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      recipient: recipient.toLowerCase().trim(),
      from: template.from,
      subject: template.subject,
      text: content.text,
      html: content.html,
      receivedAt: new Date().toISOString(),
      read: false,
      size: (content.html?.length || 0) + (content.text?.length || 0),
      extractedOtp: otp,
      extractedLink: extractVerificationLink(content.html, content.text),
    };

    const saved = await saveEmail(email);

    return NextResponse.json({
      success: true,
      message: 'Test email created successfully',
      email: saved,
    });
  } catch (err: any) {
    console.error('Error generating test email:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}
