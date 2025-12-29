'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import readline from 'readline';
import { Readable } from 'stream';

export type SyncMode = 'ALL_TIME' | 'NIGHTLY_SYNC';

// --- CONFIGURATION: MAP SHOPIFY KEYS TO PRISMA COLUMNS ---
// Format: "shopify_key": "prismaColumnName"
// We assume namespace is mostly "my_fields". We check key names.
const METAFIELD_MAP: Record<string, string> = {
    // Basic Info
    "briefeinheit": "briefeinheit",
    "main_category": "mainCategory",
    "main_type": "mainType",
    "lieferanten_sku": "supplierSku",
    "released_at": "releasedAt",
    "produkt_typ": "productType", // Metafield override for type
    
    // Names
    "englischer_kartenname": "englishCardName",
    "franzoesischer_kartenname": "frenchCardName",
    "deutscher_kartenname": "germanCardName",
    
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
    "mengenrabatt_10": "discountQty10",
    // ... add 5,6,7,8,9 if keys follow pattern

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
    "scryfall_oracle_id": "scryfallOracleId",
    "mkm_id": "mkmid",
    "tcg_id": "tcgid",
    "scryfall_variant_id": "scryfallId", // Handle both keys just in case

    "edition_set_code": "setCode",
    "edition": "set",
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
    "subtype": "subType",
    "card_frame": "cardFrame"
};

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

export async function startBulkProductSync(mode: SyncMode) {
    const token = await getAccessToken();
    const shop = process.env.SHOPIFY_STORE_DOMAIN;

    let queryFilter = "";
    if (mode === 'NIGHTLY_SYNC') {
        const d = new Date();
        d.setHours(d.getHours() - 48);
        queryFilter = `(query: "updated_at:>=${d.toISOString()}")`;
    }

    console.log(`[BulkProducts] Starting GOD FETCH. Mode: ${mode}`);

    // We fetch 100 metafields per variant/product to catch everything
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
                  
                  images(first: 5) {
                    edges {
                      node {
                        id
                        originalSrc
                        altText
                      }
                    }
                  }

                  # PRODUCT LEVEL METAFIELDS
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

                        # VARIANT LEVEL METAFIELDS (The big list)
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

    const response = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: bulkQuery })
    });

    const result = await response.json();
    if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        return { success: false, message: JSON.stringify(result.data.bulkOperationRunQuery.userErrors) };
    }
    return { success: true, operationId: result.data.bulkOperationRunQuery.bulkOperation.id };
}

export async function checkBulkStatus(operationId: string) {
    const token = await getAccessToken();
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const query = `query { node(id: "${operationId}") { ... on BulkOperation { id status url errorCode objectCount } } }`;
    const response = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query })
    });
    const result = await response.json();
    if (!result.data?.node) return { status: "FAILED" };
    return result.data.node; 
}

// --- PARSER ---

function parseMetafields(edges: any[]) {
    const data: any = {};
    if (!edges) return data;

    for (const edge of edges) {
        const key = edge.node.key;
        const value = edge.node.value;
        // Check if we have a mapping for this Shopify key
        const prismaColumn = METAFIELD_MAP[key];
        
        if (prismaColumn) {
            // Convert numeric strings to numbers/decimals where needed
            if (['eurPrice', 'usdPrice', 'eurFoilPrice', 'usdFoilPrice'].includes(prismaColumn)) {
                data[prismaColumn] = parseFloat(value);
            } else if (['sleeveCount', 'compartmentsPerPage'].includes(prismaColumn)) {
                data[prismaColumn] = parseInt(value);
            } else {
                data[prismaColumn] = value;
            }
        }
    }
    return data;
}

export async function processProductFile(url: string) {
    if (!url) return { success: false, message: "No URL" };
    
    try {
        const response = await fetch(url);
        const fileStream = Readable.fromWeb(response.body as any);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        const productsMap = new Map();
        const variantsBatch: any[] = [];

        for await (const line of rl) {
            const obj = JSON.parse(line);

            if (!obj.__parentId) {
                // IS PRODUCT
                const images = obj.images?.edges?.map((edge: any) => ({
                    id: edge.node.id,
                    src: edge.node.originalSrc,
                    alt: edge.node.altText
                })) || [];

                // Parse Product Metafields
                const metaData = parseMetafields(obj.metafields?.edges);

                productsMap.set(obj.id, {
                    id: obj.id,
                    title: obj.title,
                    handle: obj.handle,
                    status: obj.status,
                    vendor: obj.vendor,
                    productType: obj.productType,
                    totalInventory: obj.totalInventory || 0,
                    images: images,
                    createdAt: new Date(obj.createdAt),
                    updatedAt: new Date(obj.updatedAt),
                    lastSync: new Date(),
                    ...metaData // Spread product-level metafields
                });
            } else {
                // IS VARIANT
                const cost = obj.inventoryItem?.unitCost?.amount ? parseFloat(obj.inventoryItem.unitCost.amount) : null;
                
                // Parse Variant Metafields (The big list)
                const metaData = parseMetafields(obj.metafields?.edges);

                // Basic SKU parsing
                let condition = null;
                let finish = null;
                if (obj.sku) {
                    const s = obj.sku.toLowerCase();
                    if (s.includes('-nm')) condition = 'NM';
                    if (s.includes('-pl')) condition = 'PL';
                    if (s.includes('-f') || s.includes('-foil')) finish = 'Foil';
                    else finish = 'Non-Foil';
                }

                variantsBatch.push({
                    id: obj.id,
                    productId: obj.__parentId,
                    title: obj.title,
                    sku: obj.sku,
                    barcode: obj.barcode,
                    price: parseFloat(obj.price || "0"),
                    compareAtPrice: obj.compareAtPrice ? parseFloat(obj.compareAtPrice) : null,
                    inventoryQuantity: obj.inventoryQuantity || 0,
                    cost: cost,
                    condition: condition,
                    finish: finish,
                    updatedAt: new Date(),
                    ...metaData // Spread variant-level metafields (Populates scryfallId, etc.)
                });
            }
        }

        console.log(`[BulkProducts] Saving ${productsMap.size} products...`);

        await prisma.$transaction(async (tx) => {
            for (const prod of productsMap.values()) {
                await tx.product.upsert({
                    where: { id: prod.id },
                    update: prod,
                    create: prod
                });
            }

            const productIds = Array.from(productsMap.keys());
            await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
            
            if (variantsBatch.length > 0) {
                await tx.productVariant.createMany({ data: variantsBatch });
            }

            await tx.syncLog.create({
                data: { type: "PRODUCTS", status: "SUCCESS", count: productsMap.size }
            });
        }, {
            maxWait: 20000,
            timeout: 50000
        });

        revalidatePath('/');
        return { success: true, count: productsMap.size };

    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message };
    }
}