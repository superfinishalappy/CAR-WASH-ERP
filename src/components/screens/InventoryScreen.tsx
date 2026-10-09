import React, { useState, useEffect } from 'react';
import { dataProvider } from '@/lib/data-provider';
import { InventoryItem, InventoryLog } from '@/types/database';

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<'levels' | 'washbay' | 'history'>('levels');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeBatches, setActiveBatches] = useState<any[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('Liters');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemWashes, setNewItemWashes] = useState('');

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionItem, setActionItem] = useState<InventoryItem | null>(null);
  const [actionType, setActionType] = useState<'add_stock' | 'start_batch' | 'write_off'>('add_stock');
  const [actionQuantity, setActionQuantity] = useState('1');
  const [actionCost, setActionCost] = useState('');
  const [actionNote, setActionNote] = useState('');
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    loadData();
    
    const interval = setInterval(loadData, 5000); // refresh every 5s for burn rate
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setItems(dataProvider.getInventoryItems());
    setActiveBatches(dataProvider.getActiveBatches());
    setLogs(dataProvider.getInventoryLogs());
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;

    await dataProvider.addInventoryItem({
      name: newItemName,
      unit: newItemUnit,
      current_stock: Number(newItemStock) || 0,
      expected_washes: Number(newItemWashes) || 0,
    });
    
    setShowAddModal(false);
    setNewItemName('');
    setNewItemName('');
    setNewItemStock('');
    setNewItemWashes('');
    loadData();
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    await dataProvider.updateInventoryItem(editingItem.id, {
      name: editingItem.name,
      unit: editingItem.unit,
      expected_washes: editingItem.expected_washes,
    });
    
    setEditingItem(null);
    loadData();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    await dataProvider.deleteInventoryItem(id);
    loadData();
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionItem || !actionQuantity) return;

    const res = await dataProvider.addInventoryLog({
      item_id: actionItem.id,
      action_type: actionType,
      quantity: Number(actionQuantity),
      total_cost: actionType === 'add_stock' && actionCost ? Number(actionCost) : undefined,
      note: actionNote,
    });

    if (!res.success) {
      alert('Error: ' + res.error);
    }

    setShowActionModal(false);
    setActionQuantity('1');
    setActionCost('');
    setActionNote('');
    loadData();
  };

  const handleEmptyBatch = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to mark the current batch of ${item.name} as empty?`)) return;
    
    await dataProvider.addInventoryLog({
      item_id: item.id,
      action_type: 'empty_batch',
      quantity: 1, // Doesn't matter
    });
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Stock Room</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage inventory & track real-time consumption</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
          >
            + Add New Item
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('levels')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'levels'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Store Room (Stock Levels)
        </button>
        <button
          onClick={() => setActiveTab('washbay')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'washbay'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Wash Bay (Active Batches)
          {activeBatches.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
              {activeBatches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          History Log
        </button>
      </div>

      {/* Tab: Store Room */}
      {activeTab === 'levels' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="pb-3 font-medium">Item Name</th>
                  <th className="pb-3 font-medium">Stock Left</th>
                  <th className="pb-3 font-medium">Expected Washes</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td className="py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                    </td>
                    <td className="py-4">
                      <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                        item.current_stock > 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : item.current_stock > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {item.current_stock} {item.unit}
                      </div>
                    </td>
                    <td className="py-4 text-slate-600 dark:text-slate-400">
                      1 {item.unit} ≈ {item.expected_washes} washes
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setActionItem(item); setActionType('start_batch'); setShowActionModal(true); }}
                          disabled={item.current_stock <= 0}
                          className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                        >
                          Wash Bay
                        </button>
                        <button
                          onClick={() => { setActionItem(item); setActionType('add_stock'); setShowActionModal(true); }}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Buy More
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                      Your store room is empty. Add a new item to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Wash Bay */}
      {activeTab === 'washbay' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeBatches.map(batch => {
            const isCritical = batch.remainingPct < 15;
            
            return (
              <div key={batch.item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {batch.item.name}
                        {isCritical && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        Batch opened on {new Date(batch.startLog.entry_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {Math.round(batch.remainingPct)}%
                      </div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Remaining</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                      <span>{batch.washedCount} washed</span>
                      <span>Expected: {batch.expectedTotal}</span>
                    </div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : batch.remainingPct < 40 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, batch.washedCount / batch.expectedTotal * 100)}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleEmptyBatch(batch.item)}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                  >
                    Mark as Empty
                  </button>
                </div>
              </div>
            )
          })}
          
          {activeBatches.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 font-medium">
              No active batches in the wash bay. Start a batch from the Store Room.
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cost</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {new Date(log.created_at || log.entry_date).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                      {log.item_name}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        log.action_type === 'add_stock' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        log.action_type === 'start_batch' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        log.action_type === 'empty_batch' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {log.action_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                      {log.action_type === 'empty_batch' ? '-' : log.quantity}
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                      {log.total_cost ? Number(log.total_cost).toLocaleString() : '-'}
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {log.created_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Add Inventory Item</h3>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Item Name</label>
                  <input type="text" required value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. Shampoo Premium" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
                    <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none">
                      <option value="Liters">Liters</option>
                      <option value="Kg">Kg</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Gallons">Gallons</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Stock</label>
                    <input type="number" step="any" required min="0" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} placeholder="e.g. 5" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expected Washes (Per 1 Unit)</label>
                  <input type="number" step="any" required min="0" value={newItemWashes} onChange={e => setNewItemWashes(e.target.value)} placeholder="e.g. 125" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none" />
                  <p className="text-xs text-slate-500 mt-2 font-medium">How many vehicles can 1 {newItemUnit} wash? Used to calculate live burn rates.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-sm hover:opacity-90">Save Item</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showActionModal && actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                {actionType === 'add_stock' ? 'Buy More Stock' : actionType === 'start_batch' ? 'Take to Wash Bay' : 'Write Off'}
              </h3>
              <p className="text-sm font-medium text-slate-500 mb-6">{actionItem.name}</p>
              
              <form onSubmit={handleAction} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity ({actionItem.unit})</label>
                  <input type="number" step="any" required min="0.01" max={actionType !== 'add_stock' ? actionItem.current_stock : undefined} value={actionQuantity} onChange={e => setActionQuantity(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-lg font-bold outline-none" />
                </div>

                {actionType === 'add_stock' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Purchase Price (Optional)</label>
                    <input type="number" step="any" min="0" value={actionCost} onChange={e => setActionCost(e.target.value)} placeholder="e.g. 2000" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-lg font-bold outline-none" />
                  </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowActionModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-sm hover:opacity-90">Confirm Action</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Edit Item</h3>
              
              <form onSubmit={handleUpdateItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Item Name</label>
                  <input type="text" required value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
                    <input type="text" required value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Washes / Unit</label>
                    <input type="number" step="any" required min="0" value={editingItem.expected_washes || 0} onChange={e => setEditingItem({...editingItem, expected_washes: Number(e.target.value)})} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium outline-none" />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-sm hover:opacity-90">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
