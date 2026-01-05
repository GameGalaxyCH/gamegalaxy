// lib/shopify-bulk-utils.ts
import { prisma } from "@/lib/prisma";

const API_VERSION = "2026-01";

export async function getAccessToken() {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!shop || !clientId || !clientSecret) {
        throw new Error("Missing Shopify credentials in environment variables.");
    }

    const url = `https://${shop}/admin/oauth/access_token`;
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
    });

    const response = await fetch(url, { method: 'POST', body: params });

    if (!response.ok) {
        throw new Error(`Auth Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Step 2: Polls the status of a running Bulk Operation.
 */
export async function checkBulkStatus(operationId: string, token: string) {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;

    const query = `
      query {
        node(id: "${operationId}") {
          ... on BulkOperation {
            id
            status
            url
            errorCode
            objectCount
            rootObjectCount
            fileSize
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query }),
        cache: 'no-store'
    });

    const result = await response.json();

    if (result.data?.node) {
        const orders = result.data.node.rootObjectCount;
        const totalNodes = result.data.node.objectCount;

        console.log(`[BulkPoll] Status: ${result.data.node.status} | Count: ${orders} (Nodes: ${totalNodes})`);
        console.log(`Polling Result for ${operationId}`, result.data.node);
    }

    if (!result.data || !result.data.node) {
        console.warn(`[BulkPoll] Node null. Raw:`, JSON.stringify(result));
        return { status: "FAILED", errorCode: "ID_NOT_FOUND" };
    }

    return result.data.node;
}

/**
 * SHARED HELPER: The actual "Heavy Lifting"
 * Polls Shopify, Updates DB, Downloads File, Parses JSONL, Saves to DB.
 */
export async function resumeSyncProcess(operationId: string, token: string) {
    console.log(`⏳ [SyncProducts] Polling for ${operationId}...`);

    let url = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 10000;

    // 1. POLL LOOP
    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const status = await checkBulkStatus(operationId, token);
        let localStatus = status.status;

        if (status.status === "COMPLETED") localStatus = "IMPORTING";

        // Update DB
        await prisma.bulkOperation.update({
            where: { id: operationId },
            data: {
                status: localStatus,
                errorCode: status.errorCode,
                objectCount: parseInt(status.objectCount || "0"),
                rootObjectCount: parseInt(status.rootObjectCount || "0"),
                url: status.url
            }
        });

        if (status.status === "COMPLETED") {
            url = status.url;
            break;
        }
        if (status.status === "FAILED") {
            throw new Error(`Shopify Failed: ${status.errorCode}`);
        }

        if (status.status === "CANCELED" || status.status === "CANCELLED") {
            console.log(`🚫 [Sync] Operation was canceled. Stopping.`);
            return { success: false, count: 0, message: "Operation Canceled" };
        }

        await new Promise(r => setTimeout(r, 10000));
    }

    if (!url) throw new Error("Timeout waiting for Shopify");
    return url;
}