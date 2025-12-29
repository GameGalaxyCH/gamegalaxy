// components/Sidebar.tsx
import { LayoutDashboard, ShoppingBag, Settings, Users, Package } from "lucide-react"; // Added Package icon
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 text-white flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-wider text-gray-100">GAMEGALAXY</h1>
        <div className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Admin Panel</div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg group transition-all">
          <ShoppingBag size={20} />
          <span className="font-medium">Orders</span>
        </Link>

        {/* NEW PRODUCTS LINK */}
        <Link href="/products" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg group transition-all">
          <Package size={20} />
          <span className="font-medium">Products</span>
        </Link>
        
        <div className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-gray-800 hover:text-white rounded-lg cursor-pointer transition-all">
          <LayoutDashboard size={20} />
          <span>Analytics</span>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <Link href="/settings/debugger" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
          <Settings size={20} />
          <span>System Debugger</span>
        </Link>
      </div>
    </aside>
  );
}