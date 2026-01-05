import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DebuggerOrdersPage(props: Props) {
  const searchParams = await props.searchParams;
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1;
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  const pageSize = 25;

  // Search by ID or Name (Order #)
  const whereClause = query ? {
    OR: [
      { id: { contains: query, mode: 'insensitive' as const } },
      { name: { contains: query, mode: 'insensitive' as const } }
    ]
  } : {};

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true }, // Include the relation to show EVERYTHING
    }),
    prisma.order.count({ where: whereClause })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <Sidebar />
      
      <main className="p-8">
        {/* Header */}
        <div className="mb-8">
            <Link href="/settings/debugger" className="text-gray-500 hover:text-white flex items-center gap-2 mb-4 text-sm">
                <ArrowLeft size={16} /> Back to Debugger
            </Link>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Raw Order Inspector</h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Viewing {orders.length} of {totalCount} records. Showing ALL database fields.
                    </p>
                </div>

                <form className="relative w-full md:w-96">
                    <input 
                        name="q"
                        defaultValue={query}
                        placeholder="Search ID or Order #..." 
                        className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                </form>
            </div>
        </div>

        {/* Content List */}
        <div className="space-y-6">
            {orders.map(order => (
                <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-sm hover:border-gray-700 transition-colors">
                    
                    {/* Key Info Header */}
                    <div className="flex justify-between items-start border-b border-gray-800 pb-4 mb-4">
                        <div>
                            <span className="text-xl font-bold text-blue-400 mr-3">{order.name}</span>
                            <span className="text-xs text-gray-500">{order.id}</span>
                        </div>
                        <div className="text-right">
                             <span className="text-sm font-bold text-white block">
                                {order.totalPrice.toFixed(2)} {order.currencyCode}
                             </span>
                             <span className="text-xs text-gray-500">
                                {new Date(order.createdAt).toLocaleString()}
                             </span>
                        </div>
                    </div>

                    {/* Raw Data Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-xs text-gray-300">
                        {Object.entries(order).map(([key, value]) => {
                            if (key === 'lineItems') return null; // Handle separately
                            return (
                                <div key={key} className="flex gap-2 border-b border-gray-800/50 py-1">
                                    <span className="text-gray-500 w-32 shrink-0 truncate" title={key}>{key}:</span>
                                    <span className="truncate w-full font-medium">
                                        {value instanceof Date ? value.toISOString() : String(value)}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Relation: Line Items */}
                    <div className="mt-6 pt-4 border-t border-gray-800">
                        <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Line Items ({order.lineItems.length})</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-gray-400">
                                <thead className="bg-gray-950 text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">SKU</th>
                                        <th className="px-3 py-2">Title</th>
                                        <th className="px-3 py-2">Qty</th>
                                        <th className="px-3 py-2">Price</th>
                                        <th className="px-3 py-2">ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {order.lineItems.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-3 py-2 font-mono text-blue-300">{item.sku || '-'}</td>
                                            <td className="px-3 py-2 text-white">{item.title}</td>
                                            <td className="px-3 py-2">{item.quantity}</td>
                                            <td className="px-3 py-2">{item.price.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">{item.id}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            ))}

            {orders.length === 0 && (
                <div className="text-center py-20 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">
                    No orders found matching "{query}"
                </div>
            )}
        </div>

        {/* Pagination */}
        <div className="mt-8 flex justify-between items-center bg-gray-900 p-4 rounded-lg border border-gray-800">
             <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
             <div className="flex gap-2">
                <Link 
                    href={page > 1 ? `/settings/debugger/orders?page=${page-1}&q=${query}` : '#'}
                    className={`p-2 rounded border border-gray-700 ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
                >
                    <ChevronLeft size={16} />
                </Link>
                <Link 
                    href={page < totalPages ? `/settings/debugger/orders?page=${page+1}&q=${query}` : '#'}
                    className={`p-2 rounded border border-gray-700 ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
                >
                    <ChevronRight size={16} />
                </Link>
             </div>
        </div>

      </main>
    </div>
  );
}