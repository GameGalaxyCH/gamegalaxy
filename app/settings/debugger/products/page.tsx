import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DebuggerProductsPage(props: Props) {
  const searchParams = await props.searchParams;
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1;
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  const pageSize = 25;

  const whereClause = query ? {
    OR: [
      { title: { contains: query, mode: 'insensitive' as const } },
      { sku: { contains: query, mode: 'insensitive' as const } },
      { handle: { contains: query, mode: 'insensitive' as const } }
    ]
  } : {};

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.product.count({ where: whereClause })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper to format values for display
  const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-700 italic">null</span>;
    if (value instanceof Date) return <span className="text-yellow-100/70">{value.toISOString()}</span>;
    if (typeof value === 'object') return <pre className="text-[10px] text-gray-400 overflow-hidden">{JSON.stringify(value)}</pre>; // Handle Decimal & JSON
    return <span className="text-blue-100">{String(value)}</span>;
  };

  // Fields to separate into the "Basic" column vs "Metafields" column
  const basicFields = [
    'id', 'productId', 'title', 'variantTitle', 'handle', 'vendor', 
    'productType', 'status', 'sku', 'barcode', 'price', 'compareAtPrice', 
    'inventoryQuantity', 'cost', 'createdAt', 'updatedAt', 'lastSync', 'images'
  ];

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
                    <h1 className="text-2xl font-bold text-white">Raw Product Inspector</h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Viewing {products.length} of {totalCount} records.
                    </p>
                </div>

                <form className="relative w-full md:w-96">
                    <input 
                        name="q"
                        defaultValue={query}
                        placeholder="Search SKU or Name..." 
                        className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                </form>
            </div>
        </div>

        {/* Content List */}
        <div className="space-y-8">
            {products.map(prod => (
                <div key={prod.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-sm hover:border-purple-900/50 transition-colors">
                    
                    {/* Header Bar */}
                    <div className="bg-gray-950/50 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 bg-gray-800 rounded overflow-hidden border border-gray-700">
                                {(prod.images as any[])?.[0]?.src && (
                                    <img src={(prod.images as any[])[0].src} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div>
                                <span className="font-bold text-white mr-2">{prod.title}</span>
                                {prod.variantTitle && <span className="bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded text-[10px]">{prod.variantTitle}</span>}
                            </div>
                        </div>
                        <div className="text-xs text-gray-500">
                            Inventory: <span className={prod.inventoryQuantity > 0 ? "text-green-400" : "text-red-400"}>{prod.inventoryQuantity}</span>
                        </div>
                    </div>

                    {/* Split Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
                        
                        {/* LEFT: Basic Info (Approx 1/3 width) */}
                        <div className="lg:col-span-4 p-4 space-y-1">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Basic Data</h4>
                            {basicFields.map(key => (
                                <div key={key} className="flex justify-between items-center text-[11px] border-b border-gray-800/50 py-1 last:border-0">
                                    <span className="text-gray-500">{key}</span>
                                    <span className="text-right truncate max-w-[200px]">
                                        {formatValue(key, (prod as any)[key])}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* RIGHT: Metafields (Approx 2/3 width) */}
                        <div className="lg:col-span-8 p-4">
                             <h4 className="text-xs font-bold text-purple-400 uppercase mb-3 tracking-wider">Extended Metafields</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                {Object.keys(prod).map(key => {
                                    if (basicFields.includes(key)) return null;
                                    const val = (prod as any)[key];
                                    if (val === null) return null; // Hide null metafields to reduce noise, or remove this line to show nulls
                                    
                                    return (
                                        <div key={key} className="flex flex-col border-b border-gray-800/30 py-1.5">
                                            <span className="text-[10px] text-gray-500 uppercase">{key}</span>
                                            <span className="text-xs truncate" title={String(val)}>
                                                {formatValue(key, val)}
                                            </span>
                                        </div>
                                    )
                                })}
                             </div>
                        </div>

                    </div>
                </div>
            ))}

            {products.length === 0 && (
                 <div className="text-center py-20 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">
                    No products found matching "{query}"
                </div>
            )}
        </div>

        {/* Pagination */}
        <div className="mt-8 flex justify-between items-center bg-gray-900 p-4 rounded-lg border border-gray-800">
             <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
             <div className="flex gap-2">
                <Link 
                    href={page > 1 ? `/settings/debugger/products?page=${page-1}&q=${query}` : '#'}
                    className={`p-2 rounded border border-gray-700 ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
                >
                    <ChevronLeft size={16} />
                </Link>
                <Link 
                    href={page < totalPages ? `/settings/debugger/products?page=${page+1}&q=${query}` : '#'}
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