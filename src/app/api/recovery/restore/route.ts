import { NextRequest, NextResponse } from 'next/server';
import { getAddressByRecoveryKey, getEmailsForRecipient } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recoveryKey = body.recoveryKey;

    if (!recoveryKey) {
      return NextResponse.json({ success: false, error: 'Please enter a valid Recovery Key.' }, { status: 400 });
    }

    const address = await getAddressByRecoveryKey(recoveryKey);
    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Recovery Key not found or expired. Please check and try again.',
      });
    }

    const emails = await getEmailsForRecipient(address);

    return NextResponse.json({
      success: true,
      address,
      recoveryKey: recoveryKey.toUpperCase().trim(),
      count: emails.length,
      emails,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
