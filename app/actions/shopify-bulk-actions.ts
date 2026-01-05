'use server'

import { prisma } from "@/lib/prisma";
import { getAccessToken, resumeSyncProcess } from "@/lib/shopify-bulk-utils";
import { startBulkOrderSync, processOrderFile } from "@/lib/shopify-bulk-orders";
import { startBulkProductSync, processProductFile } from "@/lib/shopify-bulk-products";
import { unstable_noStore as noStore } from "next/cache";
import {
    fetchGlobalSystemStatus,
    performCancelOperation
} from "@/lib/shopify-bulk-system-status";

type SyncMode = 'ALL_TIME' | 'NIGHTLY_SYNC';

/**
 * MANUAL TRIGGER: ORDERS
 */
export async function triggerManualOrderSync(mode: SyncMode) {
    console.log(`👆 [ManualButton] Triggering Sync: ${mode}`);
    const token = await getAccessToken();

    // 1. Start (Block for ~1s to ensure DB row exists)
    const startRes = await startBulkOrderSync(mode, token);
    if (!startRes.success) return { success: false, message: startRes.message };

    // 2. Background Process (Fire & Forget)
    // We do NOT await this. We let it run in the background.
    (async () => {
        try {
            // A. Poll until we get the URL
            const result = await resumeSyncProcess(startRes.operationId, token);

            // B. SAFETY CHECK: Did we get a URL or a Cancel object?
            if (typeof result === 'string') {
                // C. Process the file
                await processOrderFile(result, startRes.operationId);
            } else {
                console.log("Operation was canceled or failed, skipping download.");
            }
        } catch (error) {
            console.error(`💥 [Background Fail] ID: ${startRes.operationId}`, error);
            await prisma.bulkOperation.update({
                where: { id: startRes.operationId },
                data: { status: "FAILED", errorCode: "SERVER_CRASH" }
            }).catch(e => console.error("DB Save Fail", e));
        }
    })();

    // 3. Return to UI instantly
    return { success: true, message: "Started", operationId: startRes.operationId };
}


/**
 * MANUAL TRIGGER: PRODUCTS
 */
export async function triggerManualProductSync(mode: SyncMode) {
    console.log(`👆 [ManualButton] Triggering Product Sync: ${mode}`);
    const token = await getAccessToken();

    // 1. Start (Block for ~1s to ensure DB row exists)
    const startRes = await startBulkProductSync(mode, token);
    if (!startRes.success) return { success: false, message: startRes.message };

    // 2. Background Process (Fire & Forget)
    (async () => {
        try {
            // A. Poll until we get the URL
            const result = await resumeSyncProcess(startRes.operationId, token);

            // B. SAFETY CHECK: Did we get a URL or a Cancel object?
            if (typeof result === 'string') {
                // C. Process the file
                await processProductFile(result, startRes.operationId);
            } else {
                console.log("Operation was canceled or failed, skipping download.");
            }
        } catch (error) {
            console.error(`💥 [Background Fail] ID: ${startRes.operationId}`, error);
            await prisma.bulkOperation.update({
                where: { id: startRes.operationId },
                data: { status: "FAILED", errorCode: "SERVER_CRASH" }
            }).catch(e => console.error("DB Save Fail", e));
        }
    })();

    // 3. Return to UI instantly
    return { success: true, message: "Started", operationId: startRes.operationId };
}

export async function getGlobalSystemStatus(clientTimestamp?: number) {
    noStore();
    return await fetchGlobalSystemStatus();
}

export async function cancelOperation(id: string) {
    return await performCancelOperation(id);
}