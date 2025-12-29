import Sidebar from "@/components/Sidebar";
import BulkFetchOrders from "@/components/BulkFetchOrders";
import BulkFetchProducts from "@/components/BulkFetchProducts";
import SystemStatusPanel from "@/components/SystemStatusPanel";

export default function DebuggerPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      
      <main className="p-8">
        <h1 className="text-3xl font-bold text-white mb-2">System Debugger</h1>
        <p className="text-gray-400 mb-8 border-b border-gray-800 pb-6">
          Internal tools for manual data synchronization and system maintenance.
        </p>

        <SystemStatusPanel />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PANEL 1: ORDERS */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 text-blue-400 flex items-center gap-2">
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
            </div>

            {/* PANEL 2: PRODUCTS */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 text-purple-400 flex items-center gap-2">
                  Product Management
                </h2>
                
                <div className="space-y-6">
                     <div className="p-4 bg-gray-950 rounded border border-gray-800">
                        <h3 className="text-sm font-medium text-gray-200 mb-1">Manual Update Sync (48h)</h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Fetches products that changed (inventory, price, new images) in the last 48 hours.
                        </p>
                        {/* 👇 The new button */}
                        <BulkFetchProducts mode="NIGHTLY_SYNC" label="Run 48h Product Sync" />
                    </div>

                    <div className="p-4 bg-purple-900/10 rounded border border-purple-900/30">
                        <h3 className="text-sm font-medium text-purple-300 mb-1">God Fetch (All Data)</h3>
                        <p className="text-xs text-purple-200/60 mb-4 leading-relaxed">
                            Fetches 100% of products, variants, and ALL 100+ metafields. 
                            Use this to initialize the database.
                        </p>
                        {/* 👇 The new button */}
                        <BulkFetchProducts mode="ALL_TIME" label="Fetch ALL Products" />
                    </div>
                </div>
            </div>

        </div>
      </main>
    </div>
  );
}