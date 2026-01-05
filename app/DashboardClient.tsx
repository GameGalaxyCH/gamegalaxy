"use client";

import React from 'react';
import { 
  Package, 
  ShoppingCart, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity
} from 'lucide-react';

// Helper for date formatting if you don't use date-fns library
const formatDate = (dateString: string | Date | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString('de-DE', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

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
}

export default function DashboardClient({ productSync, orderSync }: DashboardProps) {

  // --- REUSABLE CARD COMPONENT ---
  const StatusCard = ({ title, icon: Icon, data }: { title: string, icon: any, data: SyncLog | null }) => {
    const isSuccess = data?.status === 'SUCCESS';
    const isError = data?.status === 'FAILED';
    const hasData = !!data;

    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
        
        {/* Top Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${hasData ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-300'}`}>
              <Icon size={24} />
            </div>
            <div>
              <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">{title}</h3>
              <p className="text-gray-900 font-bold text-lg">
                {hasData ? data.status : "NO DATA"}
              </p>
            </div>
          </div>
          
          {/* Status Icon Indicator */}
          {hasData && (
            <div className={`${isSuccess ? 'text-green-500' : isError ? 'text-red-500' : 'text-gray-400'}`}>
              {isSuccess ? <CheckCircle size={24} /> : <XCircle size={24} />}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 w-full my-4"></div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity size={14} />
              <span>Items Processed</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {hasData ? data.count.toLocaleString() : '-'}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-gray-400 text-xs mb-1">
              <Clock size={14} />
              <span>Last Sync</span>
            </div>
            <div className="text-sm font-medium text-gray-600">
              {formatDate(data?.createdAt || null)}
            </div>
          </div>
        </div>

        {/* Decorative Status Bar at bottom */}
        <div className={`absolute bottom-0 left-0 w-full h-1 ${
          !hasData ? 'bg-gray-200' : isSuccess ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">GG Omnicore Dashboard</h1>
        <p className="text-gray-500 mt-2">System Status</p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard 
          title="Product Inventory Sync" 
          icon={Package} 
          data={productSync} 
        />
        
        <StatusCard 
          title="Order History Sync" 
          icon={ShoppingCart} 
          data={orderSync} 
        />
      </div>

      {/* Empty State / Call to Action Hint */}
      {(!productSync && !orderSync) && (
        <div className="mt-12 p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <p className="text-gray-400">System initialization required. No sync logs found.</p>
        </div>
      )}
    </div>
  );
}