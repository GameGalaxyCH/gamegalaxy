import { NextResponse } from 'next/server';
import { runFullOrderSync, SyncMode } from '@/lib/shopify-bulk-orders';

/**
 * POST Handler for Cron Job Synchronization
 * * Usage: 
 * curl -X POST http://localhost:3000/api/cron/sync-orders \
 * -H "Authorization: Bearer <CRON_SECRET>" \
 * -H "Content-Type: application/json" \
 * -d '{"mode": "NIGHTLY_SYNC"}'
 * * Default Mode: 'NIGHTLY_SYNC' (last 48h) if no body is provided.
 */
export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const mode: SyncMode = body.mode || 'NIGHTLY_SYNC';

        console.log(`[Cron-Orders] Received Request. Mode: ${mode}`);

        // ⚡ FIRE AND FORGET ⚡
        runFullOrderSync(mode)
            .then((res) => console.log(`[Cron-Orders] Finished successfully:`, res))
            .catch((err) => console.error(`[Cron-Orders] Crashed in background:`, err));

        return NextResponse.json({ 
            success: true, 
            message: "Sync started in background. Check server logs for progress.",
            mode 
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}