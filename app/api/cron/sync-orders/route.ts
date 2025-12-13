import { NextResponse } from 'next/server';
import { startBulkOrderSync, checkBulkStatus, processBulkFile, SyncMode } from '@/app/actions/bulk-orders';

/**
 * POST Handler for Cron Job Synchronization
 * * Usage: 
 * curl -X POST http://localhost:3000/api/cron/sync-orders \
 * -H "Authorization: Bearer <CRON_SECRET>" \
 * -H "Content-Type: application/json" \
 * -d '{"mode": "NIGHTLY_SYNC"}'
 * * Default Mode: 'NIGHTLY_SYNC' (last 48h) if no body is provided.
 */
export async function POST(request: Request) {
    // 1. Security Verification
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn("⚠️ Unauthorized Cron Attempt detected.");
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 2. Determine Mode (Default: NIGHTLY_SYNC)
        let mode: SyncMode = 'NIGHTLY_SYNC'; 
        try {
            const body = await request.json();
            if (body.mode) mode = body.mode;
        } catch (e) {
            // No body provided, proceed with default
        }

        console.log(`⏰ [Cron] Job Started. Mode: ${mode}`);
        
        // 3. Start the Operation
        const startRes = await startBulkOrderSync(mode); 
        if (!startRes.success) throw new Error("Failed to initialize Bulk Operation with Shopify.");

        // 4. Poll for Completion
        // We poll every 5 seconds, up to 60 times (5 minutes max wait).
        let url = null;
        for (let i = 0; i < 60; i++) { 
            const status = await checkBulkStatus(startRes.operationId);
            
            if (status.status === "COMPLETED") {
                url = status.url;
                break;
            }
            if (status.status === "FAILED") {
                throw new Error(`Shopify Bulk Operation Failed. Error Code: ${status.errorCode}`);
            }
            
            // Wait 5 seconds before next check
            await new Promise(r => setTimeout(r, 5000));
        }

        if (!url) throw new Error("Timeout: Operation did not complete within the allowed window.");

        // 5. Download and Sync Data
        const processRes = await processBulkFile(url);
        
        console.log(`✅ [Cron] Job Finished. Processed ${processRes.count} orders.`);
        return NextResponse.json({ success: true, processed: processRes.count });

    } catch (error: any) {
        console.error("❌ [Cron] Job Failed:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}