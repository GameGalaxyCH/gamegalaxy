'use client'

import { useState } from "react";
import { Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { startBulkOrderSync, checkBulkStatus, processBulkFile, SyncMode } from "@/app/actions/bulk-orders";

interface Props {
    mode: SyncMode;
    label: string;
}

export default function BulkFetchOrders({ mode, label }: Props) {
  const [status, setStatus] = useState<"idle" | "starting" | "polling" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const handleStart = async () => {
    try {
      // --- PHASE 1: INITIATION ---
      setStatus("starting");
      setMsg("Phase 1: Requesting Bulk Operation ID...");
      
      const startRes = await startBulkOrderSync(mode);
      if (!startRes.success) throw new Error(startRes.message);
      
      const opId = startRes.operationId;
      setStatus("polling");
      setMsg("Phase 2: Waiting for Shopify to prepare file...");

      // --- PHASE 2: POLLING (with Timeout) ---
      let attempts = 0;
      const maxAttempts = 150; // 150 * 2s = 300s (5 minutes) timeout safety

      const pollInterval = setInterval(async () => {
        attempts++;
        
        // Safety Break: Stop if taking too long
        if (attempts > maxAttempts) {
            clearInterval(pollInterval);
            setStatus("error");
            setMsg("Error: Timeout. Shopify took >5 minutes.");
            return;
        }

        const pollRes = await checkBulkStatus(opId);
        
        // Handle "RUNNING" state to show progress
        if (pollRes.status === "RUNNING") {
             setMsg(`Phase 2: Shopify Processing... (${pollRes.objectCount} items)`);
        }
        
        if (pollRes.status === "COMPLETED") {
          clearInterval(pollInterval);
          
          if (!pollRes.url) {
            setStatus("error");
            setMsg("Error: Shopify completed but returned no URL.");
            return;
          }

          // --- PHASE 3: PROCESSING ---
          setStatus("processing");
          setMsg("Phase 3: Downloading and saving to database...");
          
          const processRes = await processBulkFile(pollRes.url);
          
          if (processRes.success) {
            setStatus("done");
            setMsg(`Success! Synced ${processRes.count} orders.`);
          } else {
            throw new Error(processRes.message);
          }

        } else if (pollRes.status === "FAILED") {
          clearInterval(pollInterval);
          throw new Error(`Bulk Operation Failed: ${pollRes.errorCode}`);
        }
        // If status is CREATED or RUNNING, the loop continues...
      }, 2000); 

    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setMsg(e.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleStart}
        disabled={status !== "idle" && status !== "done" && status !== "error"}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full shadow-sm ${
            mode === 'ALL_TIME' 
            ? "bg-red-900/20 hover:bg-red-900/40 text-red-200 border border-red-900/50" 
            : "bg-blue-600 hover:bg-blue-500 text-white border border-transparent shadow-blue-900/20"
        }`}
      >
        {status === "idle" || status === "done" || status === "error" ? <Database size={16} /> : <Loader2 className="animate-spin" size={16} />}
        {label}
      </button>
      
      {status !== "idle" && (
        <div className={`text-xs flex items-center gap-2 mt-1 px-1 ${
            status === "done" ? "text-green-400" : 
            status === "error" ? "text-red-400" : 
            "text-gray-400"
        }`}>
            {status === "done" && <CheckCircle size={12} />}
            {status === "error" && <AlertCircle size={12} />}
            {msg}
        </div>
      )}
    </div>
  );
}