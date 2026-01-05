import { LayoutDashboard, Settings, Package } from "lucide-react";
import Link from "next/link";
import Image from "next/image"; // <--- 1. Import the Image component

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 text-white flex flex-col h-screen fixed left-0 top-0 z-50">
      
      {/* Header with Logo */}
      <div className="p-6">
        {/* Flex container to align Logo + Text */}
        <div className="flex items-center gap-3">
          
          {/* The Logo */}
          <div className="relative w-8 h-8"> {/* Container to control size */}
            <Image 
              src="/logo-topaz.png" 
              alt="GameGalaxy Logo" 
              fill // This makes the image fill the w-8 h-8 container
              className="object-contain" // Keeps aspect ratio correct
              priority // Loads this image instantly
            />
          </div>

          <h1 className="text-xl font-bold tracking-wider text-gray-100">
            GG OMNICORE
          </h1>
        </div>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {/* Entry 1: Booster Bestand */}
        <Link href="/boosterStock" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg group transition-all">
          <LayoutDashboard size={20} />
          <span className="font-medium">Booster Bestand</span>
        </Link>
        
        {/* Placeholder for Products link if you need it later */}
        {/* <Link href="/products" ... /> */}
      </nav>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-gray-800">
        <Link href="/settings/debugger" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
          <Settings size={20} />
          <span>System Debugger</span>
        </Link>
      </div>
    </aside>
  );
}