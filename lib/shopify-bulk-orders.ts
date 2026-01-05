import { prisma } from "@/lib/prisma";
import readline from 'readline';
import { Readable } from 'stream';
import { getAccessToken, checkBulkStatus, resumeSyncProcess } from "@/lib/shopify-bulk-utils";

// --- CONFIGURATION ---
// Set this to true to see detailed logs about Query construction, GraphQL responses, and Batch processing.
const VERBOSE_LOGGING = true;
function logVerbose(message: string, data?: any) {
    if (VERBOSE_LOGGING) {
        console.log(`🔍 [VERBOSE] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}
// ---------------------

/**
 * SyncMode defines the operational scope for the bulk synchronization.
 * - 'ALL_TIME': Fetches the entire order history (Heavy operation).
 * - 'NIGHTLY_SYNC': Fetches orders created or updated in the last 48 hours (Rolling window).
 */
export type SyncMode = 'ALL_TIME' | 'NIGHTLY_SYNC';
const API_VERSION = "2026-01";

/**
 * Step 1: Triggers the Bulk Operation on Shopify.
 * Constructs a GraphQL mutation based on the selected SyncMode and sends it to Shopify.
 * * @param mode - The synchronization mode (NIGHTLY_SYNC or ALL_TIME)
 * @returns Object containing success status and the operationId (if successful)
 */
export async function startBulkOrderSync(mode: SyncMode, token: string) {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;

    let queryFilter = "";

    if (mode === 'NIGHTLY_SYNC') {
        // ROLLING WINDOW STRATEGY:
        // We look back 48 hours using 'updated_at'. This captures:
        // 1. New orders created in the last 2 days.
        // 2. Older orders that were modified (refunded, fulfilled) in the last 2 days.
        // The 48h window provides a safety buffer in case a previous nightly job failed.
        const d = new Date();
        d.setHours(d.getHours() - 48);
        queryFilter = `(query: "updated_at:>=${d.toISOString()}")`;
        logVerbose(`Date Filter Calculated (NIGHTLY): ${d.toISOString()}`);
    } else if (mode === 'ALL_TIME') {
        // Hardcoded start date: January 1st, 2020
        // We use a specific ISO string to be precise.
        const hardcodedDate = "2020-01-01T00:00:00Z";
        queryFilter = `(query: "created_at:>=${hardcodedDate}")`;
        logVerbose(`Date Filter Calculated (ALL_TIME): ${hardcodedDate}`);
    }
    // 'ALL_TIME' leaves queryFilter empty, triggering a full historical fetch.

    console.log(`[BulkSync] Starting. Mode: ${mode}, Filter: ${queryFilter || "NONE (Full History)"}`);
    logVerbose(`Constructed Query Filter String: ${queryFilter}`);

    const bulkQuery = `
    mutation {
      bulkOperationRunQuery(
        query: """
          {
            orders${queryFilter} {
              edges {
                node {
                  id
                  name
                  email
                  createdAt
                  updatedAt
                  displayFinancialStatus
                  displayFulfillmentStatus
                  totalPriceSet { shopMoney { amount currencyCode } }
                  subtotalPriceSet { shopMoney { amount } }
                  totalTaxSet { shopMoney { amount } }
                  lineItems {
                    edges {
                      node {
                        id
                        title
                        sku
                        quantity
                        originalUnitPriceSet { shopMoney { amount } }
                      }
                    }
                  }
                }
              }
            }
          }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
    `;

    logVerbose("Sending GraphQL Mutation to Shopify...");

    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: bulkQuery })
    });

    const result = await response.json();
    logVerbose("Received GraphQL Response", result);

    // Check for User Errors
    if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        const errorMsg = JSON.stringify(result.data.bulkOperationRunQuery.userErrors);
        logVerbose("GraphQL User Errors found", errorMsg);
        return {
            success: false,
            message: errorMsg
        };
    }

    const op = result.data.bulkOperationRunQuery.bulkOperation;
    if (!op || !op.id) {
        return { success: false, message: "Shopify returned success but no Operation ID was found." };
    }

    // Create DB Entry
    await prisma.bulkOperation.create({
        data: {
            id: op.id,
            type: "QUERY",
            status: "CREATED",
            objectCount: 0,
            rootObjectCount: 0
        }
    });

    logVerbose(`Bulk Operation Created in DB: ${op.id}`);

    return { success: true, operationId: op.id };
}

/**
 * Step 3: Downloads and processes the JSONL file from Shopify.
 * Streams the file line-by-line to handle large datasets efficiently without memory issues.
 * Performs a transactional upsert to the database.
 * * @param url - The download URL provided by Shopify upon completion
 */
export async function processOrderFile(url: string, operationId: string) {
    if (!url) return { success: false, message: "No download URL provided." };

    try {
        console.log("[BulkSync] Downloading file stream...");
        logVerbose(`Download URL: ${url}`);

        const response = await fetch(url);

        if (!response.body) throw new Error("Failed to download file stream.");

        // Convert Web Stream to Node Stream for Readline
        const fileStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        // --- BATCH CONFIGURATION ---
        const BATCH_SIZE = 1000; // Process 1000 orders at a time
        let ordersMap = new Map(); // Current batch buffer
        let lineItemsBatch: any[] = []; // Current batch line items

        let totalRootProcessed = 0; // Orders
        let totalNodeProcessed = 0; // All Lines (Orders + LineItems)

        let batchCount = 0;

        // --- HELPER: SAVE BATCH TO DB ---
        const saveBatch = async () => {
            if (ordersMap.size === 0) return;
            batchCount++;

            logVerbose(`Processing Batch #${batchCount}. Size: ${ordersMap.size} Orders, ${lineItemsBatch.length} LineItems.`);

            const orderIds = Array.from(ordersMap.keys());
            const currentOrders = Array.from(ordersMap.values());
            const currentLineItems = [...lineItemsBatch];

            // Transaction: 30s timeout per batch is plenty for 100 items
            await prisma.$transaction(async (tx) => {
                // 1. Upsert Orders
                for (const order of currentOrders) {
                    await tx.order.upsert({
                        where: { id: order.id },
                        update: order,
                        create: order
                    });
                }

                // 2. Refresh Line Items (Delete old ones for THIS batch only, insert new)
                await tx.lineItem.deleteMany({ where: { orderId: { in: orderIds } } });

                if (currentLineItems.length > 0) {
                    await tx.lineItem.createMany({ data: currentLineItems });
                }
            }, {
                maxWait: 5000,  // Wait max 5s for a connection
                timeout: 60000  // 60s limit for this specific transaction
            });

            // Update counter and clear buffers
            totalRootProcessed += ordersMap.size;
            console.log(`[BulkSync] Saved batch. Total orders processed: ${totalRootProcessed}`);

            ordersMap.clear();
            lineItemsBatch = [];

            // Force Garbage Collection if available (helps on smaller VPS)
            if (global.gc) {
                global.gc();
                logVerbose("Garbage Collection triggered manually.");
            }
        };

        // --- STREAM LOOP ---
        for await (const line of rl) {
            const obj = JSON.parse(line);

            totalNodeProcessed++;

            if (!obj.__parentId) {
                // IT IS AN ORDER (Parent)
                ordersMap.set(obj.id, {
                    id: obj.id,
                    orderNumber: parseInt(obj.name.replace('#', '')) || 0,
                    name: obj.name,
                    email: obj.email,
                    createdAt: new Date(obj.createdAt),
                    updatedAt: new Date(obj.updatedAt),
                    currencyCode: obj.totalPriceSet?.shopMoney?.currencyCode || "USD",
                    totalPrice: parseFloat(obj.totalPriceSet?.shopMoney?.amount || "0"),
                    subtotalPrice: parseFloat(obj.subtotalPriceSet?.shopMoney?.amount || "0"),
                    totalTax: parseFloat(obj.totalTaxSet?.shopMoney?.amount || "0"),
                    financialStatus: obj.displayFinancialStatus,
                    fulfillmentStatus: obj.displayFulfillmentStatus,
                });
            } else {
                // IT IS A LINE ITEM (Child)
                // Only add if the parent is actually in this file (Shopify usually groups them)
                lineItemsBatch.push({
                    id: obj.id,
                    orderId: obj.__parentId,
                    title: obj.title,
                    sku: obj.sku,
                    quantity: obj.quantity,
                    price: parseFloat(obj.originalUnitPriceSet?.shopMoney?.amount || "0")
                });
            }

            // TRIGGER SAVE if batch is full
            if (ordersMap.size >= BATCH_SIZE) {
                await saveBatch();
            }
        }

        // --- SAVE REMAINDER ---
        if (ordersMap.size > 0) {
            logVerbose("Saving remaining items in final batch...");
            await saveBatch();
        }

        console.log(`[BulkSync] Finished! Roots: ${totalRootProcessed}, Nodes: ${totalNodeProcessed}`);

        // --- FINAL LOGGING ---
        await prisma.$transaction(async (tx) => {
            await tx.syncLog.create({
                data: { type: "ORDERS", status: "SUCCESS", count: totalRootProcessed }
            });

            // Update SPECIFIC ID to COMPLETED, regardless of previous state
            await tx.bulkOperation.update({
                where: { id: operationId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(), // Explicitly setting completion time
                    rootObjectCount: totalRootProcessed,
                    objectCount: totalNodeProcessed
                }
            });
        });

        return { success: true, count: totalRootProcessed };

    } catch (error: any) {
        console.error("[BulkSync] Processing Error:", error);
        logVerbose("Full Stack Trace", error.stack);
        return { success: false, message: error.message };
    }
}

/**
 * Cron Job Route
 */
export async function runFullOrderSync(mode: SyncMode) {
    console.log(`🚀 [CronJob] Starting Full Sync: ${mode}`);
    const token = await getAccessToken();

    // 1. Start
    const startRes = await startBulkOrderSync(mode, token);
    if (!startRes.success) throw new Error(startRes.message);

    // 2. Await the full process (Block until done)
    const url = await resumeSyncProcess(startRes.operationId, token);

    if (typeof url !== 'string') {
        return { success: false, count: 0, message: "Operation Canceled or Failed during poll" };
    }

    // 3. Process the file
    const result = await processOrderFile(url, startRes.operationId);

    return { success: true, count: result.count };
}