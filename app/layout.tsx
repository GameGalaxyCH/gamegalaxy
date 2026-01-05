import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

// 2. Configure the font (subsets usually 'latin')
const inter = Inter({ subsets: ["latin"] }); 

export const metadata: Metadata = {
  title: "GameGalaxy Dashboard",
  description: "Admin Panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 3. Add 'inter.className' to the body. This applies the font to everything. */}
      <body className={`${inter.className} bg-slate-50 flex`}>
        
        <Sidebar />

        <main className="flex-1 ml-64 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}