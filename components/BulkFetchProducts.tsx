'use client'

import { useState, useEffect, useRef } from "react";
import { Database, Loader2, CheckCircle, AlertCircle, Package } from "lucide-react";
import { triggerManualProductSync } from "@/app/actions/shopify-bulk-actions";
import { SyncMode } from "@/lib/shopify-bulk-products";
import { getGlobalSystemStatus } from "@/app/actions/shopify-bulk-actions";

interface Props {
    mode: SyncMode;
    label: string;
}

export default function BulkFetchProducts({ mode, label }: Props) {
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

    pollInterval.current = setInterval(async () => {
        // Use the global system status check
        const res = await getGlobalSystemStatus(Date.now());
        
        // Check if our ID is the "activeQuery"
        const isActive = res.activeQuery?.id === activeOpId;
        
        // OR check if it appears in history as COMPLETED
        const isFinished = res.history.queries.find((q: any) => q.id === activeOpId);

        if (!isActive && isFinished) {
            // It's done!
            setStatus("success");
            setMsg(`Sync complete! (${isFinished.objectCount} items)`);
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
      const res = await triggerManualProductSync(mode);
      
      if (res.success && res.operationId) {
        setMsg("Sync in progress...");
        setActiveOpId(res.operationId); // <--- Triggers polling
        
        // Wake up system panel
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event("system-status-refresh"));
        }
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
            ? "bg-purple-900/20 hover:bg-purple-900/40 text-purple-200 border border-purple-900/50" 
            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20"
        }`}
      >
        {status === "loading" ? <Loader2 className="animate-spin" size={16} /> : <Package size={16} />}
        {status === "loading" ? "Syncing..." : label}
      </button>
      
      {status !== "idle" && (
        <div className={`text-xs flex items-center gap-2 mt-1 px-1 ${
             status === "success" ? "text-green-400" : status === "error" ? "text-red-400" : "text-indigo-400"
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