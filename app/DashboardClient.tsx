"use client";

import React from 'react';
import { 
  Package, 
  ShoppingCart, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  Box,
  Layers,
  LayoutDashboard,
  Zap,
  TrendingUp,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { BoosterStockReport } from './boosterStock/actions';

// --- Types ---
interface SyncLog {
  id: string;
  type: string;
  status: string;
  count: number;
  createdAt: Date;
}

interface DashboardProps {
  productSync: SyncLog | null;
  orderSync: SyncLog | null;
  urgentRefills: BoosterStockReport[];
}

// --- Helpers ---
const formatDate = (dateString: string | Date | null) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit',
    day: '2-digit', 
    month: '2-digit', 
  });
};

export default function DashboardClient({ productSync, orderSync, urgentRefills }: DashboardProps) {

  // KPI Logic
  const refillCount = urgentRefills.length;
  const isSystemHealthy = productSync?.status === 'SUCCESS' && orderSync?.status === 'SUCCESS';
  
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* 1. COMPACT HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-gray-900">Übersicht</span>
        </div>
        <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full ${isSystemHealthy ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {isSystemHealthy ? 'System Online' : 'System Check Required'}
            </span>
        </div>
      </div>

      {/* 2. STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card A: ACTION REQUIRED (Gradient Red/Orange) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-200 p-6 flex flex-col justify-between h-40">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={100} />
            </div>
            <div>
                <div className="flex items-center gap-2 text-orange-100 font-medium mb-1">
                    <AlertTriangle size={18} />
                    <span>Handlungsbedarf</span>
                </div>
                <h2 className="text-4xl font-bold tracking-tight">{refillCount}</h2>
            </div>
            <div className="text-sm text-orange-100/90 font-medium">
                Booster mit kritischem Bestand & Display an Lager.
            </div>
        </div>

        {/* Card B: PRODUCT SYNC STATUS */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between h-40 relative group">
             <div className="absolute top-4 right-4 text-gray-200 group-hover:text-indigo-100 transition-colors">
                <Package size={40} />
            </div>
            <div>
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Inventory Sync</h3>
                <div className="flex items-center gap-2">
                    {productSync?.status === 'SUCCESS' 
                        ? <CheckCircle2 className="text-emerald-500" size={24} /> 
                        : <XCircle className="text-red-500" size={24} />
                    }
                    {/* CHANGED: Added 'de-CH' to get the 1'000 format */}
                    <span className="text-2xl font-bold text-gray-900">
                        {productSync?.count.toLocaleString('de-CH') || 0}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
                <Activity size={12} />
                <span>Letzter Sync: {formatDate(productSync?.createdAt || null)}</span>
            </div>
        </div>

        {/* Card C: ORDER SYNC STATUS */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between h-40 relative group">
             <div className="absolute top-4 right-4 text-gray-200 group-hover:text-indigo-100 transition-colors">
                <ShoppingCart size={40} />
            </div>
            <div>
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Order History</h3>
                <div className="flex items-center gap-2">
                    {orderSync?.status === 'SUCCESS' 
                        ? <CheckCircle2 className="text-emerald-500" size={24} /> 
                        : <XCircle className="text-red-500" size={24} />
                    }
                    {/* CHANGED: Added 'de-CH' to get the 1'000 format */}
                    <span className="text-2xl font-bold text-gray-900">
                        {orderSync?.count.toLocaleString('de-CH') || 0}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
                <Activity size={12} />
                <span>Letzter Sync: {formatDate(orderSync?.createdAt || null)}</span>
            </div>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD MODULE: BOOSTER REFILL */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Module Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
                    <Box size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-none">Booster Nachfüll-Liste</h2>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-semibold">Modul: Booster Stock</p>
                </div>
            </div>
            <Link 
                href="/boosterStock" 
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
                Zum Modul <ArrowRight size={16} />
            </Link>
        </div>

        {/* Module Content */}
        {urgentRefills.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="bg-emerald-50 p-4 rounded-full mb-4">
                    <CheckCircle2 size={48} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Alles aufgefüllt!</h3>
                <p className="text-gray-500 mt-2 max-w-md">
                    Es gibt keine Booster mit kritischem Bestand (≤ 5), für die Displays im Lager verfügbar sind.
                </p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/30">
                            <th className="px-6 py-4">Produkt</th>
                            <th className="px-6 py-4 text-center">Booster Bestand</th>
                            <th className="px-6 py-4 text-center">Verfügbare Displays</th>
                            <th className="px-6 py-4 text-right">Shopify</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {urgentRefills.slice(0, 8).map((item) => (
                            <tr key={item.boosterId} className="group hover:bg-indigo-50/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-gray-900">{item.boosterTitle}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                        <Layers size={12} /> Source: {item.displayTitle}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center gap-2">
                                        <span className="relative flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span className="text-red-600 font-bold font-mono text-lg">{item.boosterStock}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center justify-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium border border-gray-200">
                                        <Box size={14} className="mr-1.5 text-gray-400" />
                                        {item.displayStock}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <a 
                                        href={`https://admin.shopify.com/store/metamonk/products/${item.boosterParentId.replace('gid://shopify/Product/', '')}/variants/${item.boosterId.replace('gid://shopify/Product/', '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-xs font-bold text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg bg-white transition-all shadow-sm"
                                    >
                                        Edit <TrendingUp size={12} className="ml-1.5" />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {urgentRefills.length > 8 && (
                    <div className="bg-gray-50 border-t border-gray-100 p-3 text-center">
                        <span className="text-sm text-gray-500">
                            ... und {urgentRefills.length - 8} weitere. 
                            <Link href="/boosterStock" className="ml-2 font-medium text-indigo-600 hover:underline">
                                Alle anzeigen
                            </Link>
                        </span>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}