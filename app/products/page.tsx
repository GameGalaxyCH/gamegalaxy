import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

// Force dynamic rendering so search params work correctly
export const dynamic = 'force-dynamic';

// 1. Update Props Interface (searchParams is now a Promise)
interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProductsPage(props: Props) {
  // 2. Await the params before using them
  const searchParams = await props.searchParams;

  // 3. Now parse safely
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1;
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  const pageSize = 100;

  // 2. Build Where Clause (Search Filter)
  const whereClause = query ? {
    OR: [
      { title: { contains: query, mode: 'insensitive' as const } },
      { handle: { contains: query, mode: 'insensitive' as const } },
      // Search inside variants SKU as well?
      { variants: { some: { sku: { contains: query, mode: 'insensitive' as const } } } }
    ]
  } : {};

  // 3. Fetch Data from Prisma
  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { updatedAt: 'desc' },
      include: { 
        // We fetch variants to calculate price ranges or show inventory
        variants: { 
            take: 5, // Only fetch first 5 variants to keep it light
            orderBy: { price: 'asc' } 
        } 
      }
    }),
    prisma.product.count({ where: whereClause })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      
      <main className="p-8">
        {/* Header & Search */}
        <div className="flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Products</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Manage inventory and listings ({totalCount.toLocaleString()} total)
            </p>
          </div>

          {/* Search Bar Form */}
          <form className="relative w-full md:w-96">
            <input 
              name="q"
              defaultValue={query}
              placeholder="Search by name, SKU or handle..." 
              className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-900 focus:border-blue-700 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={16} />
          </form>
        </div>

        {/* Products Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-800 text-gray-200 uppercase font-semibold text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Image</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Type / Vendor</th>
                  <th className="px-6 py-4">Inventory</th>
                  <th className="px-6 py-4">Price Range</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {products.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                            No products found matching "{query}".
                        </td>
                    </tr>
                ) : products.map((prod) => {
                  // Helper: Get first image safely
                  const images = prod.images as any[]; // Cast JSON type
                  const thumb = images && images.length > 0 ? images[0].src : null;
                  
                  // Helper: Price Range
                  const minPrice = prod.variants.length > 0 ? prod.variants[0].price : 0;
                  const maxPrice = prod.variants.length > 0 ? prod.variants[prod.variants.length - 1].price : 0;
                  const priceDisplay = minPrice.toString() === maxPrice.toString() 
                    ? Number(minPrice).toFixed(2)
                    : `${Number(minPrice).toFixed(2)} - ${Number(maxPrice).toFixed(2)}`;

                  return (
                  <tr key={prod.id} className="hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-6 py-4">
                        <div className="h-10 w-10 bg-gray-800 rounded flex items-center justify-center overflow-hidden border border-gray-700">
                             {thumb ? (
                                <img src={thumb} alt={prod.title} className="object-cover h-full w-full" />
                             ) : (
                                <span className="text-xs text-gray-600">No Img</span>
                             )}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white truncate max-w-xs" title={prod.title}>
                        {prod.title}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{prod.handle}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
                            prod.status === 'ACTIVE' 
                                ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                                : 'bg-gray-800 text-gray-500 border-gray-700'
                        }`}>
                            {prod.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                        <div className="text-gray-300">{prod.productType || "—"}</div>
                        <div className="text-gray-600">{prod.vendor}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={prod.totalInventory <= 0 ? "text-red-400" : "text-gray-300"}>
                            {prod.totalInventory}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                        {priceDisplay}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className="text-blue-500 hover:text-blue-400 text-xs cursor-pointer">Edit</span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-800 flex items-center justify-between">
             <div className="text-xs text-gray-500">
                Page {page} of {totalPages}
             </div>
             
             <div className="flex gap-2">
                {page > 1 && (
                    <Link 
                        href={`/products?page=${page - 1}&q=${query}`}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition"
                    >
                        <ChevronLeft size={16} />
                    </Link>
                )}
                
                {page < totalPages && (
                    <Link 
                        href={`/products?page=${page + 1}&q=${query}`}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition"
                    >
                        <ChevronRight size={16} />
                    </Link>
                )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}