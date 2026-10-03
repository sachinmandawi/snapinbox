import { NextRequest, NextResponse } from 'next/server';
import { getEmailsForRecipient, clearAllForRecipient } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Email address parameter is required' },
        { status: 400 }
      );
    }

    const emails = await getEmailsForRecipient(address);

    return NextResponse.json({
      success: true,
      address,
      count: emails.length,
      emails,
    });
  } catch (err: any) {
    console.error('Error fetching emails:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Email address parameter is required' },
        { status: 400 }
      );
    }

    const deletedCount = await clearAllForRecipient(address);
    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleared ${deletedCount} emails for ${address}`,
    });
  } catch (err: any) {
    console.error('Error clearing emails:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
