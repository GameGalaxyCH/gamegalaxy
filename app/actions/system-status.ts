'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getAccessToken() {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    const url = `https://${shop}/admin/oauth/access_token`;
    const params = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, grant_type: "client_credentials" });
    const response = await fetch(url, { method: 'POST', body: params });
    const data = await response.json();
    return data.access_token;
}

export async function getTotalOrderCount() {
    const token = await getAccessToken();
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const hardcodedDate = "2020-01-01T00:00:00Z";

    const query = `
      query {
        ordersCount(query: "created_at:>=${hardcodedDate}") {
          count
        }
      }
    `;

    try {
        const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
            body: JSON.stringify({ query }),
            cache: 'no-store' // Always get fresh data
        });

        const result = await response.json();
        return result.data?.ordersCount?.count || 0;

    } catch (e) {
        console.error("Failed to fetch total order count:", e);
        return 0;
    }
}

export async function getGlobalSystemStatus() {
    const token = await getAccessToken();
    const shop = process.env.SHOPIFY_STORE_DOMAIN;

    // 1. Fetch Last 5 Exports/Imports
    const lastQueries = await prisma.bulkOperation.findMany({
        where: { type: 'QUERY' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    const lastMutations = await prisma.bulkOperation.findMany({
        where: { type: 'MUTATION' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    // 2. Identify IDs to "Live Check"
    const activeStates = ['CREATED', 'RUNNING', 'CANCELLING'];
    
    // Rule 1: Check anything currently running
    const activeIds = [...lastQueries, ...lastMutations]
        .filter(op => activeStates.includes(op.status))
        .map(op => op.id);

    // Rule 2: Check anything COMPLETED but missing the download URL (Backfill)
    const missingUrlIds = [...lastQueries, ...lastMutations]
        .filter(op => op.status === 'COMPLETED' && !op.url)
        .map(op => op.id);

    const allIdsToCheck = Array.from(new Set([...activeIds, ...missingUrlIds]));

    // If nothing to check, return DB data
    if (allIdsToCheck.length === 0) {
        return { 
            activeQuery: null,
            activeMutation: null,
            history: { queries: lastQueries, mutations: lastMutations }
        };
    }

    // 3. Ask Shopify
    const query = `
    query CheckNodes {
      nodes(ids: ${JSON.stringify(allIdsToCheck)}) {
        ... on BulkOperation {
          id
          status
          errorCode
          objectCount
          fileSize
          url
          partialDataUrl
          createdAt
          completedAt
        }
      }
    }
    `;

    try {
        const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
            body: JSON.stringify({ query }),
            cache: 'no-store'
        });

        const result = await response.json();
        const nodes = result.data?.nodes || [];

        const foundNodesMap = new Map();
        nodes.forEach((node: any) => {
            if (node && node.id) foundNodesMap.set(node.id, node);
        });

        // 4. Update Database
        for (const id of allIdsToCheck) {
            const remoteNode = foundNodesMap.get(id);

            if (remoteNode) {
                // UPDATE: Save the URL and status
                await prisma.bulkOperation.update({
                    where: { id: id },
                    data: { 
                        status: remoteNode.status, 
                        errorCode: remoteNode.errorCode,
                        objectCount: parseInt(remoteNode.objectCount || "0"),
                        fileSize: remoteNode.fileSize,
                        url: remoteNode.url, // <--- This is what we needed
                        completedAt: remoteNode.completedAt ? new Date(remoteNode.completedAt) : null
                    }
                });
            } else {
                // GHOST: If we thought it was running but it's gone
                if (activeIds.includes(id)) {
                    await prisma.bulkOperation.update({
                        where: { id: id },
                        data: { status: "FAILED", errorCode: "GHOST_JOB", completedAt: new Date() }
                    });
                }
            }
        }

        // 5. Re-fetch fresh data for UI
        const freshQueries = await prisma.bulkOperation.findMany({
            where: { type: 'QUERY' },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        const freshMutations = await prisma.bulkOperation.findMany({
            where: { type: 'MUTATION' },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        return {
            activeQuery: freshQueries.find(q => activeStates.includes(q.status)) || null,
            activeMutation: freshMutations.find(m => activeStates.includes(m.status)) || null,
            history: { queries: freshQueries, mutations: freshMutations }
        };

    } catch (e) {
        console.error("[SystemStatus] Error fetching nodes:", e);
        return { 
            activeQuery: lastQueries.find(q => activeStates.includes(q.status)) || null, 
            activeMutation: lastMutations.find(m => activeStates.includes(m.status)) || null,
            history: { queries: lastQueries, mutations: lastMutations }
        };
    }
}

// KILL SWITCH using bulkOperationCancel
export async function cancelOperation(id: string) {
    try {
        const token = await getAccessToken();
        const shop = process.env.SHOPIFY_STORE_DOMAIN;

        console.log(`[System] Requesting Shopify to cancel: ${id}`);

        // 1. DELETE THE OPTIMISTIC UPDATE
        // We do NOT update Prisma here. We wait for Shopify's answer.

        // 2. Send Mutation
        const query = `
        mutation CancelOp($id: ID!) {
          bulkOperationCancel(id: $id) {
            bulkOperation {
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
            body: JSON.stringify({ 
                query, 
                variables: { id } 
            })
        });

        const result = await response.json();

        // 3. Check for Top-Level API Errors (e.g. Throttle, Auth)
        if (result.errors) {
            console.error("[System] API Error:", result.errors);
            return { success: false, message: result.errors[0].message };
        }

        // 4. Check for User Errors (e.g. "ID invalid", "Already cancelled")
        if (result.data?.bulkOperationCancel?.userErrors?.length > 0) {
            console.error("[System] User Error:", result.data.bulkOperationCancel.userErrors);
            return { success: false, message: result.data.bulkOperationCancel.userErrors[0].message };
        }

        // 5. SUCCESS: Shopify confirmed the cancel signal.
        // Now we can safely update the database with the REAL status returned by Shopify.
        const newStatus = result.data.bulkOperationCancel.bulkOperation.status;
        
        console.log(`[System] Shopify confirmed cancel. New status: ${newStatus}`);

        await prisma.bulkOperation.update({
            where: { id },
            data: { status: newStatus } // Likely "CANCELLING" or "COMPLETED"
        });

        revalidatePath('/settings/debugger');
        return { success: true };

    } catch (e: any) {
        console.error("[System] Exception:", e);
        return { success: false, message: e.message };
    }
}