'use client'

import { useState, useEffect } from 'react';
import Flag from 'react-world-flags';
import { fetchMarketData, updateProductUrl, deleteProductUrl } from '@/app/actions/mkm-booster-prices';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  Clock,
  Edit2,
  Check,
  X,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  productId: string;
  productTitle: string;
  vendor?: string | null;
}

// Helper for Flags
// 2. Returns ISO Codes (e.g., 'DE', 'AT')
const getCountryCode = (countryName: string) => {
  if (!countryName) return null;
  const name = countryName.trim();
  const map: Record<string, string> = {
    'Deutschland': 'DE',
    'Österreich': 'AT',
    'Schweiz': 'CH',
    'Frankreich': 'FR',
    'Spanien': 'ES',
    'Italien': 'IT',
    'Vereinigtes Königreich': 'GB',
    'Großbritannien': 'GB',
    'Niederlande': 'NL',
    'Belgien': 'BE',
    'Polen': 'PL',
    'Tschechien': 'CZ',
    'Griechenland': 'GR',
    'Dänemark': 'DK',
    'Schweden': 'SE',
    'Finnland': 'FI',
    'Norwegen': 'NO',
    'Portugal': 'PT',
    'Irland': 'IE',
    'Ungarn': 'HU',
    'Slowakei': 'SK',
    'Malta': 'MT',
    'Litauen': 'LT',
  };

  return map[name] || null;
};

export default function MkmPriceCell({ productId, productTitle, vendor }: Props) {
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [data, setData] = useState<any>(null);
  const [source, setSource] = useState<'cache' | 'live'>('live');

  // Manual URL Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Expand Seller State
  const [isExpanded, setIsExpanded] = useState(false);

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

  // --- RENDER LOADING (Spans 2 columns) ---
  if (status === 'LOADING') {
    return (
      <td colSpan={2} className="p-4 align-middle bg-transparent border-l border-gray-100">
        <div className="flex flex-col items-center justify-center gap-2 h-full py-2">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-xs font-medium text-gray-400 tracking-wide">Preise laden...</span>
        </div>
      </td>
    );
  }

  // --- RENDER ERROR / MANUAL INPUT (Spans 2 columns) ---
  if (status === 'ERROR' || isEditing) {
    return (
      <td colSpan={2} className="p-3 bg-transparent align-top border-l border-gray-100">
        <div className="flex flex-col gap-3 max-w-[90%] mx-auto">
          {status === 'ERROR' && !isEditing && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-100 mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">Kein Preis gefunden</span>
            </div>
          )}

          {/* Manual URL Input Block */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              Cardmarket URL Link
            </label>
            <div className="relative group">
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg p-2 w-full text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                placeholder="https://www.cardmarket.com/..."
              />
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveManualUrl}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" /> Speichern
              </button>

              {/* Delete Button - Only show if we actually have data/URL to delete */}
              {data?.cardmarketUrl && (
                <button
                  onClick={handleDeleteUrl}
                  className="bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 px-2.5 rounded-md border border-gray-200 hover:border-red-200 transition-colors flex items-center justify-center"
                  title="Gespeicherte URL löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {isEditing && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 px-2.5 rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-[10px] text-gray-400 hover:text-blue-500 font-medium underline decoration-dotted underline-offset-2 self-start transition-colors">
              URL manuell zuweisen
            </button>
          )}
        </div>
      </td>
    );
  }

  // --- RENDER SUCCESS (Splits into 2 columns) ---
  if (status === 'SUCCESS' && data) {
    const listings = (data.topListings || []) as any[];
    const finalUrl = data.cardmarketUrl;

    // Check if data is from today (visual cue)
    const lastScrape = new Date(data.lastScrapedAt);
    const isToday = lastScrape.toDateString() === new Date().toDateString();

    const displayListings = isExpanded ? listings : listings.slice(0, 1);

    return (
      <>
        {/* COLUMN 1: PRICE & ACTIONS */}
        <td className="p-0 align-top border-l border-gray-100 bg-transparent min-w-[200px] relative group/cell">

          <div className="flex flex-row items-start justify-between p-3.5">

            {/* Left: Data Stack */}
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Erster Preis
              </span>

              <span className="text-xl font-bold text-emerald-600 tracking-tight leading-none my-0.5">
                {Number(data.lowestPrice).toFixed(2)} <span className="text-sm font-semibold text-emerald-600/60">€</span>
              </span>

              {/* Timestamp */}
              <div className="flex items-center gap-1 text-[9px] text-gray-400" title={`Aktualisiert: ${lastScrape.toLocaleString()}`}>
                <Clock className="w-2.5 h-2.5" />
                {isToday ? "Heute" : lastScrape.toLocaleDateString()}
              </div>
            </div>

            {/* Right: Buy Button & Controls */}
            <div className="pl-3 flex flex-col items-end gap-3 mt-1.5">
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold py-2 px-3 rounded-md shadow-sm hover:shadow transition-all group/btn whitespace-nowrap"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-white/80 group-hover/btn:text-white" />
                <span>Öffnen</span>
              </a>

              {/* Controls (Edit/Refresh) - Moved below button, hidden until hover */}
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setManualUrl(finalUrl);
                    setIsEditing(true);
                  }}
                  className="p-1 rounded bg-white hover:bg-gray-100 text-gray-300 hover:text-slate-600 transition-colors border border-transparent hover:border-gray-200"
                  title="URL bearbeiten"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => loadData(true)}
                  className="p-1 rounded bg-white hover:bg-gray-100 text-gray-300 hover:text-slate-600 transition-colors border border-transparent hover:border-gray-200"
                  title="Aktualisieren"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>
        </td>

        {/* COLUMN 2: VENDORS */}
        <td className="p-3 bg-transparent align-top border-l border-dashed border-gray-100 min-w-[240px]">
          {listings.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <table className="w-full text-xs table-fixed">
                  <tbody className="divide-y divide-gray-50/50">
                    {displayListings.map((item: any, idx: number) => {
                      // Get the code (e.g., "DE")
                      const countryCode = getCountryCode(item.location);

                      return (
                        <tr key={idx} className="group/row">
                          <td className="py-1.5 pr-2 w-auto">
                            <div className="font-semibold text-gray-700 truncate max-w-[100px]" title={item.seller}>
                              {item.seller}
                            </div>
                            <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                              {countryCode ? (
                                <Flag
                                  code={countryCode}
                                  className="w-3 h-3 rounded-[1px] shadow-sm object-cover"
                                  fallback={<span>🌍</span>}
                                />
                              ) : (
                                <span className="text-[10px]">🌍</span>
                              )}

                              <span>{item.location}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center w-[60px]">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-50 text-gray-600 border border-gray-100 whitespace-nowrap">
                              {item.stock} Stk.
                            </span>
                          </td>
                          <td className="py-1.5 pl-2 text-right w-[80px]">
                            <span className="font-mono font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {item.formatted}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {listings.length > 1 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center justify-center gap-1 w-full text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-blue-500 hover:bg-blue-50/50 py-1.5 mt-2 rounded transition-colors"
                >
                  {isExpanded ? (
                    <>Weniger <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>+ {listings.length - 1} Weitere <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-xs text-gray-300 italic px-4 py-2 bg-gray-50 rounded-full">Keine Angebote</span>
            </div>
          )}
        </td>
      </>
    );
  }

  return null;
}