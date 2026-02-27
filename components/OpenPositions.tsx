
import React, { useState, useMemo } from 'react';
import { Trade, StockHolding, PositionType } from '../types';
import { COLORS } from '../constants';
import { MarketUpdate, MarketData } from '../services/marketService';

interface OpenPositionsProps {
  trades: Trade[];
  stockPortfolio: Record<string, StockHolding>;
  brokers: string[];
  marketUpdate: MarketUpdate;
  isFetchingPrices: boolean;
  onMarketSync: () => void;
  onUpdateTrade: (id: number, updated: Partial<Trade>) => void;
  onDeleteTrade: (id: number) => void;
  onBatchUpdateTrades: (updates: { id: number; data: Partial<Trade> }[]) => void;
  onUpdateStock: (oldKey: string, quantity: number, totalCost: number, ticker?: string, broker?: string) => void;
  onDeleteStock: (storageKey: string) => void;
  onAnalyzeCombination: (trades: Trade[]) => void;
}

type SortKey = 'ticker' | 'expiry' | 'quantity' | 'price';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'close' | 'modify';

const OpenPositions: React.FC<OpenPositionsProps> = ({ 
  trades, stockPortfolio, brokers: registeredBrokers,
  marketUpdate, isFetchingPrices, onMarketSync,
  onUpdateTrade, onDeleteTrade, onUpdateStock, onDeleteStock,
  onAnalyzeCombination
}) => {
  const [filterTicker, setFilterTicker] = useState('');
  const [filterBroker, setFilterBroker] = useState('ALL');
  const [isMerged, setIsMerged] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'ticker', direction: 'asc' });
  
  const [modal, setModal] = useState<{ isOpen: boolean; mode: ModalMode; tradeId?: number; isStock?: boolean; ticker?: string }>({ isOpen: false, mode: 'close' });
  const [formData, setFormData] = useState({ ticker: '', broker: '', price: '', quantity: '', date: new Date().toISOString().split('T')[0], strike: '', expiry: '' });

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<number[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);

  const handleSort = (key: SortKey) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const sortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <i className="fa-solid fa-sort ml-1 opacity-20 text-[8px]"></i>;
    return sortConfig.direction === 'asc' ? <i className="fa-solid fa-sort-up ml-1 text-indigo-600"></i> : <i className="fa-solid fa-sort-down ml-1 text-indigo-600"></i>;
  };

  const filteredStocks = useMemo(() => {
    let list = (Object.entries(stockPortfolio) as [string, StockHolding][])
      .map(([key, data]) => {
        const match = key.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        const ticker = match ? match[1].trim() : key;
        const broker = match && match[2] ? match[2].trim() : (data.broker || '');
        return { ...data, ticker, broker, storageKey: key };
      })
      .filter((item) => (item.quantity > 0 && item.ticker.includes(filterTicker.toUpperCase()) && (filterBroker === 'ALL' || item.broker === filterBroker)));
    list.sort((a, b) => {
      let c = 0;
      if (sortConfig.key === 'ticker') c = a.ticker.localeCompare(b.ticker);
      if (sortConfig.key === 'quantity') c = a.quantity - b.quantity;
      if (sortConfig.key === 'price') c = (a.totalCost / a.quantity) - (b.totalCost / b.quantity);
      return sortConfig.direction === 'asc' ? c : -c;
    });
    return list;
  }, [stockPortfolio, filterTicker, filterBroker, sortConfig]);

  const filteredOptions = useMemo(() => {
    let list = trades.filter(t => (t.status === 'open' && t.remainingQuantity > 0 && t.stockName.includes(filterTicker.toUpperCase()) && (filterBroker === 'ALL' || t.broker === filterBroker)));
    if (isMerged) {
      const merged: Record<string, any> = {};
      list.forEach(t => {
        const key = `${t.positionType}-${t.stockName}-${t.expiryDate}-${t.strikePrice}-${t.broker || ''}`;
        if (!merged[key]) merged[key] = { ...t, totalRemaining: 0, totalOriginalCost: 0, ids: [] };
        merged[key].totalRemaining += t.remainingQuantity;
        merged[key].totalOriginalCost += (t.openPrice * t.remainingQuantity);
        merged[key].ids.push(t.id);
      });
      list = Object.values(merged).map(m => ({ ...m, remainingQuantity: m.totalRemaining, openPrice: m.totalOriginalCost / m.totalRemaining, isMerged: true }));
    }
    list.sort((a, b) => {
      let c = 0;
      switch (sortConfig.key) {
        case 'ticker': c = a.stockName.localeCompare(b.stockName); break;
        case 'expiry': c = (a.expiryDate || '').localeCompare(b.expiryDate || ''); break;
        case 'quantity': c = a.remainingQuantity - b.remainingQuantity; break;
        case 'price': c = a.openPrice - b.openPrice; break;
      }
      return sortConfig.direction === 'asc' ? c : -c;
    });
    return list;
  }, [trades, filterTicker, filterBroker, isMerged, sortConfig]);

  const combinations = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    const openPuts = trades.filter(t => 
      t.status === 'open' && 
      t.remainingQuantity > 0 && 
      (t.positionType === PositionType.LONG_PUT || t.positionType === PositionType.SHORT_PUT)
    );

    openPuts.forEach(t => {
      const key = `${t.stockName}-${t.expiryDate}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const validCombos: Record<number, Trade[]> = {};
    Object.values(groups).forEach(group => {
      const hasLong = group.some(t => t.positionType === PositionType.LONG_PUT);
      const hasShort = group.some(t => t.positionType === PositionType.SHORT_PUT);
      if (hasLong && hasShort) {
        const long = group.find(t => t.positionType === PositionType.LONG_PUT)!;
        const short = group.find(t => t.positionType === PositionType.SHORT_PUT)!;
        validCombos[long.id] = [long, short];
        validCombos[short.id] = [long, short];
      }
    });
    return validCombos;
  }, [trades]);

  const optionSpans = useMemo(() => {
    const spans: Record<number, number> = {};
    const skip = new Set<number>();
    
    for (let i = 0; i < filteredOptions.length; i++) {
      if (skip.has(i)) continue;
      
      const t = filteredOptions[i];
      const combo = combinations[t.id];
      
      if (combo) {
        const comboIds = new Set(combo.map(c => c.id));
        let count = 1;
        // 检查后续连续的行是否属于同一个组合
        for (let j = i + 1; j < filteredOptions.length; j++) {
          if (comboIds.has(filteredOptions[j].id)) {
            count++;
            skip.add(j);
          } else {
            break;
          }
        }
        if (count > 1) {
          spans[i] = count;
        }
      }
    }
    return { spans, skip };
  }, [filteredOptions, combinations]);

  const handleActionConfirm = () => {
    const p = parseFloat(formData.price), q = parseFloat(formData.quantity);
    if (modal.isStock && modal.ticker) {
      if (modal.mode === 'close') {
        const current = stockPortfolio[modal.ticker];
        onUpdateStock(modal.ticker, current.quantity - q, current.totalCost - (current.totalCost / current.quantity * q));
      } else {
        onUpdateStock(modal.ticker, q, p * q, formData.ticker.toUpperCase(), formData.broker || undefined);
      }
    } else if (modal.tradeId) {
      const trade = trades.find(t => t.id === modal.tradeId);
      if (trade) {
        if (modal.mode === 'close') {
          const profit = trade.positionType.includes('Long') ? (p - trade.openPrice) * 100 * q : (trade.openPrice - p) * 100 * q;
          onUpdateTrade(modal.tradeId, { remainingQuantity: trade.remainingQuantity - q, status: (trade.remainingQuantity - q <= 0) ? 'closed' : 'open', closeTransactions: [...trade.closeTransactions, { txId: Date.now(), date: formData.date, price: p, quantity: q, profit }] });
        } else {
          onUpdateTrade(modal.tradeId, { stockName: formData.ticker.toUpperCase(), broker: formData.broker || undefined, openPrice: p, totalQuantity: q, remainingQuantity: q, strikePrice: parseFloat(formData.strike) || undefined, expiryDate: formData.expiry || undefined, openDate: formData.date });
        }
      }
    }
    setModal({ ...modal, isOpen: false });
  };

  const confirmDelete = (item: any, isStock: boolean) => {
    const name = isStock ? item.ticker : `${item.stockName} @${item.strikePrice}`;
    if (window.confirm(`确定要彻底删除 ${name} 的持仓记录吗？`)) {
      if (isStock) onDeleteStock(item.storageKey);
      else onDeleteTrade(item.id);
    }
  };

  const toggleSelectTrade = (id: number) => setSelectedTrades(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectStock = (key: string) => setSelectedStocks(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleBatchDelete = () => {
    const totalCount = selectedTrades.length + selectedStocks.length;
    if (totalCount === 0) return;
    if (window.confirm(`确定要删除选中的 ${totalCount} 个持仓记录吗？`)) {
      selectedTrades.forEach(id => onDeleteTrade(id));
      selectedStocks.forEach(key => onDeleteStock(key));
      setSelectedTrades([]);
      setSelectedStocks([]);
      setSelectionMode(false);
    }
  };

  return (
    <div className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-200">
        <div className="p-6 border-r border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center md:text-left">活跃持仓权利金总计</p>
          <p className="text-2xl font-black text-indigo-600 text-center md:text-left">${filteredOptions.reduce((acc, t) => acc + (t.openPrice * t.remainingQuantity * 100), 0).toLocaleString()}</p>
        </div>
        <div className="p-6 border-r border-slate-200"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center md:text-left">标的代码检索</p><input type="text" placeholder="输入代码搜索..." value={filterTicker} onChange={e => setFilterTicker(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none" /></div>
        <div className="p-6 flex flex-col justify-center gap-2">
           <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center md:text-left">账户/券商筛选</p>
              <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none">
                <option value="ALL">全部券商</option>
                {Array.from(new Set(trades.concat(Object.values(stockPortfolio) as any).map(x => x.broker).filter(Boolean))).sort().map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
              </select>
            </div>
            <button onClick={() => setIsMerged(!isMerged)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border mt-5 ${isMerged ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>{isMerged ? '拆分视图' : '合并视图'}</button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
        <button onClick={() => { setSelectionMode(!selectionMode); setSelectedTrades([]); setSelectedStocks([]); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all border ${selectionMode ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
          <i className={`fa-solid ${selectionMode ? 'fa-xmark mr-2' : 'fa-list-check mr-2'}`}></i>
          {selectionMode ? '取消选择' : '批量管理模式'}
        </button>
        {selectionMode && (selectedTrades.length > 0 || selectedStocks.length > 0) && (
          <button onClick={handleBatchDelete} className="px-4 py-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-lg shadow-rose-100">
            彻底删除所选 ({selectedTrades.length + selectedStocks.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="px-1 py-4 whitespace-nowrap w-px text-center">组合</th>
              {selectionMode && <th className="px-1 py-4 whitespace-nowrap text-center w-px">选择</th>}
              <th className="px-1 py-4 whitespace-nowrap w-px">头寸</th>
              <th className="px-1 py-4 cursor-pointer whitespace-nowrap w-px" onClick={() => handleSort('ticker')}>标的/券商 {sortIcon('ticker')}</th>
              <th className="px-1 py-4 cursor-pointer text-left whitespace-nowrap w-px" onClick={() => handleSort('expiry')}>到期日 {sortIcon('expiry')}</th>
              <th className="px-1 py-4 text-right cursor-pointer whitespace-nowrap w-px" onClick={() => handleSort('quantity')}>数量 {sortIcon('quantity')}</th>
              <th className="px-1 py-4 text-right whitespace-nowrap w-px">均价</th>
              <th className="px-1 py-4 text-center whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStocks.map(s => {
              const cost = s.totalCost / s.quantity;
              return (
                <tr key={s.storageKey} className={`hover:bg-slate-50/50 transition-colors ${selectedStocks.includes(s.storageKey) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-1 py-4 text-center">
                    <span className="text-[10px] text-slate-300">--</span>
                  </td>
                  {selectionMode && (
                    <td className="px-1 py-4 text-center">
                      <input type="checkbox" checked={selectedStocks.includes(s.storageKey)} onChange={() => toggleSelectStock(s.storageKey)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    </td>
                  )}
                  <td className="px-1 py-4"><span className="bg-blue-50 text-blue-600 text-[10px] font-black px-1 py-0.5 rounded uppercase tracking-tighter">正股</span></td>
                  <td className="px-1 py-4 font-bold text-slate-700 text-xs pr-2 whitespace-nowrap">{s.ticker} {s.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-400 rounded ml-1">{s.broker}</span>}</td>
                  <td className="px-1 py-4 text-slate-900 text-xs font-bold whitespace-nowrap text-left">--长期--</td>
                  <td className="px-1 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{s.quantity}</td>
                  <td className="px-1 py-4 text-right font-mono text-sm whitespace-nowrap">
                    <div className="font-bold text-slate-900">{cost.toFixed(2)}</div>
                  </td>
                  <td className="px-1 py-4">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => { setModal({ isOpen: true, mode: 'modify', isStock: true, ticker: s.storageKey }); setFormData({ ticker: s.ticker, broker: s.broker || '', price: cost.toFixed(2), quantity: s.quantity.toString(), date: new Date().toISOString().split('T')[0], strike: '', expiry: '' }); }} className="px-1 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">改</button>
                      <button onClick={() => { setModal({ isOpen: true, mode: 'close', isStock: true, ticker: s.storageKey }); setFormData({ ticker: s.ticker, broker: s.broker || '', price: cost.toFixed(2), quantity: s.quantity.toString(), date: new Date().toISOString().split('T')[0], strike: '', expiry: '' }); }} className="px-1 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">平</button>
                      <button onClick={() => confirmDelete(s, true)} className="w-7 h-7 flex items-center justify-center bg-rose-50 text-rose-500 rounded hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOptions.map((t, idx) => {
              const isShort = t.positionType.includes('Short'), soon = t.expiryDate && (new Date(t.expiryDate).getTime() - new Date().getTime()) < 86400000 * 7;
              const combo = combinations[t.id];
              const span = optionSpans.spans[idx];
              const shouldSkip = optionSpans.skip.has(idx);

              return (
                <tr key={t.id || idx} className={`hover:bg-slate-50/50 transition-colors ${soon ? 'bg-amber-50/10' : ''} ${selectedTrades.includes(t.id) ? 'bg-indigo-50/30' : ''}`}>
                  {!shouldSkip && (
                    <td className="px-1 py-4 text-center border-r border-slate-100" rowSpan={span}>
                      {combo ? (
                        <button 
                          onClick={() => onAnalyzeCombination(combo)}
                          className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-1 rounded hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100 flex items-center gap-1 mx-auto"
                          title="分析此组合"
                        >
                          <i className="fa-solid fa-chart-pie"></i> 分析
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300">--</span>
                      )}
                    </td>
                  )}
                  {selectionMode && (
                    <td className="px-1 py-4 text-center">
                      <input type="checkbox" checked={selectedTrades.includes(t.id)} onChange={() => toggleSelectTrade(t.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    </td>
                  )}
                  <td className="px-1 py-4"><span className={`text-[9px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${isShort ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{isShort ? 'S' : 'B'}{t.positionType.split(' ')[1].charAt(0)}</span></td>
                  <td className="px-1 py-4 font-bold text-slate-700 text-xs pr-2 whitespace-nowrap">{t.stockName} @{t.strikePrice} {t.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-400 rounded ml-1">{t.broker}</span>}</td>
                  <td className={`px-1 py-4 text-sm font-mono whitespace-nowrap text-left ${soon ? 'text-amber-600 font-black' : 'text-slate-900'}`}>{t.expiryDate}</td>
                  <td className="px-1 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{t.remainingQuantity}</td>
                  <td className="px-1 py-4 text-right font-mono text-sm whitespace-nowrap">
                    <div className="font-bold text-slate-900">{t.openPrice.toFixed(2)}</div>
                  </td>
                  <td className="px-1 py-4">
                    <div className="flex justify-center gap-1">
                      {!t.isMerged ? (
                        <>
                          <button onClick={() => { setModal({ isOpen: true, mode: 'modify', tradeId: t.id }); setFormData({ ticker: t.stockName, broker: t.broker || '', price: t.openPrice.toFixed(2), quantity: t.totalQuantity.toString(), date: t.openDate, strike: t.strikePrice?.toString() || '', expiry: t.expiryDate || '' }); }} className="px-1 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">改</button>
                          <button onClick={() => { setModal({ isOpen: true, mode: 'close', tradeId: t.id }); setFormData({ ticker: t.stockName, broker: t.broker || '', price: t.openPrice.toFixed(2), quantity: t.remainingQuantity.toString(), date: new Date().toISOString().split('T')[0], strike: '', expiry: '' }); }} className="px-1 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">平</button>
                          <button onClick={() => confirmDelete(t, false)} className="w-7 h-7 flex items-center justify-center bg-rose-50 text-rose-500 rounded hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                        </>
                      ) : <span className="text-[8px] text-slate-300 italic whitespace-nowrap">合并项</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className={`p-6 border-b flex justify-between items-center ${modal.mode === 'modify' ? 'bg-indigo-50/40 text-indigo-800' : 'bg-rose-50/40 text-rose-800'}`}>
              <h3 className="font-black text-sm uppercase tracking-widest">{modal.mode === 'modify' ? '🔧 修正持仓记录' : '💰 执行平仓交易'}</h3>
              <button onClick={() => setModal({ ...modal, isOpen: false })} className="p-2"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              {modal.mode === 'modify' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">标的代码</label>
                      <input type="text" value={formData.ticker} onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none uppercase"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">所属券商</label>
                      <input type="text" value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
                    </div>
                  </div>
                  {!modal.isStock && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">行权价</label>
                        <input type="number" step="0.5" value={formData.strike} onChange={e => setFormData({...formData, strike: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">到期日</label>
                        <input type="date" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modal.mode === 'modify' ? '买入均价' : '平仓价格'}</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modal.mode === 'modify' ? '持有数量' : '平仓数量'}</label>
                  <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modal.mode === 'modify' ? '开仓日期' : '平仓日期'}</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none"/>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3"><button onClick={() => setModal({ ...modal, isOpen: false })} className="flex-1 py-4 rounded-xl border border-slate-200 bg-white text-slate-500 font-black text-xs uppercase tracking-widest">取消</button><button onClick={handleActionConfirm} className={`flex-1 py-4 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg ${modal.mode === 'modify' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-rose-500 shadow-rose-100'}`}>确认保存</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenPositions;
