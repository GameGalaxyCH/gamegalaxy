'use client'

import { useEffect, useState } from "react";
import {
    Activity,
    CheckCircle,
    AlertTriangle,
    Loader2,
    XOctagon,
    Clock,
    Database,
    FileJson,
    Download,
    Copy,
    FileText
} from "lucide-react";
import { getGlobalSystemStatus, cancelOperation } from "@/app/actions/shopify-bulk-actions";

export default function SystemStatusPanel() {
    const [data, setData] = useState<any>({
        activeQuery: null,
        activeMutation: null,
        history: { queries: [], mutations: [] }
    });
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [totalOrders, setTotalOrders] = useState<number>(0);

    const fetchStatus = async () => {
        const res = await getGlobalSystemStatus();
        setData(res);
        setLoading(false);
    };

    useEffect(() => {
        // 1. Initial Load
        fetchStatus();

        // 2. Poll every 5s
        const interval = setInterval(fetchStatus, 5000);

        // 3. Listen for manual triggers from other buttons
        const handleManualRefresh = () => {
            console.log("Manual refresh triggered!");
            fetchStatus();
        };
        window.addEventListener("system-status-refresh", handleManualRefresh);

        // Cleanup
        return () => {
            clearInterval(interval);
            window.removeEventListener("system-status-refresh", handleManualRefresh);
        };
    }, []);

    const handleCancel = async (id: string) => {
        if (!confirm("⚠️ CAUTION: Force stopping a bulk operation may result in partial data. Continue?")) return;

        setCancelling(id);
        const res = await cancelOperation(id);
        if (!res.success) {
            alert("Failed to cancel: " + res.message);
        } else {
            fetchStatus(); // Refresh immediately
        }
        setCancelling(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Optional: You could add a toast notification here
        // alert("Copied to clipboard!"); 
    };

    // Helper: Progress Percentage
    const getProgress = (current: number) => {
        if (!totalOrders || totalOrders === 0) return 0;
        const p = (current / totalOrders) * 100;
        return Math.min(100, p).toFixed(1);
    };

    // Helper: Status Colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case "RUNNING": return "text-blue-400";
            case "IMPORTING": return "text-purple-400";
            case "CREATED": return "text-yellow-400";
            case "COMPLETED": return "text-green-400";
            case "FAILED": return "text-red-400";
            case "CANCELLING": return "text-orange-400";
            default: return "text-gray-400";
        }
    };

    if (loading && !data.history.queries.length) return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 animate-pulse">
            <div className="h-6 w-32 bg-gray-800 rounded mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-32 bg-gray-800 rounded-lg"></div>
                <div className="h-32 bg-gray-800 rounded-lg"></div>
            </div>
        </div>
    );

    // --- RENDER ACTIVE CARD ---
    const renderActiveCard = (op: any, title: string, type: 'QUERY' | 'MUTATION') => {
        const isRunning = op && op.status === "RUNNING";
        const isImporting = op && op.status === "IMPORTING";
        const isCreated = op && op.status === "CREATED";
        const isCancelling = op && op.status === "CANCELLING";
        const isFailed = op && op.status === "FAILED";

        const isActive = isRunning || isCreated || isCancelling || isImporting;

        return (
            <div className={`p-5 rounded-lg border flex flex-col justify-between transition-all relative overflow-hidden ${isActive ? "bg-blue-950/20 border-blue-900/40" :
                isFailed ? "bg-red-950/10 border-red-900/30" :
                    "bg-gray-950/40 border-gray-800"
                }`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isActive ? "bg-blue-500/10 text-blue-400" : "bg-gray-800/50 text-gray-500"}`}>
                            {type === 'QUERY' ? <Database size={18} /> : <FileJson size={18} />}
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">{title}</div>
                            <div className={`text-sm font-bold mt-0.5 ${getStatusColor(op ? op.status : "IDLE")}`}>
                                {op ? op.status : "IDLE"}
                            </div>
                        </div>
                    </div>

                    {isRunning && <Loader2 className="animate-spin text-blue-500" size={20} />}
                    {isImporting && <Loader2 className="animate-spin text-purple-500" size={20} />}
                    {isCreated && <Clock className="animate-pulse text-yellow-500" size={20} />}
                    {isCancelling && <AlertTriangle className="animate-pulse text-orange-500" size={20} />}
                    {(!op || op.status === "COMPLETED") && <CheckCircle className="text-gray-700" size={20} />}
                    {isFailed && <XOctagon className="text-red-500" size={20} />}
                </div>

                {/* Details Section */}
                {op ? (
                    <div className="space-y-3 pt-2 border-t border-gray-800/50">

                        {/* 1. URL Bar (If available) */}
                        {op.url && (
                            <div className="p-2 bg-gray-950 rounded border border-gray-800 flex items-center justify-between group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Download size={12} className="text-blue-400 flex-shrink-0" />
                                    <span className="text-[10px] text-gray-400 truncate font-mono">{op.url.split('?')[0]}...</span>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(op.url)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                    title="Copy URL"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                        )}

                        {/* 2. Stats Grid / Progress */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col">
                                <span className="text-gray-500">Progress</span>
                                <div className="flex items-end gap-2">
                                    <span className="text-gray-200 font-mono text-lg">
                                        {parseInt(op.rootObjectCount || 0).toLocaleString()}
                                    </span>
                                    {/* Show " / Total (%)" only for Queries where we know the total */}
                                    {type === 'QUERY' && totalOrders > 0 && (
                                        <span className="text-gray-500 text-xs mb-1">
                                            / {totalOrders.toLocaleString()} ({getProgress(parseInt(op.rootObjectCount))}%)
                                        </span>
                                    )}
                                </div>

                                <div className="text-[10px] text-gray-600 mt-0.5">
                                    Total Nodes: {parseInt(op.objectCount || 0).toLocaleString()}
                                </div>

                                {/* Visual Progress Bar */}
                                {type === 'QUERY' && totalOrders > 0 && (
                                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-full transition-all duration-500"
                                            style={{ width: `${getProgress(parseInt(op.rootObjectCount))}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>

                            {op.fileSize && (
                                <div className="flex flex-col text-right">
                                    <span className="text-gray-500">File Size</span>
                                    <span className="text-gray-400 font-mono text-lg">
                                        {(parseInt(op.fileSize) / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 3. Footer Info */}
                        <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                            <span>ID: ...{op.id.split('/').pop()}</span>
                            <span>{new Date(op.createdAt).toLocaleTimeString()}</span>
                        </div>

                        {/* 4. Error Message (If Failed) */}
                        {isFailed && op.errorCode && (
                            <div className="bg-red-950/30 text-red-400 text-[10px] p-2 rounded border border-red-900/50 flex items-start gap-2">
                                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                <span>Error: {op.errorCode}</span>
                            </div>
                        )}

                        {/* 5. Cancel Button */}
                        {isActive && (
                            <button
                                onClick={() => handleCancel(op.id)}
                                disabled={!!cancelling}
                                className="w-full mt-2 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
                            >
                                {cancelling === op.id ? <Loader2 className="animate-spin" size={12} /> : <XOctagon size={12} />}
                                {isCancelling ? "Stopping..." : "Cancel Operation"}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-gray-600 italic py-2">
                        No active background jobs found.
                    </div>
                )}
            </div>
        );
    };

    // --- RENDER HISTORY TABLE ---
    const renderHistoryTable = (items: any[], title: string) => (
        <div className="mt-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} /> {title} History
            </h3>
            <div className="overflow-hidden rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs text-gray-400">
                    <thead className="bg-gray-900 text-gray-500 font-medium">
                        <tr>
                            <th className="p-3">Status</th>
                            <th className="p-3">Items (Roots)</th>
                            <th className="p-3">Size</th>
                            <th className="p-3">Created</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/50">
                        {items.length === 0 ? (
                            <tr><td colSpan={5} className="p-4 text-center italic text-gray-600">No history found.</td></tr>
                        ) : items.map((op) => (
                            <tr key={op.id} className="hover:bg-gray-900/50 transition-colors">
                                <td className={`p-3 font-semibold ${getStatusColor(op.status)}`}>
                                    {op.status}
                                </td>
                                <td className="p-3 font-mono text-gray-300">
                                    <div className="flex flex-col">
                                        <span className="text-gray-200">
                                            {op.rootObjectCount ? op.rootObjectCount.toLocaleString() : '-'}
                                        </span>
                                        <span className="text-[10px] text-gray-600">
                                            Nodes: {op.objectCount ? op.objectCount.toLocaleString() : '-'}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 font-mono text-gray-300">
                                    {op.fileSize ? `${(parseInt(op.fileSize) / 1024 / 1024).toFixed(2)} MB` : '-'}
                                </td>
                                <td className="p-3 text-gray-500">
                                    {new Date(op.createdAt).toLocaleString()}
                                </td>
                                <td className="p-3 text-right">
                                    {op.url && op.status === 'COMPLETED' ? (
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Copy URL Button */}
                                            <button
                                                onClick={() => copyToClipboard(op.url)}
                                                className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                                                title="Copy Link"
                                            >
                                                <Copy size={14} />
                                            </button>

                                            {/* Download Link */}
                                            <a
                                                href={op.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 text-xs rounded border border-blue-900/50 transition-colors"
                                            >
                                                <Download size={12} />
                                                <span>JSONL</span>
                                            </a>
                                        </div>
                                    ) : (
                                        <span className="text-gray-700">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-900/20 rounded-lg">
                    <Activity size={20} className="text-purple-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">System Status</h2>
                    <p className="text-xs text-gray-400">Live monitoring (Updates every 5s)</p>
                </div>
            </div>

            {/* Active Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderActiveCard(data.activeQuery, "Bulk Export (Reads)", 'QUERY')}
                {renderActiveCard(data.activeMutation, "Bulk Import (Writes)", 'MUTATION')}
            </div>

            {/* History Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-gray-800/50 pt-2">
                {renderHistoryTable(data.history.queries, "Recent Export")}
                {renderHistoryTable(data.history.mutations, "Recent Import")}
            </div>
        </div>
    );
}