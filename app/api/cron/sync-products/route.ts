// app/api/cron/sync-products/route.ts
import { startBulkProductSync } from "@/app/actions/bulk-products";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes max for the trigger

export async function POST(req: NextRequest) {
    // 1. Secure the route
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Start Nightly Sync
        console.log("[Cron] Starting Nightly Product Sync...");
        const result = await startBulkProductSync('NIGHTLY_SYNC');

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            operationId: result.operationId 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}