'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import readline from 'readline';
import { Readable } from 'stream';

/**
 * SyncMode defines the operational scope for the bulk synchronization.
 * - 'ALL_TIME': Fetches the entire order history (Heavy operation).
 * - 'NIGHTLY_SYNC': Fetches orders created or updated in the last 48 hours (Rolling window).
 */
export type SyncMode = 'ALL_TIME' | 'NIGHTLY_SYNC';

/**
 * Retrieves a temporary access token for the Shopify Admin API using the Client Credentials Grant.
 * This token is valid for a limited time and is suitable for backend-to-backend communication.
 */
async function getAccessToken() {
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
 * Step 1: Triggers the Bulk Operation on Shopify.
 * Constructs a GraphQL mutation based on the selected SyncMode and sends it to Shopify.
 * * @param mode - The synchronization mode (NIGHTLY_SYNC or ALL_TIME)
 * @returns Object containing success status and the operationId (if successful)
 */
export async function startBulkOrderSync(mode: SyncMode) {
    const token = await getAccessToken();
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const API_VERSION = "2024-01";

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
    } else if (mode === 'ALL_TIME') {
        // CHANGED: Hardcoded start date: January 1st, 2020
        // We use a specific ISO string to be precise.
        const hardcodedDate = "2020-01-01T00:00:00Z";
        queryFilter = `(query: "created_at:>=${hardcodedDate}")`;
    }
    // 'ALL_TIME' leaves queryFilter empty, triggering a full historical fetch.

    console.log(`[BulkSync] Starting. Mode: ${mode}, Filter: ${queryFilter || "NONE (Full History)"}`);

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

    // DEBUG: Log the request
    console.log(`[BulkSync] Sending Mutation to https://${shop}/admin/api/${API_VERSION}/graphql.json`);

    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: bulkQuery })
    });

    const result = await response.json();

    // DEBUG: Log the FULL response
    console.log("[BulkSync] START Response:", JSON.stringify(result, null, 2));
    
    if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        return { 
            success: false, 
            message: JSON.stringify(result.data.bulkOperationRunQuery.userErrors) 
        };
    }

    const op = result.data.bulkOperationRunQuery.bulkOperation;
    if (!op || !op.id) {
         return { success: false, message: "Shopify returned success but no Operation ID was found." };
    }

    // Persist the ID immediately so the Debugger can see it
    await prisma.bulkOperation.create({
        data: {
            id: op.id,
            type: "QUERY",
            status: op.status,
        }
    });

    return { 
        success: true, 
        operationId: op.id 
    };
}

/**
 * Step 2: Polls the status of a running Bulk Operation.
 */
export async function checkBulkStatus(operationId: string) {
    const token = await getAccessToken();
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
            partialDataUrl
          }
        }
      }
    `;

    // Polling Strategy: 60 seconds patience for "blinks"
    const MAX_RETRIES = 30;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
                body: JSON.stringify({ query }),
                cache: 'no-store'
            });

            const result = await response.json();

            // DEBUG: Log ONLY if null to see why
            if (!result.data || !result.data.node) {
                console.warn(`[BulkPoll] Attempt ${attempt} Raw Response:`, JSON.stringify(result));
            }

            // 1. Valid Node Found
            if (result.data && result.data.node) {
                return result.data.node; 
                // Returns { status: "FAILED", errorCode: "TIMEOUT", ... } if failed
            }

            if (result.errors) {
                console.warn(`[BulkPoll] GraphQL Error:`, result.errors[0].message);
            }

        } catch (e) {
            console.warn(`[BulkPoll] Attempt ${attempt} Network Error:`, e);
        }

        // Wait 2 seconds
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 2000));
    }

    // 3. Timeout / Ghost Job
    return { 
        status: "FAILED", 
        errorCode: "APP_TIMEOUT", 
        message: "Shopify API stopped returning the ID after 60 seconds." 
    };
}

/**
 * Step 3: Downloads and processes the JSONL file from Shopify.
 * Streams the file line-by-line to handle large datasets efficiently without memory issues.
 * Performs a transactional upsert to the database.
 * * @param url - The download URL provided by Shopify upon completion
 */
export async function processBulkFile(url: string) {
    if (!url) return { success: false, message: "No download URL provided." };

    try {
        console.log("[BulkSync] Downloading file...");
        const response = await fetch(url);
        if (!response.body) throw new Error("Failed to download file stream.");

        // Convert the standard Web Stream to a Node.js Readable stream for readline
        const fileStream = Readable.fromWeb(response.body as any);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        const ordersMap = new Map();
        const lineItemsBatch: any[] = [];

        // Parse JSONL line by line
        for await (const line of rl) {
            const obj = JSON.parse(line);

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
                // We batch these to insert them after ensuring the parent order exists
                lineItemsBatch.push({
                    id: obj.id,
                    orderId: obj.__parentId,
                    title: obj.title,
                    sku: obj.sku,
                    quantity: obj.quantity,
                    price: parseFloat(obj.originalUnitPriceSet?.shopMoney?.amount || "0")
                });
            }
        }

        console.log(`[BulkSync] Processing ${ordersMap.size} orders and ${lineItemsBatch.length} line items...`);

        // Database Transaction: Ensures Data Integrity
        // 1. Upsert all orders first.
        // 2. Clean old line items to prevent duplicates.
        // 3. Insert fresh line items.
        await prisma.$transaction(async (tx) => {
            for (const order of ordersMap.values()) {
                await tx.order.upsert({
                    where: { id: order.id },
                    update: order,
                    create: order
                });
            }

            const orderIds = Array.from(ordersMap.keys());
            await tx.lineItem.deleteMany({ where: { orderId: { in: orderIds } } });
            
            if (lineItemsBatch.length > 0) {
                await tx.lineItem.createMany({ data: lineItemsBatch });
            }

            // Create Sync Log Entry
            await tx.syncLog.create({
                data: {
                    type: "ORDERS",
                    status: "SUCCESS",
                    count: ordersMap.size
                }
            });

            // Mark the active DB operation as COMPLETED
            const activeOp = await tx.bulkOperation.findFirst({
                where: { type: "QUERY", status: { in: ["CREATED", "RUNNING"] } },
                orderBy: { createdAt: 'desc' }
            });
            
            if (activeOp) {
                await tx.bulkOperation.update({
                    where: { id: activeOp.id },
                    data: { 
                        status: "COMPLETED", 
                        completedAt: new Date(), 
                        objectCount: ordersMap.size 
                    }
                });
            }
            // ----------------------------------
        });

        revalidatePath('/');
        return { success: true, count: ordersMap.size };

    } catch (error: any) {
        console.error("[BulkSync] Processing Error:", error);
        return { success: false, message: error.message };
    }
}