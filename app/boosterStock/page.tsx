'use client'

import { useEffect, useState, useMemo } from 'react';
import { getBoosterStockReport, BoosterStockReport } from '@/app/actions/get-booster-stock';
import { getFilterPresets, saveFilterPreset, deleteFilterPreset } from '@/app/actions/filter-presets';
import { 
  Loader2, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle, 
  Box, 
  Save, 
  Trash2, 
  Tag, 
  Plus 
} from "lucide-react";

interface Preset {
  id: string;
  name: string;
  settings: {
    maxBooster: number;
    displayCheck: boolean;
  };
}

export default function BoosterBestandPage() {
  // --- Data State ---
  const [data, setData] = useState<BoosterStockReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Filter State (Manual Control) ---
  const [maxBoosterFilter, setMaxBoosterFilter] = useState<number>(0); 
  const [displayCheckFilter, setDisplayCheckFilter] = useState<boolean>(true);

  // --- Preset State ---
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  // --- 1. INITIAL FETCH (Data & Presets) ---
  const fetchData = async () => {
    setLoading(true);
    setError("");
    
    // Parallel Fetch for speed
    const [stockRes, presetRes] = await Promise.all([
      getBoosterStockReport(),
      getFilterPresets("BOOSTER_STOCK")
    ]);
    
    // Handle Stock Data
    if (stockRes.success && stockRes.data) {
      setData(stockRes.data);
    } else {
      setError(stockRes.error || "Ein unbekannter Fehler ist aufgetreten.");
    }

    // Handle Presets
    if (presetRes.success && presetRes.data) {
      // Need to cast JSON back to typed object safely
      const mappedPresets = presetRes.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        settings: p.settings as { maxBooster: number; displayCheck: boolean }
      }));
      setPresets(mappedPresets);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. PRESET ACTIONS ---
  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    setIsSaving(true);

    const settings = { maxBooster: maxBoosterFilter, displayCheck: displayCheckFilter };
    const res = await saveFilterPreset(newPresetName, "BOOSTER_STOCK", settings);

    if (res.success && res.data) {
      // Add to local list immediately
      setPresets([{ 
        id: res.data.id, 
        name: res.data.name, 
        settings: settings 
      }, ...presets]);
      setNewPresetName("");
      setShowSaveInput(false);
    }
    setIsSaving(false);
  };

  const handleApplyPreset = (preset: Preset) => {
    setMaxBoosterFilter(preset.settings.maxBooster);
    setDisplayCheckFilter(preset.settings.displayCheck);
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering "Apply" when clicking delete
    const res = await deleteFilterPreset(id);
    if (res.success) {
      setPresets(presets.filter(p => p.id !== id));
    }
  };

  // --- 3. FILTERING LOGIC (Legacy) ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const boosterCondition = item.boosterStock <= maxBoosterFilter;
      const displayCondition = !displayCheckFilter || (displayCheckFilter && item.displayStock >= 1);
      return boosterCondition && displayCondition;
    });
  }, [data, maxBoosterFilter, displayCheckFilter]);

  const getCleanId = (gid: string) => gid.replace('gid://shopify/Product/', '');

  // --- RENDER ---
  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      {/* CENTERED LAYOUT CONTAINER 
        max-w-7xl limits width on huge screens.
        mx-auto centers it within the available space.
      */}
      <div className="max-w-7xl mx-auto p-8">
      
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Box className="text-indigo-600" size={32} />
              Booster Bestand
            </h1>
            <p className="text-gray-500 mt-1">
              Übersicht der Einzel-Booster verknüpft mit Displays.
            </p>
          </div>
          
          <button 
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-sm text-gray-700"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Daten aktualisieren
          </button>
        </div>

        {/* CONTROLS CARD */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
          
          {/* SECTION A: PRESETS (Quick Filters) */}
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Tag size={12} />
                Schnellfilter
              </span>

              {/* Preset Chips */}
              {presets.map(preset => (
                <div 
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer transition-all shadow-sm"
                >
                  {preset.name}
                  <button 
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    title="Löschen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {/* Add New Preset Button */}
              {!showSaveInput ? (
                <button 
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus size={14} />
                  <span>Speichern</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                  <input 
                    type="text" 
                    placeholder="Filter Name..." 
                    autoFocus
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="px-2 py-1 text-sm border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none w-40"
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  />
                  <button 
                    onClick={handleSavePreset}
                    disabled={isSaving}
                    className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save size={14} />
                  </button>
                  <button 
                    onClick={() => setShowSaveInput(false)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION B: MANUAL CONTROLS */}
          <div className="p-6 flex flex-wrap gap-8 items-end">
            
            {/* Input 1: Max Booster */}
            <div className="flex flex-col gap-2">
              <label htmlFor="maxBooster" className="text-sm font-semibold text-gray-700">
                Max. Booster Bestand
              </label>
              <div className="relative">
                <input
                  id="maxBooster"
                  type="number"
                  min="0"
                  value={maxBoosterFilter}
                  onChange={(e) => setMaxBoosterFilter(parseInt(e.target.value) || 0)}
                  className="pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-40 outline-none text-lg font-medium text-gray-800"
                />
              </div>
              <span className="text-xs text-gray-400">Zeigt Booster ≤ diesem Wert</span>
            </div>

            {/* Input 2: Display Check */}
            <div className="flex flex-col gap-2 pb-1">
              <label className="text-sm font-semibold text-gray-700">
                Display Filter
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${displayCheckFilter ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                  {displayCheckFilter && <Box size={12} className="text-white" />}
                </div>
                <input 
                  type="checkbox"
                  checked={displayCheckFilter}
                  onChange={(e) => setDisplayCheckFilter(e.target.checked)}
                  className="hidden" // Hiding default checkbox for custom style
                />
                <span className="text-sm font-medium text-gray-700 select-none">
                  Nur verfügbare Displays
                </span>
              </label>
            </div>

            {/* Result Counter */}
            <div className="ml-auto flex flex-col items-end pb-1">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">
                {filteredData.length}
              </span>
              <span className="text-sm text-gray-500 font-medium">
                Treffer von {data.length}
              </span>
            </div>
          </div>
        </div>

        {/* RESULTS TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
              <p className="font-medium">Datenbank wird gescannt...</p>
            </div>
          ) : error ? (
            <div className="p-20 flex flex-col items-center justify-center text-red-500">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                <AlertTriangle size={32} />
              </div>
              <p className="font-medium">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <Box size={48} className="mb-4 text-gray-300" />
              <p className="font-medium text-lg">Keine Treffer</p>
              <p className="text-sm">Versuche die Filterkriterien anzupassen.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-gray-100 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4 border-b border-gray-800">Booster Name</th>
                    <th className="p-4 border-b border-gray-800 text-center">Booster Bestand</th>
                    <th className="p-4 border-b border-gray-800">Display Name</th>
                    <th className="p-4 border-b border-gray-800 text-center">Display Bestand</th>
                    <th className="p-4 border-b border-gray-800 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row) => (
                    <tr key={row.boosterId} className="hover:bg-indigo-50/30 transition-colors group">
                      
                      {/* Booster Title */}
                      <td className="p-4 text-sm font-medium text-gray-900">
                        {row.boosterTitle}
                      </td>

                      {/* Booster Stock */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                          row.boosterStock <= 5 
                            ? 'bg-red-100 text-red-700 border border-red-200' 
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.boosterStock}
                        </span>
                      </td>

                      {/* Display Title */}
                      <td className="p-4 text-sm text-gray-500">
                        {row.displayTitle}
                      </td>

                      {/* Display Stock */}
                      <td className="p-4 text-center">
                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {row.displayStock}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={`https://admin.shopify.com/store/metamonk/products/${getCleanId(row.boosterParentId)}/variants/${getCleanId(row.boosterId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                            title="Booster in Shopify"
                          >
                            <ExternalLink size={16} />
                          </a>
                          
                          <a 
                             href={`https://admin.shopify.com/store/metamonk/products/${getCleanId(row.displayParentId)}/variants/${getCleanId(row.displayId)}`}
                             target="_blank"
                             rel="noreferrer"
                             className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                             title="Display in Shopify"
                          >
                            <Box size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}