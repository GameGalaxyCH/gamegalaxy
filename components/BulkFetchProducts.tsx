//
'use client'

import { useState } from "react";
import { Database, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { startBulkOrderSync, checkBulkStatus, processBulkFile, SyncMode } from "@/app/actions/bulk-orders";

interface Props {
    mode: SyncMode;
    label: string;
}

export default function BulkFetchOrders({ mode, label }: Props) {
  // Status state: 'idle' | 'working' | 'done' | 'error'
  const [isWorking, setIsWorking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'info'|'success'|'error', text: string} | null>(null);

  const handleStart = async () => {
    try {
      setIsWorking(true);
      setStatusMsg({ type: 'info', text: "Phase 1: Requesting Bulk Operation..." });
      
      // 1. Start
      const startRes = await startBulkOrderSync(mode);
      if (!startRes.success) throw new Error(startRes.message);
      
      const opId = startRes.operationId;
      setStatusMsg({ type: 'info', text: "Phase 2: Waiting for Shopify..." });

      // 2. Poll
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        
        // Safety Timeout (5 min local app timeout)
        if (attempts > 150) {
            clearInterval(pollInterval);
            setIsWorking(false);
            setStatusMsg({ type: 'error', text: "Timeout: Local app stopped polling (5m)." });
            return;
        }

        const pollRes = await checkBulkStatus(opId);
        
        // CASE: RUNNING
        if (pollRes.status === "RUNNING" || pollRes.status === "CREATED") {
             setStatusMsg({ type: 'info', text: `Shopify Processing... (${pollRes.objectCount || 0} items)` });
        }
        
        // CASE: COMPLETED
        else if (pollRes.status === "COMPLETED") {
          clearInterval(pollInterval);
          
          if (!pollRes.url) {
            setIsWorking(false);
            setStatusMsg({ type: 'error', text: "Error: Completed but no download URL." });
            return;
          }

          setStatusMsg({ type: 'info', text: "Phase 3: Downloading & Saving..." });
          
          const processRes = await processBulkFile(pollRes.url);
          
          setIsWorking(false);
          if (processRes.success) {
            setStatusMsg({ type: 'success', text: `Success! Synced ${processRes.count} orders.` });
          } else {
            setStatusMsg({ type: 'error', text: processRes.message });
          }
        } 
        
        // CASE: FAILED / CANCELED / EXPIRED
        else if (pollRes.status === "FAILED" || pollRes.status === "CANCELED" || pollRes.status === "EXPIRED") {
          clearInterval(pollInterval);
          setIsWorking(false);
          
          // SHOW THE REAL ERROR CODE
          const code = pollRes.errorCode || "UNKNOWN_ERROR";
          setStatusMsg({ type: 'error', text: `Failed: ${code} (Processed ${pollRes.objectCount} items)` });
        }
        
      }, 2000); 

    } catch (e: any) {
      console.error(e);
      setIsWorking(false);
      setStatusMsg({ type: 'error', text: e.message || "Unexpected error." });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleStart}
        disabled={isWorking}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all w-full shadow-sm ${
            isWorking 
            ? "bg-gray-800 cursor-not-allowed text-gray-400 border border-gray-700"
            : mode === 'ALL_TIME' 
                ? "bg-red-900/20 hover:bg-red-900/40 text-red-200 border border-red-900/50" 
                : "bg-blue-600 hover:bg-blue-500 text-white border border-transparent shadow-blue-900/20"
        }`}
      >
        {isWorking ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
        {isWorking ? "Processing..." : label}
      </button>
      
      {/* Status Message Area */}
      {statusMsg && (
        <div className={`text-xs flex items-center gap-2 mt-1 px-1 font-mono ${
            statusMsg.type === 'success' ? "text-green-400" : 
            statusMsg.type === 'error' ? "text-red-400" : 
            "text-blue-300"
        }`}>
            {statusMsg.type === 'success' && <CheckCircle size={12} />}
            {statusMsg.type === 'error' && <AlertCircle size={12} />}
            {statusMsg.type === 'info' && <Loader2 className="animate-spin" size={12} />}
            {statusMsg.text}
        </div>
      )}
    </div>
  );
}