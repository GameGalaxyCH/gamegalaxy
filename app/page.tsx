export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

// Fetch the last known status from the SyncLog table
async function getDashboardData() {
  // 1. Get last Product Sync
  const lastProductLog = await prisma.syncLog.findFirst({
    where: { type: "PRODUCTS" },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Get last Order Sync
  const lastOrderLog = await prisma.syncLog.findFirst({
    where: { type: "ORDERS" },
    orderBy: { createdAt: 'desc' },
  });

  return {
    productSync: lastProductLog,
    orderSync: lastOrderLog,
  };
}

export default async function Page() {
  const data = await getDashboardData();

  // Offset the content by 64 (w-64) because the Sidebar is fixed
  return (
    <div className="min-h-screen bg-gray-50"> 
      <DashboardClient 
        productSync={data.productSync} 
        orderSync={data.orderSync} 
      />
    </div>
  );
}