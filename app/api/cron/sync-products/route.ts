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

        console.log(`[Cron-Products] Received Request. Mode: ${mode}`);

        // ⚡ FIRE AND FORGET ⚡
        runFullProductSync(mode)
            .then((res) => console.log(`[Cron-Products] Finished successfully:`, res))
            .catch((err) => console.error(`[Cron-Products] Crashed in background:`, err));

        return NextResponse.json({ 
            success: true, 
            message: "Sync started in background. Check server logs for progress.",
            mode 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}