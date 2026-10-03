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
    const id = searchParams.get('id');

    if (!address) {
      return NextResponse.json(
        { error: 'Email address parameter is required' },
        { status: 400 }
      );
    }

    // If specific email id provided, delete just that email (matching Worker API)
    if (id) {
      const { deleteEmail } = await import('@/lib/store');
      const deleted = await deleteEmail(id);
      return NextResponse.json({
        success: true,
        deleted,
        message: deleted ? `Email ${id} deleted` : `Email ${id} not found`,
      });
    }

    // Otherwise clear all emails for this address
    const deletedCount = await clearAllForRecipient(address);
    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleared ${deletedCount} emails for ${address}`,
    });
  } catch (err: any) {
    console.error('Error clearing/deleting emails:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}
