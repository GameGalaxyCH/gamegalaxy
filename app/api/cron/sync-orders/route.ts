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
// ⚠️ VITAL: Allow this route to run for up to 5 minutes (or more on VPS)
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

        // CALL THE MASTER FUNCTION
        const result = await runFullOrderSync(mode);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}