
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
  const [viewMode, setViewMode] = useState<'normal' | 'combo'>('combo');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'ticker', direction: 'asc' });
  
  const [modal, setModal] = useState<{ isOpen: boolean; mode: ModalMode; tradeId?: number; isStock?: boolean; ticker?: string }>({ isOpen: false, mode: 'close' });
  const [formData, setFormData] = useState({ ticker: '', broker: '', price: '', quantity: '', date: new Date().toISOString().split('T')[0], strike: '', expiry: '' });

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
    
    if (viewMode === 'normal') {
      const merged: Record<string, any> = {};
      list.forEach(t => {
        const key = `${t.positionType}-${t.stockName}-${t.expiryDate}-${t.strikePrice}-${t.broker || ''}`;
        if (!merged[key]) merged[key] = { ...t, totalRemaining: 0, totalOriginalCost: 0, ids: [] };
        merged[key].totalRemaining += t.remainingQuantity;
        merged[key].totalOriginalCost += (t.openPrice * t.remainingQuantity);
        merged[key].ids.push(t.id);
      });
      return Object.values(merged).map(m => ({ 
        ...m, 
        remainingQuantity: m.totalRemaining, 
        displayQuantity: m.totalRemaining,
        openPrice: m.totalOriginalCost / m.totalRemaining, 
        isMerged: true,
        rowSpan: 1,
        isUnhedged: false
      })).sort((a, b) => {
        let c = 0;
        switch (sortConfig.key) {
          case 'ticker': c = a.stockName.localeCompare(b.stockName); break;
          case 'expiry': c = (a.expiryDate || '').localeCompare(b.expiryDate || ''); break;
          case 'quantity': c = a.displayQuantity - b.displayQuantity; break;
          case 'price': c = a.openPrice - b.openPrice; break;
        }
        return sortConfig.direction === 'asc' ? c : -c;
      });
    }

    // Combo Mode Logic
    const groups: Record<string, any[]> = {};
    list.forEach(t => {
      const key = `${t.stockName}-${t.expiryDate || 'no-expiry'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const finalRows: any[] = [];
    
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const gA = groups[a][0];
      const gB = groups[b][0];
      let c = 0;
      switch (sortConfig.key) {
        case 'ticker': c = gA.stockName.localeCompare(gB.stockName); break;
        case 'expiry': c = (gA.expiryDate || '').localeCompare(gB.expiryDate || ''); break;
        default: c = gA.stockName.localeCompare(gB.stockName);
      }
      return sortConfig.direction === 'asc' ? c : -c;
    });

    sortedGroupKeys.forEach(key => {
      const group = groups[key];
      const longs = group.filter(t => t.positionType === PositionType.LONG_PUT).map(t => ({ ...t, rem: t.remainingQuantity }));
      const shorts = group.filter(t => t.positionType === PositionType.SHORT_PUT).map(t => ({ ...t, rem: t.remainingQuantity }));
      const others = group.filter(t => t.positionType !== PositionType.LONG_PUT && t.positionType !== PositionType.SHORT_PUT);

      longs.sort((a, b) => (a.strikePrice || 0) - (b.strikePrice || 0));
      shorts.sort((a, b) => (a.strikePrice || 0) - (b.strikePrice || 0));

      const matchedPairs: { l: any, s: any, qty: number }[] = [];

      for (let l of longs) {
        for (let s of shorts) {
          if (l.rem > 0 && s.rem > 0 && l.strikePrice === s.strikePrice) {
            const qty = Math.min(l.rem, s.rem);
            matchedPairs.push({ l: { ...l }, s: { ...s }, qty });
            l.rem -= qty;
            s.rem -= qty;
          }
        }
      }

      for (let l of longs) {
        for (let s of shorts) {
          if (l.rem > 0 && s.rem > 0) {
            const qty = Math.min(l.rem, s.rem);
            matchedPairs.push({ l: { ...l }, s: { ...s }, qty });
            l.rem -= qty;
            s.rem -= qty;
          }
        }
      }

      matchedPairs.forEach(pair => {
        const comboPair = [pair.l, pair.s];
        finalRows.push({ ...pair.l, displayQuantity: pair.qty, isUnhedged: false, comboPair, rowSpan: 2 });
        finalRows.push({ ...pair.s, displayQuantity: pair.qty, isUnhedged: false, comboPair, rowSpan: 0 });
      });

      longs.filter(l => l.rem > 0).forEach(l => {
        finalRows.push({ ...l, displayQuantity: l.rem, isUnhedged: true, rowSpan: 1 });
      });
      shorts.filter(s => s.rem > 0).forEach(s => {
        finalRows.push({ ...s, displayQuantity: s.rem, isUnhedged: true, rowSpan: 1 });
      });
      
      others.forEach(t => {
        finalRows.push({ ...t, displayQuantity: t.remainingQuantity, isUnhedged: false, rowSpan: 1 });
      });
    });

    return finalRows;
  }, [trades, filterTicker, filterBroker, viewMode, sortConfig]);

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

  return (
    <div className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-50 border-b border-slate-200">
        <div className="p-6 border-r border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-default group">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 text-center md:text-left group-hover:text-indigo-600 transition-colors">活跃持仓权利金总计</p>
          <p className="text-2xl font-black text-indigo-600 text-center md:text-left font-mono tracking-tight">${filteredOptions.reduce((acc, t) => acc + (t.openPrice * t.displayQuantity * 100), 0).toLocaleString()}</p>
        </div>
        <div className="p-6 flex flex-col justify-center gap-2">
          <div className="flex flex-row items-end gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">标的代码检索</p>
              <input type="text" placeholder="输入代码搜索..." value={filterTicker} onChange={e => setFilterTicker(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">账户/券商筛选</p>
              <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                <option value="ALL">全部券商</option>
                {Array.from(new Set(trades.concat(Object.values(stockPortfolio) as any).map(x => x.broker).filter(Boolean))).sort().map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
              </select>
            </div>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 w-fit">
            <button 
              onClick={() => setViewMode('normal')} 
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'normal' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              普通模式
            </button>
            <button 
              onClick={() => setViewMode('combo')} 
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'combo' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              组合模式
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="px-1 py-4 whitespace-nowrap w-px text-center">组合</th>
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
                <tr key={s.storageKey} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-1 py-4 text-center">
                    <span className="text-[10px] text-slate-300">--</span>
                  </td>
                  <td className="px-1 py-4"><span className="bg-blue-50 text-blue-600 text-[10px] font-black px-1 py-0.5 rounded uppercase tracking-tighter">正股</span></td>
                  <td className="px-1 py-4 font-bold text-slate-700 text-xs pr-2 whitespace-nowrap">{s.ticker} {s.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded ml-1">{s.broker}</span>}</td>
                  <td className="px-1 py-4 text-slate-900 text-xs font-bold whitespace-nowrap text-left font-mono">--长期--</td>
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
              const combo = t.comboPair;
              const span = t.rowSpan;
              const shouldSkip = span === 0;

              return (
                <tr key={`${t.id || 'merged'}-${idx}`} className={`hover:bg-slate-50/50 transition-all ${soon ? 'bg-amber-50/10' : ''} ${combo ? 'bg-indigo-50/20' : ''}`}>
                  {!shouldSkip && (
                    <td className={`px-1 py-4 text-center border-r border-slate-100 transition-all ${combo && span > 0 ? 'border-l-4 border-indigo-500' : ''}`} rowSpan={span}>
                      {combo ? (
                        <button 
                          onClick={() => onAnalyzeCombination(combo)}
                          className="text-indigo-600 hover:bg-indigo-100/50 text-[9px] font-black px-2 py-1 rounded-md transition-all flex items-center gap-1 mx-auto border border-indigo-100 hover:border-indigo-300"
                          title="分析此组合"
                        >
                          <i className="fa-solid fa-chart-pie"></i> 分析
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300">--</span>
                      )}
                    </td>
                  )}
                  <td className="px-1 py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[9px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${isShort ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{isShort ? 'S' : 'B'}{t.positionType.split(' ')[1].charAt(0)}</span>
                      {t.isUnhedged && <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">Unhedged</span>}
                    </div>
                  </td>
                  <td className="px-1 py-4 font-bold text-slate-700 text-xs pr-2 whitespace-nowrap">{t.stockName} @{t.strikePrice} {t.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded ml-1">{t.broker}</span>}</td>
                  <td className={`px-1 py-4 text-sm font-mono whitespace-nowrap text-left ${soon ? 'text-amber-600 font-black' : 'text-slate-900'}`}>{t.expiryDate}</td>
                  <td className="px-1 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{t.displayQuantity}</td>
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
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">标的代码</label>
                      <input type="text" value={formData.ticker} onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none uppercase focus:ring-2 focus:ring-indigo-500 transition-all"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">所属券商</label>
                      <input type="text" value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
                    </div>
                  </div>
                  {!modal.isStock && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">行权价</label>
                        <input type="number" step="0.5" value={formData.strike} onChange={e => setFormData({...formData, strike: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">到期日</label>
                        <input type="date" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"/>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{modal.mode === 'modify' ? '买入均价' : '平仓价格'}</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{modal.mode === 'modify' ? '持有数量' : '平仓数量'}</label>
                  <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{modal.mode === 'modify' ? '开仓日期' : '平仓日期'}</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"/>
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
