import { NextRequest, NextResponse } from 'next/server';
import { saveRecoveryKey } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = body.address;
    const recoveryKey = body.recoveryKey;

    if (!address || !recoveryKey) {
      return NextResponse.json({ error: 'Missing address or recoveryKey' }, { status: 400 });
    }

    await saveRecoveryKey(recoveryKey, address);

    return NextResponse.json({
      success: true,
      recoveryKey: recoveryKey.toUpperCase().trim(),
      address: address.toLowerCase().trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
