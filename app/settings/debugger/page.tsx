import Sidebar from "@/components/Sidebar";
import BulkFetchOrders from "@/components/BulkFetchOrders";

export default function DebuggerPage() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      
      <main className="ml-64 flex-1 p-8">
        <h1 className="text-3xl font-bold text-white mb-2">System Debugger</h1>
        <p className="text-gray-400 mb-8 border-b border-gray-800 pb-6">
          Internal tools for manual data synchronization and system maintenance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PANEL: Order Synchronization */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 text-blue-400 flex items-center gap-2">
                  Order Management
                </h2>
                
                <div className="space-y-6">
                    {/* Routine Maintenance */}
                    <div className="p-4 bg-gray-950 rounded border border-gray-800">
                        <h3 className="text-sm font-medium text-gray-200 mb-1">Manual Nightly Sync (48h)</h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Triggers the standard "Nightly" routine. Fetches all orders created or updated 
                            in the last 48 hours. Useful for verifying recent data fixes.
                        </p>
                        <BulkFetchOrders mode="NIGHTLY_SYNC" label="Run 48h Sync" />
                    </div>

                    {/* Emergency / Initialization */}
                    <div className="p-4 bg-red-950/10 rounded border border-red-900/30">
                        <h3 className="text-sm font-medium text-red-400 mb-1">Full Historical Import</h3>
                        <p className="text-xs text-red-900/70 mb-4 leading-relaxed">
                            <strong>Warning:</strong> This fetches the entire order history from Day 1. 
                            Use only for initial database population or total data corruption recovery.
                        </p>
                        <BulkFetchOrders mode="ALL_TIME" label="Fetch ALL History" />
                    </div>
                </div>
            </div>

            {/* PANEL: Product Synchronization (Future) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-60">
                <h2 className="text-xl font-semibold mb-4 text-purple-400">Product Management</h2>
                <div className="h-full flex items-center justify-center border border-dashed border-gray-800 rounded bg-gray-950/50">
                    <p className="text-sm text-gray-500">Module coming soon...</p>
                </div>
            </div>

        </div>
      </main>
    </div>
  );
}