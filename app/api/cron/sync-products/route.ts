import { NextResponse } from 'next/server';
import { runFullProductSync, SyncMode } from '@/lib/shopify-bulk-products';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const mode: SyncMode = body.mode || 'NIGHTLY_SYNC';

        console.log(`[Cron] Received Product Sync Request: ${mode}`);

        // Call the new Master Function (Awaits completion)
        const result = await runFullProductSync(mode);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Cron] Product Sync Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}