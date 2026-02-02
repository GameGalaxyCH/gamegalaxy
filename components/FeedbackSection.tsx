'use client'

import { useState, useEffect } from 'react';
import { addFeedback, getFeedbacks, deleteFeedback, updateFeedback, FeedbackItem } from '@/app/actions/feedback';
import { MessageSquarePlus, Trash2, Edit2, Save, X, Loader2, Lightbulb } from 'lucide-react';

export default function FeedbackSection() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadData = async () => {
    const res = await getFeedbacks();
    if (res.success && res.data) {
      setItems(res.data as FeedbackItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    setSubmitting(true);
    
    const res = await addFeedback(newItem);
    
    if (res.success && res.data) {
      setItems([res.data as FeedbackItem, ...items]);
      setNewItem("");
    } else {
      alert("Fehler: " + res.error); // Show error if it fails
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    const res = await deleteFeedback(id);
    if (res.success) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const startEdit = (item: FeedbackItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    const res = await updateFeedback(id, editContent);
    if (res.success) {
      setItems(items.map(i => i.id === id ? { ...i, content: editContent } : i));
      setEditingId(null);
    }
  };

  return (
    <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden mb-8">
      <div className="p-5">
        <h3 className="text-base font-bold text-amber-900 flex items-center gap-2 mb-3">
          <Lightbulb size={20} className="text-amber-600" />
          Feedback & Ideen Board
        </h3>
        
        {/* Input Area */}
        <div className="flex gap-2 mb-6">
          <input 
            type="text" 
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Was fehlt? Was funktioniert nicht? Hast du Ideen für neue Funktionen? Schreib es hier..."
            className="flex-1 px-4 py-2.5 text-sm border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 placeholder-amber-400"
        disabled={submitting}
          />
          <button 
            onClick={handleAdd}
            disabled={submitting || !newItem.trim()}
            className="px-6 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Hinzufügen"}
          </button>
        </div>

        {/* List Area */}
        {loading ? (
          <div className="text-sm text-amber-700/50 flex items-center gap-2">
             <Loader2 size={14} className="animate-spin" /> Lade Einträge...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {items.length === 0 && (
              <p className="text-sm text-amber-700/50 italic">Noch keine Einträge vorhanden.</p>
            )}
            {items.map(item => (
              <div key={item.id} className="group flex items-start justify-between gap-3 bg-white/80 p-3 rounded-lg border border-amber-100/50 text-sm shadow-sm hover:shadow-md transition-all">
                <div className="flex-1">
                  {editingId === item.id ? (
                    <input 
                      type="text" 
                      value={editContent} 
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item.id);
                          if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                  ) : (
                    <>
                      <p className="text-gray-800 break-words font-medium">{item.content}</p>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {new Date(item.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingId === item.id ? (
                    <>
                      <button onClick={() => saveEdit(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded bg-white border border-green-100" title="Speichern">
                        <Save size={14} />
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded bg-white border border-gray-100" title="Abbrechen">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded bg-white border border-gray-100" title="Bearbeiten">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded bg-white border border-gray-100" title="Löschen">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}