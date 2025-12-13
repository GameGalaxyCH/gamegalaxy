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

    const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: bulkQuery })
    });

    const result = await response.json();
    
    if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        return { 
            success: false, 
            message: JSON.stringify(result.data.bulkOperationRunQuery.userErrors) 
        };
    }

    return { 
        success: true, 
        operationId: result.data.bulkOperationRunQuery.bulkOperation.id 
    };
}

/**
 * Step 2: Polls the status of a running Bulk Operation.
 * SAFE VERSION: Handles null nodes and GraphQL errors to prevent crashes.
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
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query })
    });

    const result = await response.json();

    // ERROR HANDLING: Check if Shopify returned an error
    if (result.errors) {
        console.error("❌ [BulkPoll] GraphQL Error:", JSON.stringify(result.errors, null, 2));
        return { status: "FAILED", errorCode: "GRAPHQL_ERROR", message: "Shopify API Error" };
    }

    // NULL CHECK: Ensure the node actually exists
    if (!result.data || !result.data.node) {
        console.error("❌ [BulkPoll] Node is NULL. Operation ID used:", operationId);
        return { status: "FAILED", errorCode: "NULL_NODE", message: "Operation ID not found" };
    }

    const node = result.data.node;

    // LOG PROGRESS: Helps debugging
    console.log(`[BulkPoll] Status: ${node.status} | Items: ${node.objectCount}`);
    
    return node; 
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
        });

        revalidatePath('/');
        return { success: true, count: ordersMap.size };

    } catch (error: any) {
        console.error("[BulkSync] Processing Error:", error);
        return { success: false, message: error.message };
    }
}