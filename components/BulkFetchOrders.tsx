'use client'
import { useState, useEffect, useRef } from "react";
import { Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { triggerManualOrderSync } from "@/app/actions/shopify-bulk-actions";
import { SyncMode } from "@/lib/shopify-bulk-orders";
import { getGlobalSystemStatus } from "@/app/actions/shopify-bulk-actions";

interface Props {
    mode: SyncMode;
    label: string;
}

export default function BulkFetchOrders({ mode, label }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  // Poll logic: Only runs when we have an active Op ID
  useEffect(() => {
    if (!activeOpId) return;

    // Poll every 2 seconds to see if our specific job is finished
    pollInterval.current = setInterval(async () => {
        // We use the existing system status check which is efficient
        const res = await getGlobalSystemStatus(Date.now());
        
        // Check if our ID is still in the "activeQuery" slot
        const isActive = res.activeQuery?.id === activeOpId;
        
        // OR check if it appears in history as COMPLETED/FAILED
        const isFinished = res.history.queries.find((q: any) => q.id === activeOpId);

        if (!isActive && isFinished) {
            // It's done!
            setStatus("success");
            setMsg("Sync complete!");
            setActiveOpId(null); // Stop polling
            if (pollInterval.current) clearInterval(pollInterval.current);
            
            // Reset to idle after 3s
            setTimeout(() => {
                setStatus("idle");
                setMsg("");
            }, 3000);
        }
    }, 2000);

    return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [activeOpId]);

  const handleStart = async () => {
    setStatus("loading");
    setMsg("Initializing...");

    try {
      // 1. Start the job
      // We need manualTriggerSync to return the operationId so we can track it!
      // *Requires update to manualTriggerSync return type*
      const res = await triggerManualOrderSync(mode);
      
      if (res.success && res.operationId) {
        setMsg("Sync in progress...");
        setActiveOpId(res.operationId); // <--- This triggers the polling effect
        
        // Wake up the system panel immediately
        window.dispatchEvent(new Event("system-status-refresh"));
      } else {
        throw new Error(res.message || "Failed to start");
      }
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setMsg(e.message);
      setActiveOpId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleStart}
        disabled={status === "loading"}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 w-full shadow-sm ${
            mode === 'ALL_TIME' 
            ? "bg-red-900/20 hover:bg-red-900/40 text-red-200 border border-red-900/50" 
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
        }`}
      >
        {status === "loading" ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
        {status === "loading" ? "Syncing..." : label}
      </button>
      
      {status !== "idle" && (
        <div className={`text-xs flex items-center gap-2 mt-1 px-1 ${
             status === "success" ? "text-green-400" : status === "error" ? "text-red-400" : "text-blue-400"
        }`}>
            {status === "success" && <CheckCircle size={12} />}
            {status === "error" && <AlertCircle size={12} />}
            {status === "loading" && <Loader2 size={12} className="animate-spin" />}
            {msg}
        </div>
      )}
    </div>
  );
}