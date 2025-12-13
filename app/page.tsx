import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import { Clock } from "lucide-react";

// Force dynamic rendering to ensure the latest database state is always fetched
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // 1. Fetch Orders
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { lineItems: true }
  });

  // 2. Fetch Last Successful Sync Time
  const lastSync = await prisma.syncLog.findFirst({
    where: { type: 'ORDERS', status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      
      <main className="ml-64 flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Order Overview</h1>
            
            {/* Last Sync Indicator */}
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                <Clock size={14} className={lastSync ? "text-green-500" : "text-gray-600"} />
                <span>Last Synced:</span>
                <span className="font-mono text-gray-300" suppressHydrationWarning>
                    {lastSync 
                        ? lastSync.createdAt.toLocaleString('de-CH', { 
                            day: '2-digit', month: '2-digit', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit' 
                          }) 
                        : "Never"}
                </span>
                {lastSync && (
                    <span className="bg-gray-800 text-gray-500 text-[10px] px-1.5 py-0.5 rounded ml-1">
                        +{lastSync.count} items
                    </span>
                )}
            </div>
          </div>
          
          <div className="text-xs text-gray-600 font-mono text-right">
            <div>Total Records</div>
            <div className="text-xl text-white">{orders.length}</div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-800 text-gray-200 uppercase font-semibold text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {orders.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No orders found in database. 
                            <br/>
                            <span className="text-xs">Go to Settings &gt; System Debugger to initialize sync.</span>
                        </td>
                    </tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-white">{order.name}</td>
                    
                    {/* Date with Hydration Fix */}
                    <td className="px-6 py-4">
                      <div suppressHydrationWarning>
                        {order.createdAt.toLocaleDateString()}
                        <span className="block text-xs text-gray-600 mt-0.5">
                            {order.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-gray-300">{order.email || "—"}</div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
                        order.financialStatus === 'PAID' 
                            ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                            : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'
                      }`}>
                        {order.financialStatus}
                      </span>
                      <span className={`block w-fit px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
                        order.fulfillmentStatus === 'FULFILLED' 
                            ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' 
                            : 'bg-gray-800 text-gray-500 border-gray-700'
                      }`}>
                        {order.fulfillmentStatus || 'UNFULFILLED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white font-mono">
                      <span className="text-gray-500 text-xs mr-1">{order.currencyCode}</span>
                      {order.totalPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                        {order.lineItems.slice(0, 2).map(item => (
                            <div key={item.id} className="truncate max-w-[150px] mb-0.5" title={item.title}>
                                <span className="text-gray-300 font-medium">{item.quantity}x</span> {item.title}
                            </div>
                        ))}
                        {order.lineItems.length > 2 && (
                            <span className="text-[10px] opacity-50">+{order.lineItems.length - 2} more...</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}