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

/**
 * DEBUG TRIGGER: MANUAL URL
 * Bypasses Shopify Export and directly processes a provided JSONL URL.
 */
export async function triggerDebugUrlImport(type: 'ORDERS' | 'PRODUCTS', url: string) {
    console.log(`👆 [DebugInput] Triggering Manual URL Import for ${type}`);
    
    // 1. Generate a Fake ID (formatted like Shopify's to fit Schema)
    const opId = `gid://shopify/BulkOperation/MANUAL_${type}_${Date.now()}`;

    try {
        // 2. Create DB Record so processFunction has a valid ID to update status on
        // We use type "QUERY" so it appears in the existing History Table in SystemStatusPanel
        await prisma.bulkOperation.create({
            data: {
                id: opId,
                type: "QUERY", 
                status: "IMPORTING",
                url: url,
                objectCount: 0,
                rootObjectCount: 0,
                createdAt: new Date()
            }
        });

        // 3. Run in background (Fire & Forget)
        (async () => {
            try {
                if (type === 'ORDERS') {
                    await processOrderFile(url, opId);
                } else {
                    await processProductFile(url, opId);
                }
            } catch (error: any) {
                console.error(`💥 [Manual Import Fail] ID: ${opId}`, error);
                await prisma.bulkOperation.update({
                    where: { id: opId },
                    data: { status: "FAILED", errorCode: "MANUAL_IMPORT_CRASH" }
                }).catch(e => console.error("DB Save Fail", e));
            }
        })();

        return { success: true, message: "Manual Import Started", operationId: opId };

    } catch (e: any) {
        console.error("Failed to init manual import", e);
        return { success: false, message: e.message };
    }
}

export async function getGlobalSystemStatus(clientTimestamp?: number) {
    noStore();
    return await fetchGlobalSystemStatus();
}

export async function cancelOperation(id: string) {
    return await performCancelOperation(id);
}