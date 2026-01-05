'use server'

import { prisma } from "@/lib/prisma";

export interface BoosterStockReport {
  boosterTitle: string;
  boosterStock: number;
  boosterId: string; // Variant ID
  boosterParentId: string; // Product ID (for Admin Link)
  displayTitle: string;
  displayStock: number;
  displayId: string; // Variant ID
  displayParentId: string; // Product ID (for Admin Link)
}

export async function getBoosterStockReport(): Promise<{ success: boolean; data?: BoosterStockReport[]; error?: string }> {
  try {
    // 1. Fetch all products from local DB that match the legacy "sku:*-booster-*" logic
    // We use 'contains' to simulate the wildcard search. 
    // We fetch ID, Title, Inventory, and ProductID (Parent) for the links.
    const products = await prisma.product.findMany({
      where: {
        sku: {
          contains: 'booster',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        productId: true, // Needed for the Shopify Admin Link
        title: true,
        inventoryQuantity: true,
      }
    });

    // 2. Separate products (Legacy Logic Ported)
    const displayProducts = products.filter(p => p.title.includes('Display'));
    const nonDisplayProducts = products.filter(p => !p.title.includes('Display'));

    let report: BoosterStockReport[] = [];

    // 3. Match Logic (Exact Legacy Logic)
    // "find matches where Display Title minus ' Display' equals Booster Title"
    for (let product of nonDisplayProducts) {
      // Logic: displayProduct.title.replace(' Display', '') === product.title
      const displayProduct = displayProducts.find(dp => dp.title.replace(' Display', '') === product.title);

      if (displayProduct) {
        report.push({
          boosterTitle: product.title,
          boosterStock: product.inventoryQuantity,
          boosterId: product.id,
          boosterParentId: product.productId,
          
          displayTitle: displayProduct.title,
          displayStock: displayProduct.inventoryQuantity,
          displayId: displayProduct.id,
          displayParentId: displayProduct.productId
        });
      }
    }

    // Sort by booster stock (lowest first) for better visibility
    report.sort((a, b) => a.boosterStock - b.boosterStock);

    return { success: true, data: report };

  } catch (error: any) {
    console.error("Error fetching booster stock:", error);
    return { success: false, error: error.message };
  }
}