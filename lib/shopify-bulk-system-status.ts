import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/shopify-bulk-utils";

// --- CONFIGURATION ---
// Set this to true to see detailed logs about the System Status checks
const VERBOSE_LOGGING = false;

function logVerbose(message: string, data?: any) {
    if (VERBOSE_LOGGING) {
        // We add a specific emoji ⚡ to distinguish these logs easily
        console.log(`⚡ [SystemStatus] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}
// ---------------------

export async function fetchGlobalSystemStatus() {
    const now = new Date().toISOString();
    logVerbose(`Called at ${now}`);

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
    const activeStates = [
        'CREATED', 
        'RUNNING', 
        'IMPORTING', 
        'CANCELLING', 
        'CANCELING'
    ];
    
    // Check anything currently running
    const activeIds = [...lastQueries, ...lastMutations]
        .filter(op => activeStates.includes(op.status))
        .map(op => op.id);

    const allIdsToCheck = Array.from(new Set(activeIds));

    logVerbose(`IDs selected for Live Check:`, allIdsToCheck);

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
          rootObjectCount
          fileSize
          url
          createdAt
          completedAt
        }
      }
    }
    `;

    try {
        const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
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
                const currentDbRecord = await prisma.bulkOperation.findUnique({ where: { id }});
                
                let statusToSave = remoteNode.status;

                // PROTECT "IMPORTING" STATE
                // If local DB says IMPORTING, and Shopify says COMPLETED, keep it IMPORTING.
                // It will only switch to COMPLETED when processBulkFile finishes and updates the DB.
                if (currentDbRecord?.status === 'IMPORTING' && remoteNode.status === 'COMPLETED') {
                    statusToSave = 'IMPORTING';
                }

                // Determine CompletedAt
                // Only take Shopify's completedAt if we are actually saving as COMPLETED
                const finalCompletedAt = (statusToSave === 'COMPLETED' && remoteNode.completedAt)
                    ? new Date(remoteNode.completedAt)
                    : currentDbRecord?.completedAt;

                logVerbose(`[${id}] Update -> Status: ${statusToSave} | RootCount: ${remoteNode.rootObjectCount}`);

                await prisma.bulkOperation.update({
                    where: { id: id },
                    data: {
                        status: statusToSave, 
                        errorCode: remoteNode.errorCode,
                        objectCount: parseInt(remoteNode.objectCount || "0"),
                        rootObjectCount: parseInt(remoteNode.rootObjectCount || "0"),
                        fileSize: remoteNode.fileSize,
                        url: remoteNode.url,
                        completedAt: finalCompletedAt
                    }
                });
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

        const activeQ = freshQueries.find(q => activeStates.includes(q.status));
        const activeM = freshMutations.find(m => activeStates.includes(m.status));

        logVerbose("Returning fresh data to Client", { 
            activeQuery: activeQ?.status, 
            activeMutation: activeM?.status 
        });

        return {
            activeQuery: activeQ || null,
            activeMutation: activeM || null,
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
export async function performCancelOperation(id: string) {
    try {
        const token = await getAccessToken();
        const shop = process.env.SHOPIFY_STORE_DOMAIN;

        console.log(`[System] Requesting Shopify to cancel: ${id}`);

        // 2. Send Mutation
        const query = `
        mutation bulkOperationCancel($id: ID!) {
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

        const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
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

        return { success: true };

    } catch (e: any) {
        console.error("[System] Exception:", e);
        return { success: false, message: e.message };
    }
}