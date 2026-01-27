'use client'

import { useState } from "react";
import { FileJson, Play, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { triggerDebugUrlImport } from "@/app/actions/shopify-bulk-actions";

interface Props {
    type: 'ORDERS' | 'PRODUCTS';
    title: string;
}

export default function ManualImportDebugger({ type, title }: Props) {
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [msg, setMsg] = useState("");

    const handleRun = async () => {
        if (!url) return;
        setStatus("loading");
        setMsg("Starting import...");

        try {
            const res = await triggerDebugUrlImport(type, url);
            if (res.success) {
                setStatus("success");
                setMsg("Import started in background. Check System Status.");
                setUrl(""); // Clear input on success
                // Wake up system panel
                window.dispatchEvent(new Event("system-status-refresh"));
                
                setTimeout(() => {
                    setStatus("idle");
                    setMsg("");
                }, 5000);
            } else {
                setStatus("error");
                setMsg(res.message || "Failed");
            }
        } catch (e: any) {
            setStatus("error");
            setMsg(e.message);
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                <FileJson className={type === 'ORDERS' ? "text-blue-400" : "text-purple-400"} />
                {title}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
                Paste a direct Shopify JSONL download URL here to bypass the API export phase and process the file immediately.
            </p>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={`https://storage.googleapis.com/... (${type.toLowerCase()}.jsonl)`}
                    className="flex-1 bg-gray-950 border border-gray-800 text-gray-200 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                    onClick={handleRun}
                    disabled={!url || status === "loading"}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all ${
                        !url || status === "loading"
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-500 text-white"
                    }`}
                >
                    {status === "loading" ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                    Run
                </button>
            </div>

            {status !== "idle" && (
                <div className={`text-xs flex items-center gap-2 mt-3 ${
                     status === "success" ? "text-green-400" : status === "error" ? "text-red-400" : "text-gray-400"
                }`}>
                    {status === "success" && <CheckCircle size={12} />}
                    {status === "error" && <AlertCircle size={12} />}
                    {msg}
                </div>
            )}
        </div>
    );
}