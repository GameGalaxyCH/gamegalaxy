// f:\Fabian AI Stuff\gamegalaxy-app\app\page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import { getBoosterStockReport } from "@/app/boosterStock/actions";

// Fetch the last known status from the SyncLog table AND Urgent Booster Tasks
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

  // 3. Get Booster Stock Report for "Urgent Refills"
  // Logic: Booster <= 5 AND Display >= 1
  const stockRes = await getBoosterStockReport();
  const urgentRefills = (stockRes.success && stockRes.data) 
    ? stockRes.data.filter(item => item.boosterStock <= 5 && item.displayStock > 0)
    : [];

  return {
    productSync: lastProductLog,
    orderSync: lastOrderLog,
    urgentRefills,
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
        urgentRefills={data.urgentRefills}
      />
    </div>
  );
}