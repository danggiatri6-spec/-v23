
import React, { useState, useMemo } from 'react';
import { Trade, SummaryTimescale } from '../types';
import { COLORS } from '../constants';

interface ClosedLogProps {
  trades: Trade[];
  onDeleteTransaction: (tid: number, txid: number) => void;
  onDeleteTrade: (id: number) => void;
}

type ViewMode = 'list' | 'summary';

const ClosedLog: React.FC<ClosedLogProps> = ({ trades, onDeleteTransaction, onDeleteTrade }) => {
  const [filterTicker, setFilterTicker] = useState('');
  const [filterBroker, setFilterBroker] = useState('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timescale, setTimescale] = useState<SummaryTimescale>('month');

  const brokers = useMemo(() => {
    const bSet = new Set<string>();
    trades.forEach(t => t.broker && bSet.add(t.broker));
    return Array.from(bSet).sort();
  }, [trades]);

  const transactions = useMemo(() => {
    const list: any[] = [];
    trades.forEach(t => {
      t.closeTransactions.forEach(tx => {
        const matchesTicker = !filterTicker || t.stockName.includes(filterTicker.toUpperCase());
        const matchesBroker = filterBroker === 'ALL' || t.broker === filterBroker;
        
        if (matchesTicker && matchesBroker) {
          list.push({
            tradeId: t.id,
            txId: tx.txId,
            stockName: t.stockName,
            broker: t.broker,
            type: t.positionType,
            closeDate: tx.date,
            openPrice: t.openPrice,
            closePrice: tx.price,
            quantity: tx.quantity,
            profit: tx.profit,
            strike: t.strikePrice
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());
  }, [trades, filterTicker, filterBroker]);

  const periodicSummaries = useMemo(() => {
    const groups: Record<string, { total: number, count: number, winners: number, label: string }> = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.closeDate);
      let key = '';
      let label = '';

      if (timescale === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        label = `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
      } else {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setDate(date.getDate() - day + 1);
        key = monday.toISOString().split('T')[0];
        label = `${key} 起该周`;
      }

      if (!groups[key]) {
        groups[key] = { total: 0, count: 0, winners: 0, label };
      }
      groups[key].total += tx.profit;
      groups[key].count += 1;
      if (tx.profit > 0) groups[key].winners += 1;
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({ key, ...data }));
  }, [transactions, timescale]);

  const metrics = useMemo(() => {
    const total = transactions.reduce((acc, tx) => acc + tx.profit, 0);
    const winners = transactions.filter(t => t.profit > 0).length;
    const losers = transactions.filter(t => t.profit < 0).length;
    const winRate = transactions.length > 0 ? (winners / transactions.length) * 100 : 0;
    const avgProfit = transactions.length > 0 ? total / transactions.length : 0;
    
    return { total, winners, losers, winRate, avgProfit };
  }, [transactions]);

  return (
    <div className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-4 bg-slate-50 border-b border-slate-200">
        <div className="p-6 border-r border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">已实现净损益</p>
          <p className={`text-2xl font-black ${metrics.total >= 0 ? COLORS.profit : COLORS.loss}`}>
            ${metrics.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-6 border-r border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">胜/负/平场次</p>
          <p className="text-xl font-black text-slate-800">
            <span className="text-emerald-500">{metrics.winners} 胜</span> 
            <span className="text-slate-300 mx-1">/</span> 
            <span className="text-rose-500">{metrics.losers} 负</span>
          </p>
        </div>
        <div className="p-6 border-r border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">平均单笔盈利</p>
          <p className={`text-xl font-black ${metrics.avgProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            ${metrics.avgProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">整体盈利率/胜率</p>
          <div className="flex items-center gap-3">
            <p className="text-xl font-black text-slate-800">{metrics.winRate.toFixed(1)}%</p>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${metrics.winRate}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              交易明细
            </button>
            <button 
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              周期统计
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              value={filterBroker}
              onChange={e => setFilterBroker(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 outline-none"
            >
              <option value="ALL">全部券商</option>
              {brokers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
            <input 
              type="text" 
              placeholder="搜索代码..." 
              value={filterTicker}
              onChange={e => setFilterTicker(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none min-w-[120px]"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-slate-300"></span>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             {viewMode === 'list' ? `共 ${transactions.length} 条记录` : `共分 ${periodicSummaries.length} 个时间段`}
           </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {viewMode === 'list' ? (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <th className="px-6 py-4">平仓时间</th>
                <th className="px-6 py-4">标的 / 券商</th>
                <th className="px-6 py-4 text-right">开仓价</th>
                <th className="px-6 py-4 text-right">平仓价</th>
                <th className="px-6 py-4 text-right">数量</th>
                <th className="px-6 py-4 text-right">损益金</th>
                <th className="px-6 py-4 text-center">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(tx => (
                <tr key={tx.txId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-500 font-mono">{tx.closeDate}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{tx.stockName}</span>
                        {tx.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-400 rounded font-bold">{tx.broker}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {tx.type} {tx.strike ? `@${tx.strike}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600">{tx.openPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600">{tx.closePrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600">{tx.quantity}</td>
                  <td className={`px-6 py-4 text-right font-bold ${tx.profit >= 0 ? COLORS.profit : COLORS.loss}`}>
                    ${tx.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        onClick={() => {
                          if(confirm('撤销此平仓记录将恢复持仓数量，确认继续？')) {
                            onDeleteTransaction(tx.tradeId, tx.txId);
                          }
                        }}
                        className="w-8 h-8 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
                        title="撤销平仓"
                      >
                        <i className="fa-solid fa-rotate-left text-xs"></i>
                      </button>
                      <button 
                        onClick={() => {
                          if(confirm('确定要从数据库中永久移除这条成交记录吗？')) {
                            onDeleteTrade(tx.tradeId);
                          }
                        }}
                        className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                        title="永久删除"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {periodicSummaries.map(s => {
              const winRate = (s.winners / s.count) * 100;
              return (
                <div key={s.key} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{s.label}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.count} 次交易</p>
                    </div>
                    <span className={`text-xl font-black ${s.total >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {s.total >= 0 ? '+' : ''}${s.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">周期胜率</p>
                      <p className="text-sm font-black text-slate-700">{winRate.toFixed(1)}%</p>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${winRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {transactions.length === 0 && (
          <div className="px-6 py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                <i className="fa-solid fa-inbox text-xl"></i>
              </div>
              <p className="text-slate-400 text-sm italic">暂无历史成交记录</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClosedLog;
