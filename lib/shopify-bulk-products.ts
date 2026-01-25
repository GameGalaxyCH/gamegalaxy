import { prisma } from "@/lib/prisma";
import readline from 'readline';
import { Readable } from 'stream';
import { getAccessToken, checkBulkStatus, resumeSyncProcess } from "@/lib/shopify-bulk-utils";

// --- CONFIGURATION ---
const VERBOSE_LOGGING = true;
function logVerbose(message: string, data?: any) {
    if (VERBOSE_LOGGING) {
        console.log(`🔍 [VERBOSE-PRODUCTS] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}
const API_VERSION = "2026-01";

// --- METAFIELD MAPPING ---
// Maps Shopify Keys to our FLAT Product Table columns
const METAFIELD_MAP: Record<string, string> = {
    // Basic Info
    "briefeinheit": "briefeinheit",
    "main_category": "mainCategory",
    "main_type": "mainType",
    "lieferanten_sku": "supplierSku",
    "released_at": "releasedAt",
    "produkt_typ": "productType",
    
    // Names
    "englischer_kartenname": "englishCardName",
    "french_name": "frenchCardName",
    "german_name": "germanCardName",
    
    // Prices
    "eur_price": "eurPrice",
    "usd_price": "usdPrice",
    "eur_foil_price": "eurFoilPrice",
    "usd_foil_price": "usdFoilPrice",
    "usd_etched_price": "usdEtchedPrice",

    // Discounts
    "mengenrabatt_2": "discountQty2",
    "mengenrabatt_3": "discountQty3",
    "mengenrabatt_4": "discountQty4",
    "mengenrabatt_5": "discountQty5",
    "mengenrabatt_6": "discountQty6",
    "mengenrabatt_7": "discountQty7",
    "mengenrabatt_8": "discountQty8",
    "mengenrabatt_9": "discountQty9",
    "mengenrabatt_10": "discountQty10",

    // Specs
    "innenmaterial": "innerMaterial",
    "material": "outerMaterial",
    "binder_verschluss": "binderClosure",
    "sleeveanzahl": "sleeveCount",
    "sleeveoberflaeche": "sleeveFinish",
    "sleeve_groesse": "sleeveSize",
    "produkt_farbe": "productColor",
    "produktgroesse": "productSize",
    "faecher_pro_seite": "compartmentsPerPage",
    "platz_fuer_double_sleeved": "capacityDoubleSleeved",
    "platz_fuer_single_sleeved": "capacitySingleSleeved",

    // Magic ID & Data
    "scryfall_id": "scryfallId",
    "scryfall_oracleId": "scryfallOracleId",
    "mkm_id": "mkmid",
    "tcg_id": "tcgid",
    "scryfall_variant_id": "scryfallId",

    "edition_set_code": "editionSetCode",
    "edition": "edition",
    "cardnumber": "cardNumber",
    "rarity": "rarity",
    "artist": "artist",
    "sprache": "language",
    
    "card_color": "cardColor",
    "color_identity": "colorIdentity",
    "produced_mana": "producedMana",
    "converted_manacost": "convertedManaCost",
    
    "keywords": "keywords",
    "toughness": "toughness",
    "power": "power",
    "subtype": "subtype",
    "card_frame": "cardFrame"
};

export type SyncMode = 'ALL_TIME' | 'NIGHTLY_SYNC';

/**
 * HELPER: Updates a target object with Metafield data.
 * Handles clean strings AND JSON-array strings (e.g. "[\"White\"]" or "[\"1.05\"]")
 */
function applyMetafield(target: any, key: string, rawValue: string) {
    const prismaColumn = METAFIELD_MAP[key];
    if (!prismaColumn) return;

    let cleanValue = rawValue;

    // 1. CLEAN UP JSON ARRAYS
    // Shopify often returns metafields as "[\"Value\"]" or "[]"
    if (typeof rawValue === 'string' && rawValue.startsWith('[') && rawValue.endsWith(']')) {
        try {
            const parsed = JSON.parse(rawValue);
            if (Array.isArray(parsed)) {
                // If array is empty, value is null. Otherwise take first item.
                cleanValue = parsed.length > 0 ? parsed[0] : null; 
            }
        } catch (e) {
            // If parse fails, assume it was just a string starting with [
            console.warn(`Failed to parse array metafield for ${key}: ${rawValue}`);
        }
    }

    if (cleanValue === null || cleanValue === undefined) return;

    // 2. TYPE CONVERSION
    if (['eurPrice', 'usdPrice', 'eurFoilPrice', 'usdFoilPrice', 'usdEtchedPrice'].includes(prismaColumn)) {
        // Convert string number to float
        const num = parseFloat(cleanValue);
        target[prismaColumn] = isNaN(num) ? null : num;
    } 
    else if (['sleeveCount', 'compartmentsPerPage', 'capacityDoubleSleeved', 'capacitySingleSleeved'].includes(prismaColumn)) {
        // Convert to Int
        const intVal = parseInt(cleanValue);
        target[prismaColumn] = isNaN(intVal) ? null : intVal;
    } 
    else {
        // Default String
        target[prismaColumn] = String(cleanValue);
    }
}

/**
 * Step 1: Triggers the Bulk Operation on Shopify.
 */
export async function startBulkProductSync(mode: SyncMode, token: string) {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    let queryFilter = "";

    if (mode === 'NIGHTLY_SYNC') {
        const d = new Date();
        d.setHours(d.getHours() - 48);
        queryFilter = `(query: "updated_at:>=${d.toISOString()}")`;
        logVerbose(`Date Filter Calculated (NIGHTLY): ${d.toISOString()}`);
    } else {
        // Hardcoded start date: January 1st, 2020
        // We use a specific ISO string to be precise.
        const hardcodedDate = "2020-01-01T00:00:00Z";
        queryFilter = `(query: "created_at:>=${hardcodedDate}")`;
        logVerbose(`Date Filter Calculated (ALL_TIME): ${hardcodedDate}`);
    }

    console.log(`[BulkProducts] Starting. Mode: ${mode}, Filter: ${queryFilter || "NONE"}`);

    // Note: We fetch the same data, but we will process it differently.
    const bulkQuery = `
    mutation {
      bulkOperationRunQuery(
        query: """
          {
            products${queryFilter} {
              edges {
                node {
                  id
                  title
                  handle
                  status
                  vendor
                  productType
                  totalInventory
                  createdAt
                  updatedAt
                  
                  images(first: 10) {
                    edges {
                      node {
                        id
                        originalSrc
                        altText
                      }
                    }
                  }

                  metafields(first: 50) {
                    edges {
                      node {
                        namespace
                        key
                        value
                      }
                    }
                  }

                  variants {
                    edges {
                      node {
                        id
                        title
                        sku
                        price
                        compareAtPrice
                        inventoryQuantity
                        barcode 
                        
                        inventoryItem {
                          id
                          unitCost {
                            amount
                          }
                        }

                        metafields(first: 100) {
                          edges {
                            node {
                              namespace
                              key
                              value
                            }
                          }
                        }
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

    if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        const errorMsg = JSON.stringify(result.data.bulkOperationRunQuery.userErrors);
        return { success: false, message: errorMsg };
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
 * FLATTENED LOGIC:
 * 1. Read Parent -> Buffer it.
 * 2. Read Metafields/Images -> Apply to Buffer.
 * 3. Read Variants -> Merge Buffer + Variant -> Add to 'toSave' list.
 * 4. On New Parent -> Save 'toSave' list to DB (Replace strategy).
 */
export async function processProductFile(url: string, operationId: string) {
    if (!url) return { success: false, message: "No download URL provided." };

    try {
        console.log("[BulkProducts] Downloading file stream...");
        logVerbose(`Download URL: ${url}`);

        const response = await fetch(url);
        if (!response.body) throw new Error("Failed to download file stream.");

        const fileStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let totalProcessed = 0;
        
        // --- MEMORY BUFFERS ---
        let activeParent: any = null; // The current Parent Product Data
        let activeVariants = new Map<string, any>(); // Map<VariantID, FlatProductObject>

        // --- HELPER: FLUSH PARENT TO DB ---
        // This function saves all collected variants for the 'activeParent' and then clears memory.
        const flushActiveParent = async () => {
            if (!activeParent || activeVariants.size === 0) {
                // Edge case: Product exists but has no variants? 
                // In a flat table, we usually don't save anything, or we save a dummy.
                // For TCG, if there are no variants, there is nothing to sell. Skip.
                activeParent = null;
                activeVariants.clear();
                return;
            }

            const parentId = activeParent.id;
            const variantsToSave = Array.from(activeVariants.values());

            try {
                // TRANSACTION:
                // 1. Delete all existing rows for this Product ID (Clean slate for this product)
                // 2. Insert all current variants
                await prisma.$transaction(async (tx) => {
                    await tx.product.deleteMany({ where: { productId: parentId } });
                    
                    if (variantsToSave.length > 0) {
                        await tx.product.createMany({ data: variantsToSave });
                    }
                }, {
                    maxWait: 5000,
                    timeout: 20000 
                });

                totalProcessed += variantsToSave.length;
                // logVerbose(`Saved ${variantsToSave.length} variants for ${activeParent.title}`);

            } catch (err: any) {
                console.error(`FAILED to save product ${parentId}:`, err.message);
            }

            // Clear buffers
            activeParent = null;
            activeVariants.clear();

            if (global.gc) {
                 global.gc();
            }
        };

        // --- STREAM LOOP ---
        for await (const line of rl) {
            const obj = JSON.parse(line);

            if (!obj.__parentId) {
                // ==========================
                // CASE 1: ROOT PRODUCT (New Parent Started)
                // ==========================
                
                // If we were processing a previous parent, flush it now.
                if (activeParent && activeParent.id !== obj.id) {
                    await flushActiveParent();
                }

                // Initialize new Parent
                activeParent = {
                    // Store Parent-Level fields that all variants will inherit
                    id: obj.id, // Keep ID for reference, but NOT for DB saving (DB ID is Variant ID)
                    title: obj.title,
                    handle: obj.handle,
                    vendor: obj.vendor,
                    productType: obj.productType,
                    status: obj.status,
                    createdAt: new Date(obj.createdAt),
                    updatedAt: new Date(obj.updatedAt),
                    images: [], // Will populate
                    // We will collect parent metafields directly onto this object
                };
            } 
            else {
                // ==========================
                // CASE 2: CHILD NODE
                // ==========================
                const parentId = obj.__parentId;

                // Safety: Ensure we are matching the correct parent in memory
                if (!activeParent || activeParent.id !== parentId) {
                    // This happens if the stream is out of order or we missed the root.
                    // Shopify bulk is usually ordered. If not, this logic skips orphaned children.
                    continue; 
                }

                // A. CHECK IF IT IS A VARIANT
                if (obj.id && obj.id.includes('ProductVariant')) {
                    const cost = obj.inventoryItem?.unitCost?.amount ? parseFloat(obj.inventoryItem.unitCost.amount) : null;
                    
                    // SKU Parsing
                    let condition = null;
                    let finish = null;
                    if (obj.sku) {
                        const s = obj.sku.toLowerCase();
                        if (s.includes('-nm')) condition = 'NM';
                        if (s.includes('-pl')) condition = 'PL';
                        if (s.includes('-f') || s.includes('-foil')) finish = 'Foil';
                        else finish = 'Non-Foil';
                    }

                    // CREATE FLAT OBJECT
                    // 1. Copy Parent Data
                    const flatProduct = {
                        ...activeParent, // Inherit Title, Handle, Vendor, etc.
                        
                        // 2. Overwrite with Variant Specifics
                        id: obj.id, // Primary Key (Variant ID)
                        productId: activeParent.id, // Foreign Key Reference
                        
                        variantTitle: obj.title, // e.g. "NM"
                        sku: obj.sku,
                        barcode: obj.barcode,
                        price: parseFloat(obj.price || "0"),
                        compareAtPrice: obj.compareAtPrice ? parseFloat(obj.compareAtPrice) : null,
                        inventoryQuantity: obj.inventoryQuantity || 0,
                        cost: cost,
                        condition: condition,
                        finish: finish,
                        lastSync: new Date()
                        // images: activeParent.images (Already copied via spread, will update if parent adds more?)
                        // actually arrays are copied by reference in spread (shallow), 
                        // so if we add images to parent LATER, they might appear here. 
                        // BUT Shopify sends images BEFORE variants usually.
                    };

                    // Remove fields that are not in the schema or collision issues?
                    // The spread `...activeParent` included `id` which we overwrote. Good.
                    // It included `images` array reference.
                    
                    // Add to map
                    activeVariants.set(obj.id, flatProduct);
                }
                
                // B. CHECK IF IT IS A METAFIELD
                else if (obj.key && obj.namespace) {
                    // 1. Product Level Metafield?
                    // If it hasn't been applied to activeParent yet, do so.
                    // AND update all currently existing variants in the buffer.
                    if (parentId === activeParent.id) {
                         // Apply to Parent Template
                         applyMetafield(activeParent, obj.key, obj.value);
                         
                         // Apply to all currently buffered variants
                         for (const variant of activeVariants.values()) {
                             applyMetafield(variant, obj.key, obj.value);
                         }
                    }
                    // 2. Variant Level Metafield?
                    // Find the specific variant and update it.
                    else if (activeVariants.has(parentId)) {
                        const variant = activeVariants.get(parentId);
                        applyMetafield(variant, obj.key, obj.value);
                    }
                }

                // C. CHECK IF IT IS AN IMAGE
                else if (obj.originalSrc) {
                     // Add to Parent Template
                     const img = {
                         id: obj.id,
                         src: obj.originalSrc,
                         alt: obj.altText
                     };
                     activeParent.images.push(img);
                     
                     // Since variants share the images array reference (shallow copy), 
                     // this push MIGHT reflect in variants if they were created already.
                     // To be safe/explicit, we don't need to loop because of JS reference.
                     // (activeParent.images IS the same array instance as flatProduct.images)
                }
            }
        }

        // --- FLUSH FINAL ITEM ---
        if (activeParent) {
            logVerbose("Saving final product...");
            await flushActiveParent();
        }

        console.log(`[BulkProducts] Finished! Total variants synced: ${totalProcessed}`);

        // --- FINAL LOGGING ---
        await prisma.$transaction(async (tx) => {
            await tx.syncLog.create({
                data: { type: "PRODUCTS", status: "SUCCESS", count: totalProcessed }
            });

            // Update SPECIFIC ID to COMPLETED
            await tx.bulkOperation.update({
                where: { id: operationId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    objectCount: totalProcessed
                }
            });
        });

        return { success: true, count: totalProcessed };

    } catch (error: any) {
        console.error("[BulkProducts] Processing Error:", error);
        logVerbose("Full Stack Trace", error.stack);
        return { success: false, message: error.message };
    }
}

/**
 * Cron Job Route
 */
export async function runFullProductSync(mode: SyncMode) {
    console.log(`🚀 [CronJob] Starting Full Product Sync: ${mode}`);
    const token = await getAccessToken();

    // 1. Start
    const startRes = await startBulkProductSync(mode, token);
    if (!startRes.success) throw new Error(startRes.message);

    // 2. Await the full process (Block until done)
    const url = await resumeSyncProcess(startRes.operationId, token);

    if (typeof url !== 'string') {
        return { success: false, count: 0, message: "Operation Canceled or Failed during poll" };
    }

    // 3. Process the file
    const result =  await processProductFile(url, startRes.operationId);

    return { success: true, count: result.count };
}