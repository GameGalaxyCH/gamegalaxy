import Sidebar from "@/components/Sidebar";
import BulkFetchOrders from "@/components/BulkFetchOrders";
import BulkFetchProducts from "@/components/BulkFetchProducts";
import SystemStatusPanel from "@/components/SystemStatusPanel";
import ManualImportDebugger from "@/components/BulkManualImportDebugger";
import Link from "next/link";
import { Database, ShoppingBag, FileText } from "lucide-react";

export default function DebuggerPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      
      <main className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Database className="text-blue-500" />
                    System Debugger
                </h1>
                <p className="text-gray-400">
                    Internal tools for manual data synchronization and system maintenance.
                </p>
            </div>

            {/* NEW BUTTONS HERE */}
            <div className="flex gap-3 mt-4 md:mt-0">
                <Link 
                    href="/settings/debugger/orders"
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-all text-sm font-medium"
                >
                    <FileText size={16} />
                    Raw Orders
                </Link>
                <Link 
                    href="/settings/debugger/products"
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-all text-sm font-medium"
                >
                    <ShoppingBag size={16} />
                    Raw Products
                </Link>
            </div>
        </div>

        <SystemStatusPanel />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PANEL 1: ORDERS */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col gap-6">
                <h2 className="text-xl font-semibold text-blue-400 flex items-center gap-2">
                  Order Management
                </h2>
                
                <div className="space-y-6">
                    <div className="p-4 bg-gray-950 rounded border border-gray-800">
                        <h3 className="text-sm font-medium text-gray-200 mb-1">Manual Nightly Sync (48h)</h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Triggers the standard "Nightly" routine. Fetches orders created/updated in the last 48h.
                        </p>
                        <BulkFetchOrders mode="NIGHTLY_SYNC" label="Run 48h Order Sync" />
                    </div>

                    <div className="p-4 bg-red-950/10 rounded border border-red-900/30">
                        <h3 className="text-sm font-medium text-red-400 mb-1">Full Historic Import</h3>
                        <p className="text-xs text-red-900/70 mb-4 leading-relaxed">
                            Warning: Fetches entire order history from Day 1.
                        </p>
                        <BulkFetchOrders mode="ALL_TIME" label="Fetch ALL Orders" />
                    </div>
                </div>

                {/* --- MANUAL ORDER DEBUGGER --- */}
                <div className="pt-6 border-t border-gray-800">
                    <ManualImportDebugger type="ORDERS" title="DEBUG ORDER JSONL" />
                </div>
            </div>

            {/* PANEL 2: PRODUCTS */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col gap-6">
                <h2 className="text-xl font-semibold text-purple-400 flex items-center gap-2">
                  Product Management
                </h2>
                
                <div className="space-y-6">
                      <div className="p-4 bg-gray-950 rounded border border-gray-800">
                        <h3 className="text-sm font-medium text-gray-200 mb-1">Manual Update Sync (48h)</h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Fetches products that changed (inventory, price, new images) in the last 48 hours.
                        </p>
                        <BulkFetchProducts mode="NIGHTLY_SYNC" label="Run 48h Product Sync" />
                    </div>

                    <div className="p-4 bg-purple-900/10 rounded border border-purple-900/30">
                        <h3 className="text-sm font-medium text-purple-300 mb-1">God Fetch (All Data)</h3>
                        <p className="text-xs text-purple-200/60 mb-4 leading-relaxed">
                            Fetches 100% of products, variants, and ALL 100+ metafields. 
                            Use this to initialize the database.
                        </p>
                        <BulkFetchProducts mode="ALL_TIME" label="Fetch ALL Products" />
                    </div>
                </div>

                {/* --- MANUAL PRODUCT DEBUGGER --- */}
                <div className="pt-6 border-t border-gray-800">
                    <ManualImportDebugger type="PRODUCTS" title="DEBUG PRODUCT JSONL" />
                </div>
            </div>

        </div>
      </main>
    </div>
  );
}