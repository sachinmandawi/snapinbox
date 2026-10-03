import { NextRequest, NextResponse } from 'next/server';
import { getEmailById, markAsRead, deleteEmail } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const email = await getEmailById(id);

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Mark as read when fetched
    await markAsRead(id);

    return NextResponse.json({
      success: true,
      email: { ...email, read: true },
    });
  } catch (err: any) {
    console.error('Error fetching email details:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const success = await deleteEmail(id);

    if (!success) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Email deleted successfully',
    });
  } catch (err: any) {
    console.error('Error deleting email:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}
