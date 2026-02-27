
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
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

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
          const date = new Date(tx.date);
          let periodKey = '';
          if (timescale === 'year') {
            periodKey = `${date.getFullYear()}`;
          } else if (timescale === 'month') {
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else {
            const day = date.getDay() || 7;
            const monday = new Date(date);
            monday.setDate(date.getDate() - day + 1);
            periodKey = monday.toISOString().split('T')[0];
          }

          if (!selectedPeriod || periodKey === selectedPeriod) {
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
              strike: t.strikePrice,
              periodKey
            });
          }
        }
      });
    });
    return list.sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());
  }, [trades, filterTicker, filterBroker, selectedPeriod, timescale]);

  const periodicSummaries = useMemo(() => {
    const groups: Record<string, { total: number, count: number, winners: number, label: string }> = {};
    
    // We need to calculate summaries based on ALL transactions (ignoring selectedPeriod filter for the summary view itself)
    trades.forEach(t => {
      t.closeTransactions.forEach(tx => {
        const matchesTicker = !filterTicker || t.stockName.includes(filterTicker.toUpperCase());
        const matchesBroker = filterBroker === 'ALL' || t.broker === filterBroker;
        
        if (matchesTicker && matchesBroker) {
          const date = new Date(tx.date);
          let key = '';
          let label = '';

          if (timescale === 'year') {
            key = `${date.getFullYear()}`;
            label = `${date.getFullYear()}年`;
          } else if (timescale === 'month') {
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
        }
      });
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({ key, ...data }));
  }, [trades, filterTicker, filterBroker, timescale]);

  const metrics = useMemo(() => {
    const total = transactions.reduce((acc, tx) => acc + tx.profit, 0);
    const winners = transactions.filter(t => t.profit > 0).length;
    const losers = transactions.filter(t => t.profit < 0).length;
    const winRate = transactions.length > 0 ? (winners / transactions.length) * 100 : 0;
    const avgProfit = transactions.length > 0 ? total / transactions.length : 0;
    const maxAbsProfit = transactions.length > 0 ? Math.max(...transactions.map(tx => Math.abs(tx.profit))) : 0;
    
    return { total, winners, losers, winRate, avgProfit, maxAbsProfit };
  }, [transactions]);

  return (
    <div className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-4 bg-slate-50/50 border-b border-slate-200">
        {/* 1. 已实现净损益 - 重点优化：字号缩小，间距收紧 */}
        <div className="p-5 border-r border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">已实现净损益</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-black tracking-tighter font-mono ${metrics.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ${metrics.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 2. 胜/负/平 - 优化：通过颜色区分，而不是纯字号 */}
        <div className="p-5 border-r border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">战绩统计</p>
          <p className="text-base font-bold text-slate-700 font-mono">
            <span className="text-emerald-500">{metrics.winners}W</span> 
            <span className="text-slate-300 mx-1.5">/</span> 
            <span className="text-rose-500">{metrics.losers}L</span>
          </p>
        </div>

        {/* 3. 平均单笔盈利 - 优化：使用更深一点的颜色 */}
        <div className="p-5 border-r border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">平均单笔</p>
          <p className={`text-base font-bold font-mono ${metrics.avgProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ${metrics.avgProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* 4. 胜率 - 优化：进度条更纤细 */}
        <div className="p-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">整体胜率</p>
          <div className="flex items-center gap-3">
            <p className="text-base font-black text-slate-800 font-mono">{metrics.winRate.toFixed(1)}%</p>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${metrics.winRate}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white border-b border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
              <input 
                type="text" 
                placeholder="搜索代码..." 
                value={filterTicker}
                onChange={e => setFilterTicker(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none min-w-[120px] font-bold"
              />
            </div>
            <select 
              value={filterBroker}
              onChange={e => setFilterBroker(e.target.value)}
              className="flex-1 md:flex-initial bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none min-w-[100px]"
            >
              <option value="ALL">全部券商</option>
              {brokers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               {viewMode === 'list' ? `共 ${transactions.length} 条明细` : `共分 ${periodicSummaries.length} 个周期`}
             </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-1">
            <button 
              onClick={() => { setViewMode('list'); setSelectedPeriod(null); }}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === 'list' && !selectedPeriod ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-600'}`}
            >
              交易明细
              {viewMode === 'list' && !selectedPeriod && <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
            </button>
            <button 
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === 'summary' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-600'}`}
            >
              周期统计
              {viewMode === 'summary' && <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
            </button>
            {selectedPeriod && viewMode === 'list' && (
              <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold">
                <span>周期: {selectedPeriod}</span>
                <button onClick={() => setSelectedPeriod(null)} className="hover:text-indigo-800">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}
          </div>

          {viewMode === 'summary' && (
            <div className="flex gap-2">
              {(['year', 'month', 'week'] as SummaryTimescale[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTimescale(t)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${timescale === t ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  {t === 'year' ? '按年' : t === 'month' ? '按月' : '按周'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {viewMode === 'list' ? (
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <th className="px-2 py-4 whitespace-nowrap w-px">平仓时间</th>
                <th className="px-2 py-4 whitespace-nowrap w-px">标的 / 券商</th>
                <th className="px-2 py-4 text-right whitespace-nowrap w-px">开仓价</th>
                <th className="px-2 py-4 text-right whitespace-nowrap w-px">平仓价</th>
                <th className="px-2 py-4 text-right whitespace-nowrap w-px">数量</th>
                <th className="px-2 py-4 text-right whitespace-nowrap w-px">损益金</th>
                <th className="px-2 py-4 text-center whitespace-nowrap">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(tx => {
                const heatOpacity = metrics.maxAbsProfit > 0 ? Math.min(0.15, (Math.abs(tx.profit) / metrics.maxAbsProfit) * 0.15) : 0;
                const heatBg = tx.profit >= 0 
                  ? `rgba(16, 185, 129, ${heatOpacity + 0.02})` 
                  : `rgba(244, 63, 94, ${heatOpacity + 0.02})`;

                return (
                  <tr key={tx.txId} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-2 py-4 text-sm text-slate-900 font-mono whitespace-nowrap">{tx.closeDate}</td>
                    <td className="px-2 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{tx.stockName}</span>
                          {tx.broker && <span className="text-[8px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded font-bold">{tx.broker}</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          {tx.type} {tx.strike ? `@${tx.strike}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{tx.openPrice.toFixed(2)}</td>
                    <td className="px-2 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{tx.closePrice.toFixed(2)}</td>
                    <td className="px-2 py-4 text-right font-mono text-slate-900 text-sm whitespace-nowrap">{tx.quantity}</td>
                    <td 
                      className={`px-2 py-4 text-right font-bold text-sm whitespace-nowrap transition-all duration-300 font-mono ${tx.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
                      style={{ backgroundColor: heatBg }}
                    >
                      ${tx.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {periodicSummaries.map(s => {
              const winRate = (s.winners / s.count) * 100;
              return (
                <div 
                  key={s.key} 
                  onClick={() => {
                    setSelectedPeriod(s.key);
                    setViewMode('list');
                  }}
                  className="relative overflow-hidden bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer hover:border-indigo-300 group bg-gradient-to-br from-white/40 to-slate-50/40"
                >
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{s.label}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.count} 次交易</p>
                    </div>
                    <span className={`text-xl font-black font-mono ${s.total >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {s.total >= 0 ? '+' : ''}${s.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">周期胜率</p>
                      <p className="text-sm font-black text-slate-700 font-mono">{winRate.toFixed(1)}%</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ease-out ${winRate >= 50 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'} ${winRate > 0 ? 'animate-pulse' : ''}`} 
                        style={{ width: `${winRate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Subtle background decoration */}
                  <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-colors duration-500 ${s.total >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
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
