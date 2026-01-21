'use client'

import { useState, useEffect } from 'react';
import { fetchMarketData, updateProductUrl, deleteProductUrl } from '@/app/actions/mkm-booster-prices';
import { Loader2, RefreshCw, AlertTriangle, ShoppingCart, Clock, Edit2, Check, X, MapPin, Layers, Trash2 } from 'lucide-react';

interface Props {
  productId: string;
  productTitle: string;
  vendor?: string | null;
}

export default function MkmPriceCell({ productId, productTitle, vendor }: Props) {
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [data, setData] = useState<any>(null);
  const [source, setSource] = useState<'cache' | 'live'>('live');
  
  // Manual URL Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const loadData = async (force = false) => {
    setStatus('LOADING');
    try {
      const result = await fetchMarketData(productId, force);
      
      if (result.success) {
        setData(result.data);
        setSource(result.source || 'live');
        setStatus('SUCCESS');
        // If we have a saved URL, sync the manual input to it
        if (result.data.cardmarketUrl) {
            setManualUrl(result.data.cardmarketUrl);
        }
      } else {
        setStatus('ERROR');
      }
    } catch (e) {
      setStatus('ERROR');
    }
  };

  const handleSaveManualUrl = async () => {
    if (!manualUrl) return;
    setStatus('LOADING');
    const saveResult = await updateProductUrl(productId, manualUrl);
    if (saveResult.success) {
        setIsEditing(false);
        // Force refresh to scrape the new URL immediately
        loadData(true);
    } else {
        alert("Failed to save URL");
        setStatus('ERROR');
    }
  };

  const handleDeleteUrl = async () => {
    if (!confirm("Möchtest du die gespeicherte URL wirklich löschen?")) return;
    
    setStatus('LOADING');
    const res = await deleteProductUrl(productId);
    
    if (res.success) {
        setManualUrl('');
        setIsEditing(false);
        // Force refresh to trigger a fresh URL generation/scrape
        loadData(true); 
    } else {
        alert("Fehler beim Löschen");
        setStatus('ERROR');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- RENDER LOADING ---
  if (status === 'LOADING') {
    return (
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-medium">Lade Preise...</span>
        </div>
      </div>
    );
  }

  // --- RENDER ERROR / MANUAL INPUT ---
  if (status === 'ERROR' || isEditing) {
    return (
      <div className="min-w-[220px] p-2 bg-red-50/50 rounded flex flex-col gap-2">
        {status === 'ERROR' && !isEditing && (
            <div className="flex items-center gap-1 text-red-500 text-xs mb-1">
                <AlertTriangle className="w-3 h-3" /> 
                <span>Nicht gefunden</span>
            </div>
        )}

        {/* Manual URL Input Block */}
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">
                Cardmarket URL manuell
            </label>
            <input 
                type="text" 
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="text-xs border rounded p-1 w-full text-gray-700 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="https://www.cardmarket.com/..."
            />
            <div className="flex gap-2 mt-1">
                <button 
                    onClick={handleSaveManualUrl}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 rounded flex items-center justify-center gap-1"
                >
                    <Check className="w-3 h-3" /> Speichern
                </button>
                
                {/* Delete Button - Only show if we actually have data/URL to delete */}
                {data?.cardmarketUrl && (
                    <button 
                        onClick={handleDeleteUrl}
                        className="bg-red-100 hover:bg-red-200 text-red-600 px-2 rounded border border-red-200 flex items-center justify-center"
                        title="Gespeicherte URL löschen"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}

                {isEditing && (
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-2 rounded"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
        
        {!isEditing && (
             <button onClick={() => setIsEditing(true)} className="text-[10px] text-gray-400 underline self-start mt-1">
                URL bearbeiten
             </button>
        )}
      </div>
    );
  }

  // --- RENDER SUCCESS ---
  if (status === 'SUCCESS' && data) {
    const listings = (data.topListings || []) as any[];
    const finalUrl = data.cardmarketUrl;
    
    // Check if data is from today (visual cue)
    const lastScrape = new Date(data.lastScrapedAt);
    const isToday = lastScrape.toDateString() === new Date().toDateString();

    return (
      <div className="min-w-[280px] p-2 flex flex-col gap-3 group relative">
        
        {/* Header: Price & Controls */}
        <div className="flex justify-between items-center border-b pb-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
               Erster Preis
            </span>
            <span className="text-lg font-bold text-green-700">
                € {Number(data.lowestPrice).toFixed(2)}
            </span>
            {/* Visual Cache Indicator */}
            <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-0.5" title={`Last updated: ${lastScrape.toLocaleString()}`}>
              <Clock className="w-3 h-3" />
              {isToday ? "Heute" : lastScrape.toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-1">
            {/* Edit URL Button (Hidden by default, shown on hover) */}
            <button 
                onClick={() => {
                    setManualUrl(finalUrl);
                    setIsEditing(true);
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                title="URL bearbeiten"
            >
                <Edit2 className="w-3 h-3" />
            </button>

            {/* Refresh Button */}
            <button 
                onClick={() => loadData(true)} 
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                title="Aktualisieren"
            >
                <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Listings Table */}
        {listings.length > 0 && (
          <div className="bg-gray-50 rounded border border-gray-200 overflow-hidden">
             <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-500">
                    <tr>
                        <th className="p-1.5 text-left font-normal">Verkäufer</th>
                        <th className="p-1.5 text-center font-normal" title="Location">Standort</th>
                        <th className="p-1.5 text-center font-normal" title="Available Stock">Menge</th>
                        <th className="p-1.5 text-right font-normal">Preis</th>
                    </tr>
                </thead>
                <tbody>
                  {listings.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-white">
                      <td className="p-1.5 font-medium text-gray-700 truncate max-w-[80px]">{item.seller}</td>
                      <td className="p-1.5 text-center text-gray-500">{item.location || '?'}</td>
                      <td className="p-1.5 text-center text-gray-600">{item.stock || '-'}</td>
                      <td className="p-1.5 text-right font-mono text-gray-600 font-bold">{item.formatted}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

        {/* Buy Button */}
        <a 
          href={finalUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-3 rounded shadow-sm transition-all"
        >
          <ShoppingCart className="w-3 h-3" />
          Auf MKM Kaufen
        </a>
      </div>
    );
  }

  return null;
}