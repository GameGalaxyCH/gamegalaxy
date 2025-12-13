// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, ShoppingCart, Settings } from "lucide-react"; // npm install lucide-react

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GameGalaxy Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <div className="flex min-h-screen">
          
          {/* Sidebar */}
          <aside className="w-64 bg-gray-900 text-white flex-shrink-0">
            <div className="p-6">
              <h1 className="text-xl font-bold tracking-wider">GAMEGALAXY</h1>
            </div>
            <nav className="mt-6 px-4 space-y-2">
              <Link href="/" className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg text-white">
                <ShoppingCart size={20} />
                <span className="font-medium">Orders</span>
              </Link>
              <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                <LayoutDashboard size={20} />
                <span className="font-medium">Dashboard</span>
              </Link>
              <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                <Settings size={20} />
                <span className="font-medium">Settings</span>
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
          
        </div>
      </body>
    </html>
  );
}